/**
 * One-page research certificates, rendered from the current vessel/document data.
 * No network calls, external libraries, real signatures or official seals.
 * The PDF embeds the rendered JPEG so Vietnamese text remains readable on devices
 * without the same fonts. It is a visual reference, not a searchable original.
 */

const PAGE={width:1240,height:1754,pdfWidth:595.276,pdfHeight:841.89,margin:84};
const COLOR={navy:'#102d48',teal:'#0b7e7b',ink:'#18344a',muted:'#627887',line:'#dce5eb',pale:'#f4f8fa',red:'#963f35',redPale:'#fff5f1'};
const FONT='Arial, "Noto Sans", "Segoe UI", sans-serif';
const TYPES={
  registration:{title:'ĐĂNG KÝ PHƯƠNG TIỆN',tag:'HỒ SƠ ĐĂNG KÝ',note:'Thông tin phục vụ tra cứu và minh họa hồ sơ đăng ký. Bản mô phỏng không chứng minh quyền sở hữu và không thay thế giấy chứng nhận đăng ký phương tiện.'},
  technical:{title:'AN TOÀN KỸ THUẬT',tag:'HỒ SƠ KỸ THUẬT',note:'Bản mô phỏng chỉ trình bày thông tin đã khai báo. Nội dung này không xác nhận phương tiện đã kiểm định, đạt tiêu chuẩn an toàn hoặc được phép hoạt động.'},
  insurance:{title:'THÔNG TIN BẢO HIỂM',tag:'HỒ SƠ BẢO HIỂM',note:'Đây là thông tin tham chiếu của giấy tờ bảo hiểm. Phạm vi bảo hiểm, số tiền bảo hiểm và trách nhiệm bồi thường phải được đối chiếu với hợp đồng hoặc giấy tờ gốc.'},
  other:{title:'GIẤY TỜ THAM CHIẾU',tag:'TÀI LIỆU KHÁC',note:'Bản mô phỏng hỗ trợ xem và đối chiếu dữ liệu đã khai báo. Nội dung không xác nhận tính xác thực, hiệu lực pháp lý hoặc kết quả xử lý của bất kỳ cơ quan nào.'}
};

function plain(value,fallback='Chưa khai báo') {
  if(value===null||value===undefined||value==='')return fallback;
  return String(value).normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()||fallback;
}
function classify(type) {
  const value=plain(type,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
  if(value.includes('dang ky'))return TYPES.registration;
  if(value.includes('an toan')||value.includes('dang kiem')||value.includes('ky thuat'))return TYPES.technical;
  if(value.includes('bao hiem'))return TYPES.insurance;
  return TYPES.other;
}
function displayDate(value) {
  if(!value)return 'Chưa khai báo';
  const text=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)){
    const check=new Date(`${text}T00:00:00Z`);
    if(Number.isFinite(check.getTime())&&check.toISOString().slice(0,10)===text)return text.split('-').reverse().join('/');
  }
  // Preserve unusual input as text rather than silently normalizing a wrong date.
  return `${plain(value)} (cần đối chiếu)`;
}
function displayNumber(value,unit) {
  if(value===null||value===undefined||value===''||(typeof value==='string'&&!value.trim()))return 'Chưa khai báo';
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)return 'Chưa xác minh';
  return `${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n)}${unit?` ${unit}`:''}`;
}
function slug(value,fallback) {
  return plain(value,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,64)||fallback;
}
function makeCanvas() {
  if(globalThis.document?.createElement)return document.createElement('canvas');
  if(typeof globalThis.OffscreenCanvas==='function')return new OffscreenCanvas(PAGE.width,PAGE.height);
  throw new Error('Trình duyệt chưa hỗ trợ tạo bản PDF mô phỏng.');
}
function setFont(ctx,size=28,weight=400) {ctx.font=`${weight} ${size}px ${FONT}`;}

