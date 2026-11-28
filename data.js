/** Browser-local KBML research data. All seeded records are fictional.
 * Administrative review and operational voyage stages are deliberately separate.
 */
export const STATUS = Object.freeze({draft:'Bản nháp',submitted:'Đã ghi nhận',reviewing:'Đang đối chiếu',supplement:'Cần cập nhật',verified:'Đã đối chiếu',archived:'Đã lưu trữ'});
export const STAGES = Object.freeze({planned:'Dự kiến đến',berthed:'Đã cập bến',loading:'Đang làm hàng',completed:'Hoàn tất làm hàng',departed:'Đã rời bến'});
export const PORTS = Object.freeze(['Bến mẫu Đồng Tranh','Bến mẫu Gò Gia','Bến mẫu Cái Mép','Bến mẫu Thị Vải']);
export const CARGOS = Object.freeze(['Cát xây dựng','Đá xây dựng','Clinker','Thép cuộn','Phân bón','Lúa gạo','Xi măng','Hàng khác']);
export const STORAGE_KEY = 'kbml.can-gio.v2.state';
const DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
let memoryState = null;
let sequence = 0;
const asDate = value => value instanceof Date ? value : new Date(value ?? Date.now());
const validTime = value => value !== null && value !== undefined && value !== '' && Number.isFinite(new Date(value).getTime());
const clean = value => String(value ?? '').trim();
const number = value => (typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '') ? NaN : Number(value);
const optionalNumber = value => value === '' || value === null || value === undefined ? 0 : number(value);
const owns = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const normalizeRegistration = value => clean(value).normalize('NFC').toUpperCase().replace(/[\s.\-/]+/g,'');
const iso = value => asDate(value).toISOString();
export function localDate(value = new Date()) {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(part => parts.find(p => p.type === part)?.value).join('-');
}
function localStart(value) {return new Date(`${localDate(value)}T00:00:00+07:00`).getTime();}
function validDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(d.getTime()) && localDate(d) === value;
}
export function uid(prefix = 'id') {
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  return `${prefix}-${token}`;
}
function audit(state,action,entityId,actor = 'Người dùng mô phỏng',note = '') {
  const row = {id:uid('log'),at:iso(new Date()),action,entityId,actor:clean(actor),note:clean(note)};
  state.logs.unshift(row);
  return row;
}

/** Return cargo movements without conflating a vessel's unloading and loading.
 * Legacy records with one operation remain readable; cargoEntries is authoritative
 * when explicitly present. Returned entries are copies, not references to state.
 */
export function cargoEntriesFor(record) {
  const entries=Array.isArray(record.cargoEntries)?record.cargoEntries:[record];
  return entries.map(entry=>({operation:entry?.operation||'unload',cargoType:clean(entry?.cargoType),cargoTons:number(entry?.cargoTons),cargoTeu:optionalNumber(entry?.cargoTeu),containers:optionalNumber(entry?.containers)}));
}
function cargoErrors(entries,vessel) {
  const errors=[],operations=new Set();
  if(!Array.isArray(entries)||entries.length<1||entries.length>2)return ['Khai báo một hoặc hai hoạt động hàng hóa: dỡ hàng và/hoặc xếp hàng.'];
  for(const entry of entries) {
    if(!entry||typeof entry!=='object'){errors.push('Dòng hàng hóa không hợp lệ.');continue;}
    const operation=entry.operation||'unload';
    if(!['load','unload'].includes(operation))errors.push('Hoạt động hàng hóa không hợp lệ.');
    if(operations.has(operation))errors.push('Mỗi chuyến chỉ có một dòng tổng hợp cho mỗi hoạt động xếp hoặc dỡ.');
    operations.add(operation);
    if(!clean(entry.cargoType))errors.push('Vui lòng chọn loại hàng hóa hoặc khai báo không hàng.');
    const tons=number(entry.cargoTons);
    if(!Number.isFinite(tons)||tons<0)errors.push('Khối lượng hàng phải là số không âm.');
    else if(vessel&&tons>number(vessel.capacity))errors.push('Khối lượng khai báo vượt trọng tải phương tiện. Vui lòng kiểm tra lại.');
    for(const [key,label] of [['cargoTeu','Khối lượng TEU'],['containers','Số container']]) {
      const quantity=optionalNumber(entry[key]);
      if(!Number.isInteger(quantity)||quantity<0)errors.push(`${label} phải là số nguyên không âm.`);
    }
    if(vessel&&number(vessel.capacityTeu)>0&&optionalNumber(entry.cargoTeu)>number(vessel.capacityTeu))errors.push('Số TEU của hoạt động vượt sức chở TEU đã khai báo của phương tiện.');
  }
  return [...new Set(errors)];
}
function assignCargo(record,entries) {
  record.cargoEntries=cargoEntriesFor({cargoEntries:entries});
  // Keep the first operation in legacy fields for existing forms/readouts.
  Object.assign(record,record.cargoEntries[0]);
  return record;
}

