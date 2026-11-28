/** Browser-local OCR. No document bytes leave this browser.
 * Tesseract.js 6.0.1 / core 6.0.0, Vietnamese + English integer LSTM models.
 * The engine recognizes text; the small parser below only suggests labeled fields.
 * Nothing in this module validates the authenticity or legal status of a document.
 */
const VENDOR = new URL('./vendor/ocr/', import.meta.url);
const ENGINE = 'Tesseract.js 6.0.1 · Tiếng Việt + English · xử lý trên thiết bị';
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
let scriptPromise = null;
let workerPromise = null;
let worker = null;
let activeJob = null;
let generation = 0;
let idleTimer = null;

function abortError() {
  const error = new Error('Đã dừng nhận dạng. Bạn có thể chọn ảnh khác hoặc nhập thông tin trực tiếp.');
  error.name = 'AbortError';
  return error;
}

const STATUS = {
  'loading tesseract core': 'Đang tải bộ máy nhận dạng',
  'initializing tesseract': 'Đang khởi tạo OCR trên thiết bị',
  'loading language traineddata': 'Đang tải dữ liệu tiếng Việt và tiếng Anh',
  'initializing api': 'Đang chuẩn bị nhận dạng',
  'recognizing text': 'Đang nhận dạng văn bản trong ảnh',
};

function emit(status, progress) {
  if (!activeJob || activeJob.controller.signal.aborted) return;
  try { activeJob.onProgress?.({ status: STATUS[status] || status, progress: Math.max(0, Math.min(1, Number(progress) || 0)) }); }
  catch { /* A rendering callback must not interrupt OCR. */ }
}

