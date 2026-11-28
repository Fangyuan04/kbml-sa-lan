import {STATUS, STAGES} from './data.js';

const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const empty=value=>value===null||value===undefined||value==='';
const text=value=>typeof value==='string'&&value.trim().length>0;
const fail=message=>{throw new Error(`Bản sao không hợp lệ: ${message}`);};
const registration=value=>value.trim().normalize('NFC').toUpperCase().replace(/[\s.\-/]+/g,'');
function realDate(value,label,required=false,dateOnly=false) {
  if(empty(value)){if(required)fail(`thiếu ${label}.`);return;}
  if(typeof value!=='string')fail(`${label} phải là ngày giờ dạng văn bản.`);
  const day=value.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))fail(`${label} chưa đúng định dạng ngày.`);
  const [year,month,date]=day.split('-').map(Number);
  const check=new Date(`${day}T00:00:00Z`);
  if(!Number.isFinite(check.getTime())||check.getUTCFullYear()!==year||check.getUTCMonth()+1!==month||check.getUTCDate()!==date)fail(`${label} chứa ngày không tồn tại.`);
  if(dateOnly){if(value!==day)fail(`${label} phải có định dạng YYYY-MM-DD.`);return;}
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail(`${label} phải là ngày giờ hợp lệ có múi giờ.`);
  const [hour,minute,second='00']=value.slice(11).replace(/(?:Z|[+-]\d{2}:\d{2})$/,'').split(':');
  if(Number(hour)>23||Number(minute)>59||Number(second)>59.999)fail(`${label} chứa giờ không hợp lệ.`);
}
function quantity(value,label,{required=false,integer=false,positive=false}={}) {
  if(empty(value)){if(required)fail(`thiếu ${label}.`);return;}
  if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!value.trim()))fail(`${label} phải là số.`);
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||(positive&&n===0)||(integer&&!Number.isInteger(n)))fail(`${label} phải là số ${integer?'nguyên ':''}${positive?'lớn hơn 0':'không âm'}.`);
}
function uniqueRows(rows,label) {
  const map=new Map();
  for(const row of rows){if(!object(row)||!text(row.id))fail(`${label} thiếu mã định danh.`);if(map.has(row.id))fail(`mã ${label} bị trùng: ${row.id}.`);map.set(row.id,row);}
  return map;
}
function validateCargo(voyage) {
  if(own(voyage,'cargoEntries')&&!Array.isArray(voyage.cargoEntries))fail(`danh sách hàng hóa của chuyến ${voyage.id} không hợp lệ.`);
  const entries=voyage.cargoEntries??[voyage];
  if(entries.length<1||entries.length>2)fail(`chuyến ${voyage.id} cần một hoặc hai hoạt động xếp/dỡ.`);
  const operations=new Set();
  for(const item of entries){
    if(!object(item)||!['load','unload'].includes(item.operation))fail(`hoạt động hàng hóa của chuyến ${voyage.id} không hợp lệ.`);
    if(operations.has(item.operation))fail(`hoạt động xếp/dỡ của chuyến ${voyage.id} bị trùng.`);
    operations.add(item.operation);
    if(!text(item.cargoType))fail(`chuyến ${voyage.id} thiếu loại hàng hóa.`);
    quantity(item.cargoTons,`khối lượng hàng chuyến ${voyage.id}`,{required:true});
    quantity(item.cargoTeu,`số TEU chuyến ${voyage.id}`,{integer:true});
    quantity(item.containers,`số container chuyến ${voyage.id}`,{integer:true});
  }
  // Legacy quantities remain visible to older exports and must also be numeric.
  for(const key of ['cargoTons','cargoTeu','containers'])if(own(voyage,key))quantity(voyage[key],`${key} chuyến ${voyage.id}`,{integer:key!=='cargoTons'});
}