export function createSeed(now = new Date()) {
  now = asDate(now);
  const today = localStart(now);
  const at = (days,hour = 8,minute = 0) => iso(today - days*DAY + hour*3600000 + minute*60000);
  const date = days => localDate(now.getTime() + days*DAY);
  const names = ['Minh Hải 08','An Phú 36','Trường An 12','Nam Phương 18','Đồng Tâm 05','Hoàng Long 22','Bình Minh 09','Đại Thành 16','Phú An 03','Hải Đăng 27'];
  const capacities = [1500,1200,1800,1000,2200,1600,900,2000,1400,1700];
  const expires = [143,12,68,-4,240,25,-12,93,178,51];
  const state = {version:1,createdAt:iso(now),vessels:[],voyages:[],declarations:[],logs:[],settings:{demo:true,timezone:'Asia/Ho_Chi_Minh',expiryWarningDays:30}};
  state.vessels = names.map((name,i) => ({
    id:`v-${String(i+1).padStart(3,'0')}`,name,registration:`DEMO-CG-${String(i+1).padStart(3,'0')}`,
    grade:['VR-SI','VR-SII','VR-SIII'][i%3],kind:'Sà lan tự hành',owner:`Đơn vị vận tải mẫu ${String.fromCharCode(65+i)}`,phone:'',mmsi:'',capacityTeu:0,
    capacity:capacities[i],length:48+i*2,width:9+(i%4),draft:2.6+(i%3)*0.3,
    createdAt:at(90),updatedAt:at(3+i),
    docs:[{id:`doc-${i+1}-reg`,type:'Đăng ký phương tiện',number:`DK-MAU-${String(i+1).padStart(3,'0')}`,issuedOn:date(-350),expiresOn:null},
      {id:`doc-${i+1}-tech`,type:'An toàn kỹ thuật',number:`ATKT-MAU-${String(i+1).padStart(3,'0')}`,issuedOn:date(-120),expiresOn:date(expires[i])}],
    crew:[{id:`crew-${i+1}`,name:`Thuyền trưởng mẫu ${String.fromCharCode(65+i)}`,role:'Thuyền trưởng',certificateNo:`CC-MAU-${String(i+1).padStart(3,'0')}`,expiresOn:date(i===7?-2:180+i*8)}],
    note:'Phương tiện và hồ sơ giả lập phục vụ nghiên cứu.'
  }));
  let dCount=0;
  const declaration=(voyage,direction,status,createdAt,minutes=18) => {
    const id=`d-${String(++dCount).padStart(3,'0')}`;
    const submittedAt=status==='draft'?null:iso(new Date(createdAt).getTime()+3*60000);
    const completedAt=['verified','archived'].includes(status)?iso(new Date(createdAt).getTime()+minutes*60000):null;
    const history=[{at:createdAt,action:'Tạo hồ sơ mẫu',actor:'Nhóm 308',note:'Dữ liệu giả lập'}];
    if(submittedAt)history.push({at:submittedAt,action:'Gửi thông tin',actor:'Người khai báo mẫu',note:''});
    if(completedAt)history.push({at:completedAt,action:'Hoàn tất đối chiếu',actor:'Cán bộ mô phỏng',note:'Kịch bản đối chiếu dữ liệu mẫu; không có giá trị pháp lý.'});
    if(status==='supplement')history.push({at:iso(new Date(createdAt).getTime()+12*60000),action:'Yêu cầu cập nhật thông tin',actor:'Cán bộ mô phỏng',note:'Đề nghị làm rõ thông tin giấy chứng nhận và lịch trình.'});
    return {id,code:`KB-${localDate(createdAt).replaceAll('-','').slice(2)}-${String(dCount).padStart(3,'0')}`,vesselId:voyage.vesselId,voyageId:voyage.id,direction,status,createdAt,submittedAt,completedAt,updatedAt:completedAt||submittedAt||createdAt,reusedData:dCount%4!==1,notes:status==='supplement'?'Cần kiểm tra lại thông tin giấy chứng nhận.':'Hồ sơ mẫu phục vụ trình diễn.',attachments:[],history};
  };
  for(let i=0;i<16;i++) {
    const days=[24,22,20,18,16,14,12,10,8,7,6,5,4,3,2,1][i];
    const vessel=state.vessels[i%10];
    const voyage={id:`voy-${String(i+1).padStart(3,'0')}`,vesselId:vessel.id,port:PORTS[i%4],berth:`Cầu ${String(i%3+1).padStart(2,'0')}`,origin:['Bến mẫu Long An','Bến mẫu Đồng Nai','Bến mẫu Tiền Giang'][i%3],destination:'Bến mẫu kế tiếp',eta:at(days,6),etd:at(days,18),arrivedAt:at(days,7,i%4*10),cargoStartAt:at(days,8),cargoEndAt:at(days,14,i%3*15),departedAt:at(days,16,i%4*10),stage:'departed',cargoType:CARGOS[i%6],cargoTons:Math.round(vessel.capacity*(0.52+(i%4)*0.08)),cargoTeu:0,containers:0,operation:i%2?'load':'unload',notes:'Chuyến dữ liệu mẫu; địa điểm giả lập.'};
    assignCargo(voyage,[voyage]);state.voyages.push(voyage);
    state.declarations.push(declaration(voyage,'arrival',i<8?'archived':'verified',at(days,5),14+i%7*3));
    if(i>=8)state.declarations.push(declaration(voyage,'departure','verified',at(days,15),12+i%5*4));
  }
  const activeStages=['planned','berthed','loading','completed','loading','berthed'];
  const statuses=['draft','submitted','reviewing','verified','supplement','submitted'];
  activeStages.forEach((stage,i)=>{
    const vessel=state.vessels[i],base=now.getTime()-(i+4)*3600000;
    const milestone=(hours)=>iso(base+hours*3600000);
    const voyage={id:`voy-${String(i+17).padStart(3,'0')}`,vesselId:vessel.id,port:PORTS[i%4],berth:`Cầu ${String(i%3+1).padStart(2,'0')}`,origin:'Bến mẫu Long An',destination:'Bến mẫu Đồng Nai',eta:stage==='planned'?iso(now.getTime()+4*3600000):milestone(-1),etd:iso(now.getTime()+(8+i)*3600000),arrivedAt:stage==='planned'?null:milestone(0),cargoStartAt:['loading','completed'].includes(stage)?milestone(1):null,cargoEndAt:stage==='completed'?milestone(3):null,departedAt:null,stage,cargoType:CARGOS[(i+2)%6],cargoTons:Math.round(vessel.capacity*0.65),cargoTeu:0,containers:0,operation:i%2?'load':'unload',notes:'Chuyến đang hoạt động trong bộ dữ liệu mô phỏng.'};
    assignCargo(voyage,[voyage]);state.voyages.push(voyage);
    state.declarations.push(declaration(voyage,'arrival',statuses[i],milestone(-2),22));
  });
  state.declarations.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  state.logs=[{id:'log-demo-initial',at:iso(now),action:'Khởi tạo dữ liệu mẫu',entityId:'demo',actor:'Nhóm 308',note:'10 phương tiện, 22 chuyến, 30 hồ sơ. Thời gian chỉ được tạo khi bắt đầu hoặc đặt lại bộ dữ liệu.'}];
  return state;
}