/** Split oversized tokens as well as normal words; cap every field to its box. */
function linesWithin(ctx,value,width,maxLines) {
  const original=plain(value),source=original.slice(0,1600);
  const tokens=[];
  for(const word of source.split(' ')){
    if(ctx.measureText(word).width<=width){tokens.push(word);continue;}
    let chunk='';
    for(const char of word){if(chunk&&ctx.measureText(chunk+char).width>width){tokens.push(chunk);chunk=char;}else chunk+=char;}
    if(chunk)tokens.push(chunk);
  }
  const lines=[];let line='';
  for(const word of tokens){const candidate=line?`${line} ${word}`:word;if(line&&ctx.measureText(candidate).width>width){lines.push(line);line=word;}else line=candidate;}
  if(line)lines.push(line);
  const truncated=lines.length>maxLines||source.length<original.length;
  const visible=lines.slice(0,maxLines);
  if(truncated&&visible.length){let last=visible[visible.length-1];while(last&&ctx.measureText(`${last}…`).width>width)last=last.slice(0,-1);visible[visible.length-1]=`${last}…`;}
  return {lines:visible,truncated};
}
function paragraph(ctx,value,x,y,width,{size=26,weight=400,color=COLOR.ink,lineHeight=32,maxLines=2}={}) {
  ctx.fillStyle=color;setFont(ctx,size,weight);
  const result=linesWithin(ctx,value,width,maxLines);
  result.lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));
  return result.truncated;
}
function border(ctx,x,y,width,height,fill='#fff') {
  ctx.fillStyle=fill;ctx.fillRect(x,y,width,height);
  ctx.strokeStyle=COLOR.line;ctx.lineWidth=1.5;ctx.strokeRect(x,y,width,height);
}
function brandMark(ctx,x,y) {
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#99dfd5';
  ctx.beginPath();ctx.moveTo(1,37);ctx.lineTo(59,37);ctx.lineTo(47,55);ctx.lineTo(16,55);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(25,1);ctx.lineTo(25,31);ctx.lineTo(1,31);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(32,10);ctx.lineTo(58,31);ctx.lineTo(32,31);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#99dfd5';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,64);ctx.bezierCurveTo(12,55,18,72,30,64);ctx.bezierCurveTo(42,55,48,72,60,64);ctx.stroke();ctx.restore();
}

