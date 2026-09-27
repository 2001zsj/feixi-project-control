const fields=['operator','demandName','demandOrder','demandDate','territory','selector','demandLng','demandLat','towerName','siteCode','buildMethod','buildConfig','selectionProgress'];
export function newStationInput(input,asOf){
  if(!input||typeof input!=='object')throw Error('请填写站点资料');
  const data=Object.fromEntries(fields.map(k=>[k,String(input[k]??'').trim()]));
  for(const k of fields)if(data[k].length>(['buildConfig','selectionProgress'].includes(k)?2000:200))throw Error('字段内容过长');
  if(!['移动','电信','联通','广电','搬迁','其他'].includes(data.operator))throw Error('请选择运营商');
  if(!data.demandName)throw Error('请填写需求站名');
  if(data.demandDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.demandDate)||new Date(data.demandDate).toISOString().slice(0,10)!==data.demandDate||data.demandDate>asOf))throw Error('需求日期无效或晚于今天');
  for(const [k,max] of [['demandLng',180],['demandLat',90]])if(data[k]&&(!Number.isFinite(Number(data[k]))||Math.abs(Number(data[k]))>max))throw Error('经纬度格式或范围不正确');
  return data;
}
export async function createStation(req,env){
  const body=await req.text();if(body.length>12000)throw Error('提交内容过大');
  const {id,input}=JSON.parse(body);
  if(typeof id!=='string'||!/^site-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))throw Error('新增请求编号无效');
  const now=new Date().toISOString(),asOf=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const data=newStationInput(input,asOf);
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))),v=>v.toString(16).padStart(2,'0')).join('');
  const station={...data,id,creationFingerprint:fingerprint,selectionDone:false,isDifficultSite:false,completeConfirmed:false,selectionHold:false,followupEnabled:true,selectionProblem:'',selectionProblemStatus:'未解决',selectionFollowups:[],selectionLastFollowup:'',selectionProgressUpdatedAt:new Date(Date.now()+8*3600000).toISOString().slice(0,16),selectionDoneDate:'',establishRef:'',establishDate:'',entryDate:'',pourDate:'',towerDate:'',powerDate:'',supportDate:'',completeDate:'',cureDays:28,isPaused:false,pauseStart:'',pauseReason:'',pauses:[],buildEvents:[],issues:[],priorProjectHistory:[],currentStage:'选址',currentSituation:data.selectionProgress,lastUpdate:asOf,updates:[{date:asOf,text:'新增站点'}]};
  const bundle={station,undo:[],redo:[],appliedRemoteCommands:[]};
  // A single conditional INSERT serializes competing creates; the batch also updates the ledger count.
  const result=await env.DB.batch([
    env.DB.prepare(`INSERT INTO feixi_stations(id,data,revision,updated_at)
      SELECT ?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM feixi_stations WHERE id=? OR
      (json_extract(data,'$.station.operator')=? AND trim(json_extract(data,'$.station.demandName'))=?) OR
      (?<>'' AND json_extract(data,'$.station.demandOrder')=?) OR
      (?<>'' AND json_extract(data,'$.station.siteCode')=?))`).bind(id,JSON.stringify(bundle),now,id,data.operator,data.demandName,data.demandOrder,data.demandOrder,data.siteCode,data.siteCode),
    env.DB.prepare(`UPDATE feixi_meta SET data=json_set(data,'$.stationCount',(SELECT count(*) FROM feixi_stations)),revision=revision+1,updated_at=? WHERE id='main' AND json_extract(data,'$.stationCount')<>(SELECT count(*) FROM feixi_stations)`).bind(now)
  ]);
  const row=await env.DB.prepare('SELECT data FROM feixi_stations WHERE id=?').bind(id).first();
  if(row&&JSON.parse(row.data).station.creationFingerprint===fingerprint)return {id,created:result[0].meta.changes===1};
  throw Error(row?'同一请求的资料已变化，请核对已新增的站点':'站点已存在：请核对运营商和站名、需求订单号或站址编码');
}
