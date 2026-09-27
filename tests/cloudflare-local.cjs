const assert=require('node:assert/strict'),fs=require('node:fs');
const origin='http://127.0.0.1:8787',password=JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD;
(async()=>{
 const raw=await fetch(origin+'/api/db',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(raw.status,401);
 const login=await fetch(origin+'/login',{method:'POST',redirect:'manual',headers:{Origin:origin},body:new URLSearchParams({password})});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
 async function db(q){const r=await fetch(origin+'/api/db',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(q)});return {status:r.status,...await r.json()}}
 const q={table:'feixi_stations',operation:'select',fields:'*',filters:{},limit:100};const rows=await db(q);assert.equal(rows.data.length,76);
 const before=rows.data[0],data=structuredClone(before.data);data.station.selectionProgress='本地迁移测试';
 const update={...q,operation:'update',filters:{id:before.id,revision:before.revision},payload:{data,revision:before.revision+1}};
 assert.equal((await db(update)).count,1);assert.equal((await db(update)).count,0,'stale version must not overwrite');
 const bad=structuredClone(update);bad.filters.revision++;bad.payload.revision++;bad.payload.data.station.id='tampered';assert.equal((await db(bad)).status,400);
 assert.equal((await db({...q,fields:'id; DROP TABLE feixi_stations'})).status,400);
 const csrf=await fetch(origin+'/api/db',{method:'POST',headers:{Origin:'https://other.invalid',Cookie:cookie},body:JSON.stringify(q)});assert.equal(csrf.status,403);
 const forged=await fetch(origin+'/api/db',{method:'POST',headers:{Origin:origin,Cookie:cookie+'0','Content-Type':'application/json'},body:JSON.stringify(q)});assert.equal(forged.status,401);
 assert.equal((await db({...update,filters:{id:before.id,revision:before.revision+1},payload:{data:before.data,revision:before.revision+2}})).count,1);
 console.log('PASS real local D1: authentication, CSRF, 76 rows, save, CAS conflict, invalid ID, query whitelist, restore');
})().catch(e=>{console.error(e);process.exit(1)});
