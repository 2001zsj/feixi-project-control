// Local-only SDK adapter. Never connects to production; fixture rows stay in memory.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const snapshot=JSON.parse(fs.readFileSync(process.argv[2]));
const tables={feixi_stations:snapshot.stations,feixi_meta:snapshot.meta};
const sdk=`window.__testFailWrites=false;window.cloudbase={init(){return {
 auth(){return {getLoginState:async()=>true}},
 rdb(){return {from(table){let operation='select',fields='*',payload=null,filters={},limit=100;const q={
 select(f){fields=f;return q},update(p){operation='update';payload=p;return q},eq(k,v){filters[k]=v;return q},limit(n){limit=n;return q},
 async then(resolve,reject){try{if(operation==='update'&&window.__testFailWrites)throw Error('模拟断网');
 const r=await fetch('/test/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,operation,fields,payload,filters,limit})});resolve(await r.json());}catch(e){reject(e)}}
 };return q}}}
}}};`;
http.createServer(async(req,res)=>{
 try{
  if(req.url==='/test-sdk.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk)}
  if(req.url==='/test/db'){
   let body='';for await(const part of req)body+=part;const q=JSON.parse(body);
   let rows=tables[q.table].filter(row=>Object.entries(q.filters).every(([k,v])=>row[k]===v)).slice(0,q.limit);
   if(q.operation==='update'){for(const row of rows)Object.assign(row,q.payload);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({count:rows.length}))}
   if(q.fields!=='*'){const keys=q.fields.split(',');rows=rows.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]])))}
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:rows}));
  }
  const html=fs.readFileSync(path.join(__dirname,'../cloudbase-dist/index.html'),'utf8').replace('https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js','/test-sdk.js');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:{message:e.message}}))}
}).listen(8767,'127.0.0.1',()=>console.log('Isolated fixture UI: http://127.0.0.1:8767'));
