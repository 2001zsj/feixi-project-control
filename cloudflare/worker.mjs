import {assertStationChange} from './generated-rules.mjs';
const enc=new TextEncoder();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
const loginHtml=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FXTT · 肥西站点推进</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6fa;color:#19324d;font:16px system-ui}form{box-sizing:border-box;width:min(90vw,380px);padding:32px;background:white;border:1px solid #dde5ef;border-radius:12px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:18px;border:1px solid #ccd7e5;border-radius:6px;font:inherit}button{background:#2563eb;color:white;border:0;cursor:pointer}</style><form method="post" action="/login"><h2>肥西站点推进</h2><label for="password">团队访问码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button>进入工作台</button></form></html>`;
async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function authorized(req,env){const v=req.headers.get('Cookie')?.match(/(?:^|;\s*)fxtt_session=([^;]+)/)?.[1]||'';const [expiry,sig]=v.split('.');return /^\d+$/.test(expiry)&&Number(expiry)>Date.now()&&Number(expiry)<Date.now()+31*86400000&&!!sig&&equal(sig,await hmac(env.SESSION_SECRET,expiry))}
async function database(req,env){
 const text=await req.text();if(text.length>2000000)return json({error:{message:'提交内容过大'}},413);
 const q=JSON.parse(text),table=q.table;
 if(!['feixi_stations','feixi_meta'].includes(table))throw Error('不允许的数据表');
 const filters=q.filters||{},keys=Object.keys(filters);if(keys.some(k=>!['id','revision'].includes(k)))throw Error('不允许的查询条件');
 const values=keys.map(k=>filters[k]);const where=keys.length?' WHERE '+keys.map(k=>k+' = ?').join(' AND '):'';
 if(q.operation==='select'){
  const cols=q.fields==='*'?['id','data','revision','updated_at']:String(q.fields).split(',');
  if(cols.some(k=>!['id','data','revision','updated_at'].includes(k)))throw Error('不允许的字段');
  const result=await env.DB.prepare(`SELECT ${cols.join(',')} FROM ${table}${where} ORDER BY id LIMIT ?`).bind(...values,Math.min(100,Math.max(1,Number(q.limit)||100))).all();
  return json({data:result.results.map(r=>({...r,...('data' in r?{data:JSON.parse(r.data)}:{})}))});
 }
 if(q.operation!=='update'||typeof filters.id!=='string'||!Number.isSafeInteger(filters.revision)||filters.revision<1)throw Error('更新必须携带站点与版本');
 const p=q.payload;if(!p||p.revision!==filters.revision+1||!p.data)throw Error('无效更新版本');
 const row=await env.DB.prepare(`SELECT data,revision FROM ${table} WHERE id=?`).bind(filters.id).first();
 if(!row||row.revision!==filters.revision)return json({count:0});
 const before=JSON.parse(row.data),after=p.data;
 if(table==='feixi_stations'){
  if(after.station?.id!==filters.id||!Array.isArray(after.undo)||!Array.isArray(after.redo)||!Array.isArray(after.appliedRemoteCommands))throw Error('无效站点数据');
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const history=[before.undo?.at(-1),before.redo?.at(-1)].some(e=>e&&same(e.expectedAfter,before.station)&&same(e.snapshot,after.station));
  const asOf=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  assertStationChange(before.station,after.station,asOf,history);
  if(!same(before.appliedRemoteCommands||[],after.appliedRemoteCommands))throw Error('不能改写远程命令回执');
 }else if(after.schemaVersion!==before.schemaVersion||after.stationCount!==before.stationCount||!after.meta)throw Error('不能修改底册结构');
 const result=await env.DB.prepare(`UPDATE ${table} SET data=?,revision=?,updated_at=? WHERE id=? AND revision=?`).bind(JSON.stringify(after),p.revision,new Date().toISOString(),filters.id,filters.revision).run();
 return json({count:result.meta.changes});
}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(!env.APP_PASSWORD||!env.SESSION_SECRET)return new Response('服务正在配置',{status:503,headers});
 if(req.method==='POST'&&req.headers.get('Origin')!==url.origin)return json({error:{message:'请求来源不匹配'}},403);
 if(url.pathname==='/login'&&req.method==='POST'){
  if(Number(req.headers.get('Content-Length')||0)>4096)return new Response('请求过大',{status:413});
  const form=await req.formData(),pw=String(form.get('password')||'');
  if(!equal(await hmac(env.SESSION_SECRET,pw),await hmac(env.SESSION_SECRET,env.APP_PASSWORD)))return new Response(loginHtml.replace('<h2>','<p style="color:#b91c1c">访问码不正确</p><h2>'),{status:401,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  const expiry=String(Date.now()+30*86400000),sig=await hmac(env.SESSION_SECRET,expiry);
  return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':`fxtt_session=${expiry}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`}});
 }
 if(url.pathname==='/logout'&&req.method==='POST')return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':'fxtt_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});
 if(!(await authorized(req,env)))return url.pathname.startsWith('/api/')?json({error:{message:'请先登录'}},401):new Response(loginHtml,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(url.pathname==='/api/db'&&req.method==='POST'){try{return await database(req,env)}catch(e){return json({error:{message:e.message}},400)}}
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!['/','/index.html','/adapter.js'].includes(url.pathname))return new Response('Not found',{status:404});
 const response=await env.ASSETS.fetch(req);const h=new Headers(response.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);return new Response(response.body,{status:response.status,headers:h});
}};