function isState(state) {
  return state && state.version===1 && ['vessels','voyages','declarations','logs'].every(k=>Array.isArray(state[k]));
}
export function saveState(state) {
  if(!isState(state))throw new Error('Cấu trúc dữ liệu không hợp lệ.');
  memoryState=clone(state);
  try {globalThis.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}
  catch {return false;}
}
export function loadState() {
  try {
    const raw=globalThis.localStorage.getItem(STORAGE_KEY);
    if(raw) {
      try {
        const parsed=JSON.parse(raw);
        if(!isState(parsed))throw new Error('version');
        parsed.settings??={};memoryState=clone(parsed);return parsed;
      } catch {
        try{globalThis.localStorage.setItem(`${STORAGE_KEY}.recovery`,raw);}catch{}
        const recovered=createSeed();
        recovered.settings.storageNotice='Dữ liệu lưu trước đó không đọc được. Đang mở bộ dữ liệu mẫu; bản gốc được giữ trong mục khôi phục nếu trình duyệt cho phép.';
        memoryState=clone(recovered);return recovered;
      }
    }
  } catch {
    if(memoryState)return clone(memoryState);
    const fresh=createSeed();fresh.settings.storageNotice='Trình duyệt không cho phép lưu bền vững. Hãy xuất bản sao dữ liệu trước khi đóng trang.';memoryState=clone(fresh);return fresh;
  }
  if(memoryState)return clone(memoryState);
  const state=createSeed();saveState(state);return state;
}
export function resetState() {const state=createSeed();saveState(state);return state;}

