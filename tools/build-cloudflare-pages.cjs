// Reuse the protected application and the same D1 database on a Pages hostname.
require('./build-cloudflare.cjs');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../cloudflare');
const out=path.join(root,'pages-public');
fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','adapter.js'])fs.copyFileSync(path.join(root,'public',name),path.join(out,name));
fs.writeFileSync(path.join(out,'_worker.js'),"export {default} from '../worker.mjs';\n");
// Every path must execute authentication before serving embedded station data.
fs.writeFileSync(path.join(out,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}));
console.log('Built protected Cloudflare Pages entry');