async function renderCertificate(vessel,doc) {
  const canvas=makeCanvas();canvas.width=PAGE.width;canvas.height=PAGE.height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Không tạo được khung vẽ PDF.');
  const W=PAGE.width,H=PAGE.height,M=PAGE.margin,CW=W-M*2,type=classify(doc.type);
  let clipped=false;
  ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=COLOR.navy;ctx.fillRect(0,0,W,214);
  ctx.fillStyle=COLOR.teal;ctx.fillRect(0,207,W,7);
  brandMark(ctx,M,39);
  paragraph(ctx,'KBML',M+80,74,420,{size:42,weight:700,color:'#fff',maxLines:1});
  paragraph(ctx,'CẦN GIỜ  /  NHÓM 308',M+81,104,500,{size:20,weight:600,color:'#b9d6e2',maxLines:1});
  ctx.fillStyle='#22485f';ctx.fillRect(W-M-264,46,264,51);
  paragraph(ctx,type.tag,W-M-246,79,232,{size:18,weight:700,color:'#cae9e4',maxLines:1});
  paragraph(ctx,type.title,M,163,CW,{size:44,weight:700,color:'#fff',maxLines:1});
  paragraph(ctx,'Bản trình bày từ dữ liệu đang lưu trong KBML',M,193,CW,{size:21,color:'#bfd1de',maxLines:1});

  border(ctx,M,242,CW,96,COLOR.redPale);
  ctx.fillStyle=COLOR.red;ctx.fillRect(M,242,6,96);
  paragraph(ctx,'MÔ PHỎNG - KHÔNG CÓ GIÁ TRỊ PHÁP LÝ',M+24,280,CW-48,{size:27,weight:700,color:COLOR.red,maxLines:1});
  paragraph(ctx,'Không thay thế giấy tờ gốc hoặc xác nhận của cơ quan có thẩm quyền.',M+24,313,CW-48,{size:21,color:COLOR.red,maxLines:1});

  const section=(label,y)=>paragraph(ctx,label,M,y,CW,{size:23,weight:700,color:COLOR.teal,maxLines:1});
  const field=(label,value,x,y,width,height,opts={})=>{
    border(ctx,x,y,width,height,opts.fill||'#fff');
    paragraph(ctx,label,x+22,y+28,width-44,{size:18,weight:600,color:COLOR.muted,maxLines:1});
    clipped=paragraph(ctx,value,x+22,y+(opts.valueY||62),width-44,{size:opts.size||27,weight:opts.weight||600,color:COLOR.ink,lineHeight:opts.lineHeight||31,maxLines:opts.maxLines||2})||clipped;
  };
  section('THÔNG TIN GIẤY TỜ',386);
  field('Loại giấy tờ',plain(doc.type),M,406,CW*.52,112);
  field('Số giấy tờ (đã khai báo)',plain(doc.number),M+CW*.52,406,CW*.48,112);
  field('Ngày cấp (đã khai báo)',displayDate(doc.issuedOn),M,518,CW/2,92,{maxLines:1,size:27});
  field('Có hiệu lực đến (đã khai báo)',displayDate(doc.expiresOn),M+CW/2,518,CW/2,92,{maxLines:1,size:27});

  section('PHƯƠNG TIỆN THAM CHIẾU',650);
  field('Tên phương tiện',plain(vessel.name),M,672,CW,112,{size:32,lineHeight:36});
  field('Số đăng ký phương tiện',plain(vessel.registration),M,784,CW*.62,100);
  field('Cấp phương tiện',plain(vessel.grade),M+CW*.62,784,CW*.38,100);
  field('Chủ phương tiện / đơn vị sở hữu',plain(vessel.owner),M,884,CW,126,{size:26,maxLines:3,lineHeight:30,valueY:56});
  field('Loại phương tiện',plain(vessel.kind),M,1010,CW*.62,100,{size:26});
  field('Thông tin liên hệ',plain(vessel.phone),M+CW*.62,1010,CW*.38,100,{size:26});

  section('THÔNG SỐ ĐÃ KHAI BÁO',1158);
  const col=CW/3;
  field('Chiều dài',displayNumber(vessel.length,'m'),M,1178,col,96,{maxLines:1,size:28});
  field('Chiều rộng',displayNumber(vessel.width,'m'),M+col,1178,col,96,{maxLines:1,size:28});
  field('Mớn nước',displayNumber(vessel.draft,'m'),M+col*2,1178,col,96,{maxLines:1,size:28});
  field('Trọng tải',displayNumber(vessel.capacity,'tấn'),M,1274,col,96,{maxLines:1,size:28});
  field('Sức chở TEU (nếu có)',displayNumber(vessel.capacityTeu,'TEU'),M+col,1274,col,96,{maxLines:1,size:28});
  field('MMSI (nếu có)',plain(vessel.mmsi),M+col*2,1274,col,96,{maxLines:1,size:26});

  border(ctx,M,1410,CW,168,COLOR.pale);
  paragraph(ctx,'MỤC ĐÍCH SỬ DỤNG',M+24,1444,CW-48,{size:20,weight:700,color:COLOR.teal,maxLines:1});
  paragraph(ctx,type.note,M+24,1480,CW-48,{size:22,lineHeight:31,maxLines:3,color:COLOR.muted});

  // A visual watermark distinguishes a research view from an original document.
  ctx.save();ctx.translate(W/2,977);ctx.rotate(-Math.PI/7);ctx.globalAlpha=.045;
  ctx.fillStyle=COLOR.teal;setFont(ctx,148,700);ctx.textAlign='center';ctx.fillText('MÔ PHỎNG',0,0);ctx.restore();
  paragraph(ctx,'Nguồn: thông tin phương tiện và giấy tờ hiện tại trong bản mẫu KBML.',M,1614,CW,{size:20,color:COLOR.muted,maxLines:1});
  if(clipped)paragraph(ctx,'Một số trường dài được rút gọn. Xem nội dung đầy đủ trong hồ sơ trên KBML.',M,1644,CW,{size:19,color:COLOR.muted,maxLines:1});
  ctx.strokeStyle=COLOR.line;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(M,1676);ctx.lineTo(W-M,1676);ctx.stroke();
  const generated=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  paragraph(ctx,`Tạo bản xem: ${generated} (giờ Việt Nam)`,M,1710,CW-150,{size:19,color:COLOR.muted,maxLines:1});
  ctx.fillStyle=COLOR.muted;setFont(ctx,19,600);ctx.textAlign='right';ctx.fillText('TRANG 1 / 1',W-M,1710);ctx.textAlign='left';
  return canvas;
}