export function upsertVessel(state,input) {
  const existing=input.id?state.vessels.find(v=>v.id===input.id):null;
  if(input.id&&!existing)throw new Error('Không tìm thấy phương tiện cần cập nhật.');
  const value={...(existing||{}),...input};
  const registration=clean(value.registration).toUpperCase(),name=clean(value.name);
  if(!registration||!name)throw new Error('Vui lòng nhập số đăng ký và tên phương tiện.');
  if(!['VR-SI','VR-SII','VR-SIII'].includes(value.grade))throw new Error('Mô hình nghiên cứu dành cho phương tiện VR-SI, VR-SII và VR-SIII.');
  if(!Number.isFinite(number(value.capacity))||number(value.capacity)<=0)throw new Error('Trọng tải phải là số lớn hơn 0.');
  if(state.vessels.some(v=>v.id!==value.id&&normalizeRegistration(v.registration)===normalizeRegistration(registration)))throw new Error('Số đăng ký này đã tồn tại. Hãy sử dụng hồ sơ phương tiện đã lưu.');
  if(value.docs!==undefined&&!Array.isArray(value.docs))throw new Error('Danh sách giấy tờ không hợp lệ.');
  if(value.crew!==undefined&&!Array.isArray(value.crew))throw new Error('Danh sách thuyền viên không hợp lệ.');
  const vessel={...value,id:existing?.id||uid('v'),name,registration,grade:value.grade,kind:clean(value.kind)||'Sà lan tự hành',owner:clean(value.owner),phone:clean(value.phone),mmsi:clean(value.mmsi),capacityTeu:optionalNumber(value.capacityTeu),capacity:number(value.capacity),length:optionalNumber(value.length),width:optionalNumber(value.width),draft:optionalNumber(value.draft),docs:clone(value.docs||[]),crew:clone(value.crew||[]),createdAt:existing?.createdAt||iso(new Date()),updatedAt:iso(new Date()),note:clean(value.note)};
  if([vessel.length,vessel.width,vessel.draft].some(n=>!Number.isFinite(n)||n<0))throw new Error('Kích thước phương tiện không được âm.');
  if(!Number.isInteger(vessel.capacityTeu)||vessel.capacityTeu<0)throw new Error('Sức chở TEU phải là số nguyên không âm.');
  if(existing)Object.assign(existing,vessel);else state.vessels.push(vessel);
  audit(state,existing?'Cập nhật phương tiện':'Tạo phương tiện',vessel.id,'Người khai báo mô phỏng',registration);
  saveState(state);return existing||vessel;
}

