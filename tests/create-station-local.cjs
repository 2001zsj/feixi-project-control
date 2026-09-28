// Requires wrangler dev on port 8787. Never accepts a production URL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const origin='http://127.0.0.1:8787',run='LOCAL-CREATE-'+Date.now(),ids=[];
const password=JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD;
(async()=>{
 const login=await fetch(origin+'/login',{method:'POST',redirect:'manual',headers:{Origin:origin},body:new URLSearchParams({password})});assert.equal(login.status,303);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 async function post(url,body){const r=await fetch(origin+url,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()}}
 const list=(cursor)=>post('/api/db',{table:'feixi_stations',operation:'select',fields:'id,data,revision',limit:100,cursor});
 const input={operator:'移动',demandName:run,demandOrder:run,selectionProgress:'新增测试'};
 const id='site-'+randomUUID();ids.push(id);
 assert.equal((await post('/api/stations',{id,input:{...input,demandName:''}})).status,400);
 assert.equal((await post('/api/stations',{id,input:{...input,demandLng:'181'}})).status,400);
 assert.equal((await post('/api/stations',{id,input:{...input,demandDate:'2099-01-01'}})).status,400);
 const twice=await Promise.all([post('/api/stations',{id,input}),post('/api/stations',{id,input})]);
 assert(twice.every(r=>r.status===200));assert.equal(twice.filter(r=>r.created).length,1);
 const other='site-'+randomUUID();ids.push(other);assert.equal((await post('/api/stations',{id:other,input})).status,400);
 assert.equal((await post('/api/stations',{id,input:{...input,demandName:'changed'}})).status,400);
 await Promise.all(Array.from({length:30},async(_,i)=>{const id='site-'+randomUUID();ids.push(id);const r=await post('/api/stations',{id,input:{operator:'电信',demandName:run+'-'+i}});assert.equal(r.status,200)}));
 const first=await list();assert.equal(first.data.length,100);assert(first.nextCursor);const second=await list(first.nextCursor);
 const all=[...first.data,...second.data];assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 assert.equal(all.filter(r=>r.data.station.demandName.startsWith(run)).length,31);
 const vm=require('node:vm');const browser={window:{},AbortSignal,AbortController,setTimeout,clearTimeout,fetch:(url,opts)=>fetch(origin+url,{...opts,headers:{...opts.headers,Origin:origin,Cookie:cookie}})};
 vm.runInNewContext(fs.readFileSync('cloudflare/adapter.js','utf8'),browser);
 const loaded=await browser.window.cloudbase.init().rdb().from('feixi_stations').select('id,data,revision').limit(100);
 assert.equal(loaded.data.length,all.length,'real browser adapter traverses every page');
 const meta=await post('/api/db',{table:'feixi_meta',operation:'select',fields:'*',filters:{id:'main'},limit:1});assert.equal(meta.data[0].data.stationCount,all.length);
 const row=all.find(r=>r.id===id);assert.equal(row.data.station.selectionDone,false);assert.equal(row.data.station.establishRef,'');
 const edited=structuredClone(row.data);edited.station.selectionProgress='已更新';
 assert.equal((await post('/api/db',{table:'feixi_stations',operation:'update',filters:{id,revision:1},payload:{data:edited,revision:2}})).count,1);
 assert.equal((await post('/api/stations',{id,input})).status,200,'retry after another edit remains idempotent');
 console.log('PASS local D1: validation, concurrent idempotency, duplicate protection, 107+ rows, pagination, atomic count, edit new station and replay');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 // Remove only this run's records from the local emulator, never a remote database.
 const {DatabaseSync}=require('node:sqlite');const dir='cloudflare/.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
 for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.sqlite'))){const db=new DatabaseSync(path.join(dir,name));try{if(!db.prepare("SELECT name FROM sqlite_master WHERE name='feixi_stations'").get())continue;
  for(const id of ids)db.prepare("DELETE FROM feixi_stations WHERE id=? AND json_extract(data,'$.station.demandName') LIKE ?").run(id,run+'%');
  db.exec("UPDATE feixi_meta SET data=json_set(data,'$.stationCount',(SELECT count(*) FROM feixi_stations)) WHERE id='main'");
 }finally{db.close()}}
});