/** Validate a JSON backup before replacing live state. Does not save any data. */
export function validateImport(data) {
  if(!object(data)||data.version!==1||!['vessels','voyages','declarations','logs'].every(k=>Array.isArray(data[k])))fail('tệp chưa đúng định dạng KBML phiên bản này.');
  if(data.settings!==undefined&&data.settings!==null&&!object(data.settings))fail('cấu hình không đúng định dạng.');
  realDate(data.createdAt,'ngày tạo bộ dữ liệu');
  const vessels=uniqueRows(data.vessels,'phương tiện');
  const voyages=uniqueRows(data.voyages,'chuyến');
  uniqueRows(data.declarations,'thông tin khai báo');
  const registrations=new Set();
  for(const v of data.vessels){
    if(!text(v.name)||!text(v.registration)||!Array.isArray(v.docs)||!Array.isArray(v.crew))fail(`phương tiện ${v.id} thiếu tên, số đăng ký hoặc danh sách giấy tờ/thuyền viên.`);
    const reg=registration(v.registration);if(!reg||registrations.has(reg))fail(`số đăng ký phương tiện bị trùng hoặc rỗng: ${v.registration}.`);registrations.add(reg);
    if(!['VR-SI','VR-SII','VR-SIII'].includes(v.grade))fail(`cấp phương tiện ${v.id} nằm ngoài phạm vi bản mẫu.`);
    quantity(v.capacity,`trọng tải phương tiện ${v.id}`,{required:true,positive:true});
    for(const key of ['length','width','draft'])quantity(v[key],`${key} phương tiện ${v.id}`);
    quantity(v.capacityTeu,`sức chở TEU phương tiện ${v.id}`,{integer:true});
    realDate(v.createdAt,`ngày tạo phương tiện ${v.id}`);realDate(v.updatedAt,`ngày cập nhật phương tiện ${v.id}`);
    for(const d of v.docs){
      if(!object(d))fail(`giấy tờ của phương tiện ${v.id} không đúng định dạng.`);
      realDate(d.issuedOn,`ngày cấp giấy tờ của ${v.id}`,false,true);realDate(d.expiresOn,`ngày hết hiệu lực giấy tờ của ${v.id}`,false,true);
      if(d.issuedOn&&d.expiresOn&&d.expiresOn<d.issuedOn)fail(`ngày hết hiệu lực trước ngày cấp giấy tờ của ${v.id}.`);
    }
    for(const c of v.crew){
      if(!object(c))fail(`thuyền viên của phương tiện ${v.id} không đúng định dạng.`);
      realDate(c.issuedOn,`ngày cấp chứng chỉ thuyền viên của ${v.id}`,false,true);realDate(c.expiresOn,`ngày hết hạn chứng chỉ thuyền viên của ${v.id}`,false,true);
    }
  }
  const activeByVessel=new Set();
  for(const v of data.voyages){
    if(!vessels.has(v.vesselId)||!own(STAGES,v.stage))fail(`chuyến ${v.id} có phương tiện hoặc trạng thái không hợp lệ.`);
    realDate(v.eta,`dự kiến đến chuyến ${v.id}`,true);realDate(v.etd,`dự kiến rời chuyến ${v.id}`);
    if(v.etd&&Date.parse(v.etd)<=Date.parse(v.eta))fail(`dự kiến rời phải sau dự kiến đến của chuyến ${v.id}.`);
    let previous=null;
    for(const key of ['arrivedAt','cargoStartAt','cargoEndAt','departedAt']){
      realDate(v[key],`${key} chuyến ${v.id}`);
      if(v[key]){const time=Date.parse(v[key]);if(previous!==null&&time<previous)fail(`thứ tự mốc thực tế của chuyến ${v.id} không hợp lệ.`);previous=time;}
    }
    if(v.stage!=='departed'){
      if(activeByVessel.has(v.vesselId))fail(`phương tiện ${v.vesselId} có nhiều chuyến chưa kết thúc.`);
      activeByVessel.add(v.vesselId);
    }
    validateCargo(v);
  }
  for(const d of data.declarations){
    const related=voyages.get(d.voyageId);
    if(!vessels.has(d.vesselId)||!related||related.vesselId!==d.vesselId)fail(`phương tiện và chuyến liên kết của thông tin ${d.id} không khớp.`);
    if(!own(STATUS,d.status)||!['arrival','departure'].includes(d.direction)||!Array.isArray(d.history))fail(`trạng thái, loại khai báo hoặc lịch sử của ${d.id} không hợp lệ.`);
    realDate(d.createdAt,`ngày tạo thông tin ${d.id}`,true);
    for(const key of ['submittedAt','completedAt','updatedAt','reviewStartedAt'])realDate(d[key],`${key} thông tin ${d.id}`);
    for(const row of d.history){if(!object(row))fail(`lịch sử của ${d.id} không hợp lệ.`);realDate(row.at,`ngày giờ lịch sử ${d.id}`,true);}
    if(d.attachments!==undefined&&!Array.isArray(d.attachments))fail(`tệp đính kèm của ${d.id} không đúng định dạng.`);
    for(const attachment of d.attachments||[]){if(!object(attachment)||!text(attachment.id)||!text(attachment.name))fail(`tệp đính kèm của ${d.id} thiếu thông tin.`);quantity(attachment.size,`dung lượng tệp đính kèm của ${d.id}`,{integer:true});}
  }
  for(const log of data.logs){if(!object(log))fail('nhật ký không đúng định dạng.');realDate(log.at,'ngày giờ nhật ký',true);}
  data.settings??={};
  return data;
}