export function validateDeclaration(input,state) {
  const errors=[];
  const vessel=state.vessels.find(v=>v.id===input.vesselId);
  if(!vessel)errors.push('Vui lòng chọn phương tiện đã lưu.');
  if(!['arrival','departure'].includes(input.direction))errors.push('Loại khai báo không hợp lệ.');
  if(input.status&&!['draft','submitted'].includes(input.status))errors.push('Thông tin mới chỉ có thể lưu nháp hoặc gửi ghi nhận.');
  if(owns(input,'cargoEntries'))errors.push(...cargoErrors(input.cargoEntries,vessel));
  if(input.direction==='departure') {
    const voyage=state.voyages.find(v=>v.id===input.voyageId);
    if(!voyage||voyage.vesselId!==input.vesselId)errors.push('Vui lòng chọn đúng chuyến đến của phương tiện này.');
    else {
      if(voyage.stage==='departed')errors.push('Chuyến này đã rời bến.');
      if(voyage.stage==='planned'||!voyage.arrivedAt)errors.push('Chuyến chưa được ghi nhận cập bến.');
      if(state.declarations.some(d=>d.voyageId===voyage.id&&d.direction==='departure'))errors.push('Chuyến này đã có hồ sơ rời cảng.');
      if(input.etd&&!validTime(input.etd))errors.push('Thời gian dự kiến rời không hợp lệ.');
      if(validTime(input.etd)&&validTime(voyage.arrivedAt)&&new Date(input.etd)<new Date(voyage.arrivedAt))errors.push('Thời gian dự kiến rời phải sau thời gian cập bến.');
      if(!owns(input,'cargoEntries'))errors.push(...cargoErrors(cargoEntriesFor(voyage),vessel));
    }
  } else if(input.direction==='arrival') {
    if(state.voyages.some(v=>v.vesselId===input.vesselId&&v.stage!=='departed'))errors.push('Phương tiện đang có chuyến chưa kết thúc. Hãy cập nhật chuyến hiện tại.');
    if(!clean(input.port))errors.push('Vui lòng chọn bến dự kiến.');
    if(!validTime(input.eta))errors.push('Vui lòng nhập thời gian dự kiến đến hợp lệ.');
    if(!validTime(input.etd))errors.push('Vui lòng nhập thời gian dự kiến rời hợp lệ.');
    if(validTime(input.eta)&&validTime(input.etd)&&new Date(input.etd)<=new Date(input.eta))errors.push('Thời gian dự kiến rời phải sau thời gian dự kiến đến.');
    if(!owns(input,'cargoEntries'))errors.push(...cargoErrors([input],vessel));
  }
  return errors;
}
export function createDeclaration(state,input) {
  const errors=validateDeclaration(input,state);if(errors.length)throw new Error(errors.join('\n'));
  const now=iso(new Date());
  const reusedData=state.declarations.some(d=>d.vesselId===input.vesselId);
  let voyage;
  if(input.direction==='arrival') {
    voyage={id:uid('voy'),vesselId:input.vesselId,port:clean(input.port),berth:clean(input.berth),origin:clean(input.origin),destination:clean(input.destination),eta:iso(input.eta),etd:iso(input.etd),arrivedAt:null,cargoStartAt:null,cargoEndAt:null,departedAt:null,stage:'planned',notes:clean(input.notes)};
    assignCargo(voyage,owns(input,'cargoEntries')?input.cargoEntries:[input]);
    state.voyages.unshift(voyage);
  } else {
    voyage=state.voyages.find(v=>v.id===input.voyageId);
    if(validTime(input.etd))voyage.etd=iso(input.etd);
    if(clean(input.destination))voyage.destination=clean(input.destination);
    if(owns(input,'cargoEntries'))assignCargo(voyage,input.cargoEntries);
  }
  const status=input.status||'submitted';
  let next=state.declarations.length+1;
  let code=`KB-${localDate(now).replaceAll('-','').slice(2)}-${String(next).padStart(3,'0')}`;
  while(state.declarations.some(d=>d.code===code)){code=`KB-${localDate(now).replaceAll('-','').slice(2)}-${String(++next).padStart(3,'0')}`;}
  const declaration={id:uid('d'),code,vesselId:input.vesselId,voyageId:voyage.id,direction:input.direction,status,createdAt:now,submittedAt:status==='draft'?null:now,completedAt:null,updatedAt:now,reusedData,notes:clean(input.notes),attachments:clone(input.attachments||[]),history:[{at:now,action:status==='draft'?'Lưu bản nháp':'Gửi thông tin',actor:'Người khai báo mô phỏng',note:clean(input.notes)}]};
  state.declarations.unshift(declaration);audit(state,status==='draft'?'Lưu bản nháp':'Gửi hồ sơ',declaration.id,'Người khai báo mô phỏng',code);saveState(state);
  return {declaration,voyage};
}

