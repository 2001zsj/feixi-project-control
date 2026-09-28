const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('cloudflare/adapter.js','utf8');
function boot(fetch){const ctx={window:{},fetch,Promise,TypeError,setTimeout,clearTimeout};vm.runInNewContext(code,ctx);return ctx.window}
const response=(status,data,type='application/json')=>({status,ok:status===200,headers:{get:()=>type},json:async()=>data});
(async()=>{
 const seen=[];
 const api=boot(async(url,options)=>{seen.push(JSON.parse(options.body));return response(200,{data:[{id:'one'}]})});
 assert.equal((await api.cloudbase.init().rdb().from('feixi_stations').select('id').limit(100)).data[0].id,'one');
 assert.equal(seen.length,1,'request works without AbortSignal or AbortController');
 const create=boot(async()=>response(200,{id:'created'}));assert.equal((await create.fxttRequest('/api/stations',{})).id,'created');
 await assert.rejects(boot(async()=>response(401,{})).fxttRequest('/api/db',{}),/登录已过期/);
 await assert.rejects(boot(async()=>response(502,{},'text/html')).fxttRequest('/api/db',{}),/接口未返回数据/);
 await assert.rejects(boot(async()=>{throw new TypeError('Failed to fetch')}).fxttRequest('/api/db',{}),/网络请求失败/);
 // Speed up only the timeout branch so an unresponsive connection cannot hang forever.
 const ctx={window:{},fetch:()=>new Promise(()=>{}),Promise,TypeError,setTimeout:fn=>setTimeout(fn,5),clearTimeout};vm.runInNewContext(code,ctx);
 await assert.rejects(ctx.window.fxttRequest('/api/db',{}),/连接超时/);
 console.log('PASS mobile request fallback, creation, expired login, non-JSON, network failure and timeout');
})().catch(e=>{console.error(e);process.exitCode=1});