function loadLibrary() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('tesseract.min.js', VENDOR).href;
    script.async = true;
    const timeout = setTimeout(() => {
      script.remove(); scriptPromise = null;
      reject(new Error('Không tải được bộ OCR. Hãy kiểm tra kết nối và thử lại; bạn vẫn có thể nhập thông tin trực tiếp.'));
    }, 30_000);
    script.onload = () => {
      clearTimeout(timeout);
      if (globalThis.Tesseract?.createWorker) resolve(globalThis.Tesseract);
      else { scriptPromise = null; reject(new Error('Bộ OCR chưa khởi tạo được. Hãy tải lại trang và thử lại.')); }
    };
    script.onerror = () => {
      clearTimeout(timeout); script.remove(); scriptPromise = null;
      reject(new Error('Không tải được bộ OCR. Hãy kiểm tra kết nối và thử lại.'));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

async function getWorker() {
  if (worker) return worker;
  if (workerPromise) return workerPromise;
  const version = generation;
  workerPromise = (async () => {
    const api = await loadLibrary();
    if (version !== generation) throw abortError();
    const instance = await api.createWorker(['vie', 'eng'], 1, {
      workerPath: new URL('worker.min.js', VENDOR).href,
      corePath: VENDOR.href,
      langPath: VENDOR.href,
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'write',
      cachePath: 'kbml-ocr-v1',
      logger: message => { if (version === generation) emit(message.status, message.progress); },
    });
    if (version !== generation) { await instance.terminate(); throw abortError(); }
    await instance.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
    if (version !== generation) { await instance.terminate(); throw abortError(); }
    worker = instance;
    return instance;
  })();
  const current = workerPromise;
  try { return await current; }
  catch (error) { if (workerPromise === current) workerPromise = null; throw error; }
}

async function prepareImage(file) {
  let bitmap;
  if (typeof createImageBitmap === 'function') bitmap = await createImageBitmap(file);
  else {
    const url = URL.createObjectURL(file);
    try {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
  try {
    const width = bitmap.width || bitmap.naturalWidth, height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height || width * height > MAX_PIXELS) throw new Error('Ảnh quá lớn hoặc không đọc được. Hãy chọn ảnh dưới 40 megapixel.');
    const scale = Math.min(1, 3200 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh. Hãy nhập thông tin trực tiếp.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { bitmap.close?.(); }
}

/** Recognize an image locally. confidence is Tesseract's actual 0–100 average.
 * It is an OCR score, not a calibrated probability or proof of document validity.
 * Result.fields only contains labels the parser can identify conservatively.
 */
export async function recognizeImage(file, onProgress = () => {}) {
  if (activeJob) throw new Error('Một ảnh đang được nhận dạng. Hãy chờ hoàn tất hoặc bấm Dừng.');
  if (!(file instanceof Blob)) throw new Error('Hãy chọn một tệp ảnh JPG, PNG hoặc WebP.');
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) throw new Error('OCR hiện hỗ trợ ảnh JPG, PNG và WebP. Với PDF, hãy lưu trang cần đọc thành ảnh; bản PDF vẫn có thể dùng để xem và đối chiếu.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Định dạng này chưa được hỗ trợ. Hãy chọn ảnh JPG, PNG hoặc WebP.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('Hãy chọn một ảnh có dung lượng từ 1 byte đến 12 MB.');
  if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ OCR trên thiết bị. Bạn vẫn có thể nhập và kiểm tra thông tin trực tiếp.');
  clearTimeout(idleTimer);
  const job = { controller: new AbortController(), onProgress };
  activeJob = job;
  const abortPromise = new Promise((_, reject) => job.controller.signal.addEventListener('abort', () => reject(abortError()), { once: true }));
  let canvas;
  const task = (async () => {
    emit('Đang kiểm tra ảnh', 0);
    try { canvas = await prepareImage(file); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('Ảnh quá lớn')) throw error;
      throw new Error('Không mở được ảnh. Hãy chọn ảnh JPG/PNG/WebP rõ nét, đúng định dạng.');
    }
    if (job.controller.signal.aborted) throw abortError();
    const engine = await getWorker();
    if (job.controller.signal.aborted) throw abortError();
    emit('recognizing text', 0);
    const result = await engine.recognize(canvas, {}, { text: true });
    if (job.controller.signal.aborted) throw abortError();
    const text = String(result?.data?.text || '').trim();
    const rawConfidence = Number(result?.data?.confidence);
    emit('Đã nhận dạng xong — hãy đối chiếu với ảnh gốc', 1);
    return { text, confidence: Number.isFinite(rawConfidence) ? rawConfidence : null, fields: extractFields(text), engine: ENGINE };
  })().finally(() => {
    if (job.controller.signal.aborted && canvas) { canvas.width = 1; canvas.height = 1; }
  });
  try { return await Promise.race([task, abortPromise]); }
  catch (error) {
    if (job.controller.signal.aborted || error?.name === 'AbortError') throw abortError();
    if (error instanceof Error && /^[A-ZÀ-ỸĐ][^]*[à-ỹđ]/.test(error.message)) throw error;
    throw new Error('OCR chưa đọc được ảnh này. Hãy thử ảnh rõ nét hơn hoặc nhập dữ liệu trực tiếp. Không có thông tin nào được tự điền khi nhận dạng thất bại.');
  } finally {
    if (activeJob === job) activeJob = null;
    if (canvas) { canvas.width = 1; canvas.height = 1; }
    if (!job.controller.signal.aborted) idleTimer = setTimeout(() => {
      if (activeJob) return;
      generation += 1; const old = worker; worker = null; workerPromise = null;
      old?.terminate().catch(() => {});
    }, 120_000);
  }
}

/** Cancels the current UI job and terminates an initialized recognition worker. */
export async function cancelRecognition() {
  clearTimeout(idleTimer);
  generation += 1;
  activeJob?.controller.abort();
  const previous = worker; worker = null; workerPromise = null;
  if (previous) { try { await previous.terminate(); } catch { /* already stopped */ } }
}

function fold(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); }

function validDate(year, month, day) {
  if (year < 1950 || year > 2150 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Conservative labeled-field extraction, independent of recognition or user data.
 * This helper never invents absent values and never treats reference/demo values as OCR.
 */
export function extractFields(text) {
  const result = {};
  const lines = String(text || '').normalize('NFC').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const pick = (pattern) => {
    for (const line of lines) {
      const match = fold(line).match(pattern);
      if (match) return line.slice(match.index + match[0].length).replace(/^[\s:：;=\-–]+/, '').trim();
    }
    return '';
  };
  const registration = pick(/\b(?:so\s*(?:dang\s*ky|d\.?k\.?)|registration\s*(?:no\.?|number))\s*[:：=]?\s*/i).match(/^([A-ZĐ]{1,5})[\s.\-–_/]*(\d{2,8})(?!\d)/iu);
  if (registration) result.registration = `${registration[1].toLocaleUpperCase('vi-VN')}-${registration[2]}`;
  const name = pick(/\b(?:ten\s+(?:phuong\s*tien|tau|sa\s*lan)|vessel\s*name)\s*[:：=]?\s*/i);
  if (name && name.length <= 140 && /\p{L}/u.test(name)) result.name = name;
  const number = pick(/\b(?:so\s+(?:giay\s*chung\s*nhan|chung\s*chi|chung\s*nhan)|certificate\s*(?:no\.?|number))\s*[:：=]?\s*/i);
  if (number && number.length <= 80 && /\d/.test(number)) result.number = number;
  const expiry = fold(pick(/\b(?:co\s*hieu\s*luc\s*(?:den|toi)|hieu\s*luc\s*den|ngay\s*het\s*han|het\s*han|valid\s*(?:until|to)|expiry\s*date|expiration\s*date)\s*[:：=]?\s*/i));
  let match = expiry.match(/\b(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
  let date = match ? validDate(+match[1], +match[2], +match[3]) : null;
  if (!match) { match = expiry.match(/\b(\d{1,2})\s*(?:[.\/-]|thang)\s*(\d{1,2})\s*(?:[.\/-]|nam)\s*(\d{4})\b/); if (match) date = validDate(+match[3], +match[2], +match[1]); }
  if (date) result.expiresOn = date;
  const capacity = fold(pick(/\b(?:trong\s*tai(?:\s*toan\s*phan)?|deadweight|dwt)\s*(?:\(\s*(?:tan|t|tonnes)\s*\))?\s*[:：=]?\s*/i));
  // Ambiguous grouped numbers are deliberately left for human entry.
  match = capacity.match(/^(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:tan|t\b|tonnes|$)/i);
  if (match) { const value = Number(match[1].replace(',', '.')); if (value > 0 && value < 1_000_000) result.capacity = value; }
  return result;
}