const transitions={draft:['submitted'],submitted:['reviewing'],reviewing:['supplement','verified'],supplement:['submitted'],verified:['archived'],archived:[]};
export function transitionDeclaration(state,id,next,note='',actor='Cán bộ mô phỏng') {
  const d=state.declarations.find(row=>row.id===id);
  if(!d)throw new Error('Không tìm thấy hồ sơ.');
  if(!transitions[d.status]?.includes(next))throw new Error('Không thể chuyển trạng thái theo trình tự này.');
  if(next==='supplement'&&!clean(note))throw new Error('Vui lòng ghi rõ nội dung cần cập nhật.');
  if(next==='verified'&&!clean(note))throw new Error('Vui lòng ghi nhận kết quả đối chiếu trước khi hoàn tất.');
  const now=iso(new Date());
  if(next==='submitted'&&!d.submittedAt)d.submittedAt=now;
  if(next==='verified')d.completedAt=now;
  d.status=next;d.updatedAt=now;
  d.history??=[];d.history.push({at:now,action:STATUS[next],actor:clean(actor),note:clean(note)});
  audit(state,STATUS[next],d.id,actor,note);saveState(state);return d;
}
const stageFields={berthed:'arrivedAt',loading:'cargoStartAt',completed:'cargoEndAt',departed:'departedAt'};
export function advanceVoyage(state,id,next,actor='Điều độ cảng mô phỏng',at=new Date()) {
  const voyage=state.voyages.find(v=>v.id===id);
  if(!voyage)throw new Error('Không tìm thấy chuyến.');
  const stages=Object.keys(STAGES),pos=stages.indexOf(voyage.stage);
  if(stages[pos+1]!==next)throw new Error('Vui lòng ghi nhận các mốc chuyến theo đúng trình tự.');
  if(!validTime(at))throw new Error('Thời điểm ghi nhận không hợp lệ.');
  const time=asDate(at).getTime();
  const previous=stageFields[voyage.stage]&&voyage[stageFields[voyage.stage]];
  if(previous&&time<new Date(previous).getTime())throw new Error('Thời điểm mới không được trước mốc vận hành đã ghi nhận.');
  if(time>Date.now()+60000)throw new Error('Mốc thực tế không thể nằm trong tương lai.');
  voyage[stageFields[next]]=iso(at);voyage.stage=next;
  audit(state,STAGES[next],voyage.id,actor,`${voyage.port} · ${voyage.berth}`);saveState(state);return voyage;
}

