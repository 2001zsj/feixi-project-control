// Production acceptance: login, SELECT, navigation and export only. No business writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const origin='https://fxtt-feixi.pages.dev',password=JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD;
const folder='audit-evidence/online-'+Date.now();fs.mkdirSync(folder,{recursive:true});
(async()=>{
 let first;
 for(const [engine,options,sizes] of [[pw.chromium,{channel:'chrome',args:['--no-proxy-server']},[1440,768,390,320]],[pw.webkit,{},[390]]]){
  const browser=await engine.launch({headless:true,...options});
  try{for(const width of sizes){const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000,isMobile:width<600});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);await page.locator('#password').fill(password);await page.getByRole('button',{name:'进入工作台'}).click();await page.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);
   const data=await page.evaluate(async()=>({release:CLOUD_RELEASE,count:state.stations.length,modules:cloudModuleCounts(state),rows:(await cloudSync.db.from('feixi_stations').select('id,data,revision').limit(100)).data}));
   assert.equal(data.release,'2026-09-30-layout-1');assert.equal(data.rows.length,data.count);assert.equal(Object.values(data.modules).reduce((a,b)=>a+b,0),data.count);
   if(first)assert.deepEqual(data,first);else{first=data;fs.writeFileSync(path.join(folder,'snapshot.json'),JSON.stringify(data,null,2))}
   await page.getByRole('button',{name:'新增站点',exact:true}).click();await page.locator('#newStationForm').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(folder,engine.name()+'-'+width+'-new.png'),fullPage:true});
   await page.goto(origin+'/#home');await page.reload();await page.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await page.locator('#password').count(),0);
   const download=page.waitForEvent('download');await page.locator('#exportLedger').click();await(await download).saveAs(path.join(folder,engine.name()+'-'+width+'.xlsx'));assert.deepEqual(errors,[]);
   console.log('PASS '+engine.name()+' '+width+'px: HTTPS login/session, '+data.count+' stations, new form and ledger export');await context.close();
  }}finally{await browser.close()}
 }
 // Compare independent sessions above against this run, not an obsolete migration snapshot.
 console.log('PASS production read-only cross-session consistency; evidence '+folder);
})().catch(e=>{console.error(e.message);process.exitCode=1});
