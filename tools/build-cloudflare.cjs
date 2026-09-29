const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'cloudbase-dist/index.html'),'utf8');
function replace(a,b){if(!html.includes(a))throw Error('Build marker missing: '+a);html=html.replace(a,b)}
const start=html.indexOf('// SHARED_STATION_RULES_BEGIN'),end=html.indexOf('// SHARED_STATION_RULES_END');
fs.writeFileSync(path.join(root,'cloudflare/generated-rules.mjs'),html.slice(start,end)+'\nexport {assertStationChange};\n');
replace('https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js','/adapter.js');
replace("const CLOUD_RELEASE='2026-09-27-ledger-style-1';","const CLOUD_RELEASE='2026-09-29-natural-nodes-1';");
replace('if(!cloudSync.refreshTimer)cloudSync.refreshTimer=setInterval(cloudRefresh,CLOUD_POLL_MS);',`// No database polling while the page is idle.
    let lastCheck=Date.now();
    const checkOnReturn=()=>{if(!document.hidden&&Date.now()-lastCheck>5000){lastCheck=Date.now();cloudRefresh()}};
    window.addEventListener('online',()=>{if(cloudSync.dirty&&!cloudSync.conflict)cloudRetrySync();else checkOnReturn()});`);
replace("window.addEventListener('focus',()=>cloudRefresh(true));","window.addEventListener('focus',checkOnReturn);");
replace("document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudRefresh()});","document.addEventListener('visibilitychange',checkOnReturn);");
// Database initialization is a controlled migration, never a browser action.
replace('function cloudInitButton(show){','function cloudInitButton(show){show=false;');
replace('<div class="brand">肥西站点推进</div>','<div class="brand">肥西站点推进</div><form action="/logout" method="post" style="margin:0"><button class="btn" title="退出登录">退出</button></form>');
const out=path.join(root,'cloudflare/public');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),html);fs.copyFileSync(path.join(root,'cloudflare/adapter.js'),path.join(out,'adapter.js'));
console.log('Built Cloudflare frontend and shared lifecycle rules');