export function alertsFor(state,now=new Date()) {
  const today=localDate(now),todayMs=new Date(`${today}T00:00:00+07:00`).getTime();
  const warningDays=Number(state.settings?.expiryWarningDays)||30;
  const result=[];
  for(const vessel of state.vessels) {
    const documents=[...(vessel.docs||[]),...(vessel.crew||[]).map(person=>({id:`crew-${person.id}`,type:`Chứng chỉ ${person.role||'thuyền viên'} ${person.name||''}`.trim(),number:person.certificateNo,expiresOn:person.expiresOn}))];
    for(const doc of documents) {
      if(!doc.expiresOn)continue;
      if(!validDateOnly(doc.expiresOn)) {
        result.push({id:`invalid-${doc.id}`,vesselId:vessel.id,type:'unverified',severity:'info',title:'Cần kiểm tra ngày hiệu lực',detail:`${vessel.name}: ngày trên ${doc.type} chưa hợp lệ.`,date:today});continue;
      }
      const remaining=Math.round((new Date(`${doc.expiresOn}T00:00:00+07:00`).getTime()-todayMs)/DAY);
      if(remaining<0)result.push({id:`expired-${doc.id}`,vesselId:vessel.id,type:'expired',severity:'high',title:'Giấy tờ đã quá ngày hiệu lực',detail:`${vessel.name} · ${doc.type} · Quá ${-remaining} ngày. Cần đối chiếu hồ sơ gốc.`,date:doc.expiresOn});
      else if(remaining<=warningDays)result.push({id:`expiring-${doc.id}`,vesselId:vessel.id,type:'expiring',severity:'medium',title:remaining===0?'Giấy tờ đến ngày hết hiệu lực':'Giấy tờ sắp hết hiệu lực',detail:`${vessel.name} · ${doc.type} · ${remaining===0?'Hết hiệu lực hôm nay':`Còn ${remaining} ngày`}.`,date:doc.expiresOn});
    }
  }
  for(const d of state.declarations.filter(d=>d.status==='supplement')) {
    const v=state.vessels.find(v=>v.id===d.vesselId);
    result.push({id:`supplement-${d.id}`,vesselId:d.vesselId,declarationId:d.id,type:'supplement',severity:'medium',title:'Thông tin cần cập nhật',detail:`${d.code} · ${v?.name||'Phương tiện'} · ${d.history?.at(-1)?.note||d.notes||'Xem yêu cầu từ cán bộ đối chiếu.'}`,date:localDate(d.updatedAt)});
  }
  return result.sort((a,b)=>({high:0,medium:1,info:2}[a.severity]-{high:0,medium:1,info:2}[b.severity]));
}