async function jpegBlob(canvas) {
  let blob;
  if(typeof canvas.convertToBlob==='function')blob=await canvas.convertToBlob({type:'image/jpeg',quality:.94});
  else blob=await new Promise((resolve,reject)=>{
    try{canvas.toBlob(result=>result?resolve(result):reject(new Error('Không xuất được ảnh xem trước.')),'image/jpeg',.94);}catch(error){reject(error);}
  });
  if(!blob||blob.type!=='image/jpeg')throw new Error('Trình duyệt chưa hỗ trợ xuất ảnh JPEG cho PDF.');
  return blob;
}
function jpegInfo(bytes) {
  if(bytes[0]!==255||bytes[1]!==216)throw new Error('Ảnh xem trước không phải JPEG hợp lệ.');
  let offset=2;
  while(offset+3<bytes.length){
    if(bytes[offset]!==255){offset++;continue;}
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===217||marker===218)break;
    if(marker===1||(marker>=208&&marker<=215))continue;
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length)break;
    if(marker>=192&&marker<=207&&![196,200,204].includes(marker)){
      const info={height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6],channels:bytes[offset+7]};
      if(bytes[offset+2]!==8||!info.width||!info.height||![1,3].includes(info.channels))break;
      return info;
    }
    offset+=length;
  }
  throw new Error('Không đọc được kích thước ảnh JPEG.');
}
async function imagePdf(preview) {
  const bytes=new Uint8Array(await preview.arrayBuffer()),info=jpegInfo(bytes),encoder=new TextEncoder();
  const parts=[],offsets=[0];let length=0;
  const put=value=>{const data=typeof value==='string'?encoder.encode(value):value;parts.push(data);length+=data.byteLength;};
  const object=(id,content)=>{offsets[id]=length;put(`${id} 0 obj\n${content}\nendobj\n`);};
  put('%PDF-1.4\n');put(new Uint8Array([37,226,227,207,211,10]));
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.pdfWidth} ${PAGE.pdfHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const commands=`q\n${PAGE.pdfWidth} 0 0 ${PAGE.pdfHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  object(4,`<< /Length ${encoder.encode(commands).byteLength} >>\nstream\n${commands}endstream`);
  offsets[5]=length;
  put(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${info.channels===1?'/DeviceGray':'/DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.byteLength} >>\nstream\n`);
  put(bytes);put('\nendstream\nendobj\n');
  object(6,'<< /Title (KBML - Research document simulation) /Creator (KBML Can Gio - Group 308) /Producer (KBML browser canvas PDF) >>');
  const xref=length;
  put('xref\n0 7\n0000000000 65535 f \n');
  for(let id=1;id<=6;id++)put(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
  put(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:'application/pdf'});
}

/**
 * @param {object} vessel Current vessel record from data.js.
 * @param {object} doc Current paper record: type, number, issuedOn, expiresOn.
 * @returns {Promise<{blob: Blob, previewBlob: Blob, fileName: string, pageCount: 1}>}
 */
export async function createCertificatePdf(vessel,doc) {
  if(!vessel||typeof vessel!=='object'||!doc||typeof doc!=='object')throw new Error('Chưa có thông tin phương tiện hoặc giấy tờ để tạo bản mô phỏng.');
  // Wait for locally available font faces only; this module never requests a font.
  if(globalThis.document?.fonts?.ready)await document.fonts.ready;
  const canvas=await renderCertificate(vessel,doc);
  const previewBlob=await jpegBlob(canvas);
  const blob=await imagePdf(previewBlob);
  return {blob,previewBlob,fileName:`KBML_MO-PHONG_${slug(doc.type,'giay-to')}_${slug(vessel.registration||vessel.name,'phuong-tien')}.pdf`,pageCount:1};
}