export function metrics(state,days=30,now=new Date()) {
  now=asDate(now);days=Math.max(1,Math.min(366,Math.floor(Number(days)||30)));
  const start=localStart(now)-(days-1)*DAY,end=now.getTime();
  const within=value=>validTime(value)&&new Date(value).getTime()>=start&&new Date(value).getTime()<=end;
  const series=Array.from({length:days},(_,i)=>({date:localDate(start+i*DAY),arrivals:0,departures:0}));
  const bucket=new Map(series.map(row=>[row.date,row]));
  const cargoMap=new Map();let arrivals=0,departures=0,cargoTons=0,cargoUnloadedTons=0,cargoLoadedTons=0,cargoTeu=0,containers=0,cargoUnloadedTeu=0,cargoLoadedTeu=0,containersUnloaded=0,containersLoaded=0,invalidCargoEntries=0;
  // Deduplicate by voyage ID: arrival and departure declarations never add cargo twice.
  const voyages=[...new Map(state.voyages.map(v=>[v.id,v])).values()];
  for(const v of voyages) {
    if(within(v.arrivedAt)){arrivals++;const b=bucket.get(localDate(v.arrivedAt));if(b)b.arrivals++;}
    if(within(v.departedAt)){departures++;const b=bucket.get(localDate(v.departedAt));if(b)b.departures++;}
    if(within(v.cargoEndAt)) {
      const movements=new Map();
      for(const entry of cargoEntriesFor(v)) {
        if(movements.has(entry.operation)||!['load','unload'].includes(entry.operation)||!Number.isFinite(entry.cargoTons)||entry.cargoTons<0||!Number.isInteger(entry.cargoTeu)||entry.cargoTeu<0||!Number.isInteger(entry.containers)||entry.containers<0){invalidCargoEntries++;continue;}
        movements.set(entry.operation,entry);
      }
      for(const entry of movements.values()) {
        const {cargoTons:tons,cargoTeu:teu,containers:count}=entry;
        cargoTons+=tons;cargoTeu+=teu;containers+=count;
        if(entry.operation==='unload'){cargoUnloadedTons+=tons;cargoUnloadedTeu+=teu;containersUnloaded+=count;}
        else {cargoLoadedTons+=tons;cargoLoadedTeu+=teu;containersLoaded+=count;}
        const name=entry.cargoType||'Chưa xác định';cargoMap.set(name,(cargoMap.get(name)||0)+tons);
      }
    }
  }
  const declarations=state.declarations.filter(d=>within(d.createdAt));
  const statuses=Object.entries(STATUS).map(([key,label])=>({key,label,count:declarations.filter(d=>d.status===key).length}));
  const durations=declarations.filter(d=>validTime(d.completedAt)&&validTime(d.submittedAt)&&new Date(d.completedAt)>=new Date(d.submittedAt)).map(d=>(new Date(d.completedAt)-new Date(d.submittedAt))/60000);
  const submitted=declarations.filter(d=>d.status!=='draft');
  return {
    totalVessels:state.vessels.length,totalDeclarations:declarations.length,arrivals,departures,
    inArea:voyages.filter(v=>validTime(v.arrivedAt)&&new Date(v.arrivedAt)<=now&&(!validTime(v.departedAt)||new Date(v.departedAt)>now)).length,
    planned:voyages.filter(v=>v.stage==='planned').length,
    pending:declarations.filter(d=>['submitted','reviewing','supplement'].includes(d.status)).length,
    pendingAll:state.declarations.filter(d=>['submitted','reviewing','supplement'].includes(d.status)).length,
    verified:declarations.filter(d=>['verified','archived'].includes(d.status)).length,
    cargoTons,cargoUnloadedTons,cargoLoadedTons,cargoTeu,containers,cargoUnloadedTeu,cargoLoadedTeu,containersUnloaded,containersLoaded,invalidCargoEntries,
    reuseRate:submitted.length?Math.round(submitted.filter(d=>d.reusedData).length/submitted.length*100):0,
    avgMinutes:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null,
    series,cargo:[...cargoMap].map(([name,tons])=>({name,tons})).sort((a,b)=>b.tons-a.tons),statuses,
    periodStart:localDate(start),periodEnd:localDate(now),alertCount:alertsFor(state,now).length
  };
}

export function toCSV(headers,rows) {
  const escape=value=>{
    let text=String(value??'');
    // Spreadsheet formula injection also applies when preceded by whitespace.
    if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text=`'${text}`;
    return `"${text.replaceAll('"','""')}"`;
  };
  return '\uFEFF'+[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
}
