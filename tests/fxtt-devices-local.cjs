// Real browser + local D1 only. Remote acceptance is read-only and separate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base='http://127.0.0.1:8787',name='LOCAL-UI-'+Date.now(),errors=[];
const password=JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD;
const evidence=path.join('audit-evidence','devices-'+Date.now());fs.mkdirSync(evidence,{recursive:true});
async function login(context,origin=base){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(origin);await p.locator('#password').fill(password);await p.getByRole('button',{name:'进入工作台'}).click();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);return p}
async function noOverflow(p,label){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' horizontal overflow')}
(async()=>{
 const b=await pw.chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
 try{
 const pc=await b.newContext({viewport:{width:1440,height:960}}),mobile=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),tablet=await b.newContext({viewport:{width:768,height:1024},hasTouch:true});
 const desktop=await login(pc),phone=await login(mobile),pad=await login(tablet);const count=await phone.evaluate(()=>state.stations.length);
 await phone.getByRole('button',{name:'新增站点',exact:true}).click();await phone.locator('[name=operator]').selectOption('移动');await phone.locator('[name=demandName]').fill(name);await phone.locator('[name=territory]').fill('本机测试');await phone.locator('[name=selectionProgress]').fill('新增进度');await noOverflow(phone,'create phone');
 await phone.reload();await phone.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await phone.locator('[name=demandName]').inputValue(),name,'draft survives reload');
 // Server accepts a create but the response is lost: retry must use the same ID.
 await phone.route('**/api/stations',async route=>{await route.fetch();await route.abort('failed')},{times:1});
 await phone.locator('#createStation').click();await phone.getByText('资料已保留',{exact:false}).waitFor();
 await phone.locator('#createStation').click();await phone.waitForURL('**/#station/**');await phone.waitForFunction(()=>!creatingStation);assert.equal(await phone.evaluate(()=>state.stations.length),count+1);
 const id=await phone.evaluate(()=>route().id);assert.equal(await phone.evaluate(()=>stationModule(stationBy(route().id))),'selection');
 await desktop.locator('#cloudRefreshNow').click();await desktop.waitForFunction(n=>state.stations.length===n,count+1);
 await desktop.locator('#globalSearch').fill(name);await desktop.locator('#searchForm button').click();await desktop.locator('.row[data-open]').waitFor();assert.equal(await desktop.locator('.row[data-open]').count(),1);await desktop.goto(base+'/#home');
 await pad.reload();await pad.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await pad.evaluate(()=>state.stations.length),count+1);
 await phone.locator('#editProgressBtn').click();await phone.locator('#progressText').fill('手机修改已落库');await phone.locator('#cloudRefreshNow').click();assert.equal(await phone.locator('#progressText').inputValue(),'手机修改已落库');await phone.locator('#saveProgress').click();await phone.waitForFunction(()=>!cloudSync.dirty);
 await phone.reload();await phone.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await phone.evaluate(()=>stationBy(route().id).selectionProgress),'手机修改已落库');
 // A failed edit remains durable across reload; reconnection submits it safely.
 await phone.locator('#editProgressBtn').click();await phone.locator('#progressText').fill('离线恢复验证');await mobile.setOffline(true);await phone.locator('#saveProgress').click();await phone.waitForFunction(()=>cloudSync.writeFailed&&cloudSync.dirty);assert(await phone.evaluate(()=>!!localStorage.getItem(CLOUD_OUTBOX_KEY)));
 await mobile.setOffline(false);await phone.evaluate(()=>window.dispatchEvent(new Event('online')));await phone.waitForFunction(()=>!cloudSync.dirty);await phone.reload();await phone.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await phone.evaluate(()=>stationBy(route().id).selectionProgress),'离线恢复验证');
 await desktop.locator('#cloudRefreshNow').click();await desktop.waitForFunction(id=>stationBy(id)?.selectionProgress==='离线恢复验证',id);
 for(const p of [phone,pad,desktop]){
  for(const route of ['home','selection','difficult','pending','building','complete','calendar','station/'+id,'new-station']){await p.goto(base+'/#'+route);await p.waitForTimeout(60);await noOverflow(p,route+' '+p.viewportSize().width)}
  await p.goto(base+'/#home');await p.screenshot({path:path.join(evidence,'home-'+p.viewportSize().width+'.png'),fullPage:true});
 }
 // Also inspect existing difficult and construction forms, where inline min-widths used to overflow.
 for(const module of ['difficult','pending','building','complete']){const sid=await phone.evaluate(m=>state.stations.find(s=>stationModule(s)===m).id,module);await phone.goto(base+'/#station/'+sid);await phone.locator('#editBaseBtn').click();await noOverflow(phone,module+' base edit');await phone.screenshot({path:path.join(evidence,module+'.png'),fullPage:true})}
 await phone.goto(base+'/#selection');await phone.locator('.sort-handle').first().scrollIntoViewIfNeeded();const before=await phone.locator('.module-sort-row').evaluateAll(rs=>rs.map(r=>r.dataset.open));
 const from=await phone.locator('.sort-handle').first().boundingBox(),to=await phone.locator('.module-sort-row').nth(1).boundingBox();const cdp=await mobile.newCDPSession(phone);
 const x=from.x+from.width/2,y=from.y+from.height/2,target=to.y+to.height-8;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(target-y)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await phone.waitForFunction(first=>document.querySelector('.module-sort-row').dataset.open!==first,before[0]);assert.equal(await phone.locator('.module-sort-row').nth(1).getAttribute('data-open'),before[0]);
 await phone.reload();await phone.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await phone.locator('.module-sort-row').nth(1).getAttribute('data-open'),before[0]);
 await phone.goto(base+'/#home');const download=phone.waitForEvent('download');await phone.locator('#exportLedger').click();await (await download).saveAs(path.join(evidence,'ledger.xlsx'));assert(fs.readFileSync(path.join(evidence,'ledger.xlsx')).includes(Buffer.from(name)),'new station exported');
 await phone.getByText('数据备份',{exact:true}).click();const backup=phone.waitForEvent('download');await phone.locator('#backupData').click();await(await backup).saveAs(path.join(evidence,'backup.json'));const raw=fs.readFileSync(path.join(evidence,'backup.json'),'utf8');assert.equal(await phone.evaluate(raw=>validateBackup(raw).stations.length,raw),count+1);
 // Small portrait and landscape viewport checks, including a keyboard-sized viewport.
 for(const size of [{width:320,height:640},{width:390,height:400},{width:844,height:390}]){await phone.setViewportSize(size);for(const route of ['home','selection','new-station','station/'+id]){await phone.goto(base+'/#'+route);await noOverflow(phone,JSON.stringify(size)+' '+route)}}
 assert.deepEqual(errors,[]);console.log('PASS Chrome: phone touch drag, desktop/tablet sync, new save/reload, lost response retry, offline edit recovery, dynamic backup/export, all modules and narrow layouts');
 }finally{await b.close()}
 if(fs.existsSync(pw.webkit.executablePath())){const b=await pw.webkit.launch({headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
 const secure='https://127.0.0.1:8788',p=await login(c,secure);await p.goto(secure+'/#new-station');await noOverflow(p,'WebKit create');
 await p.locator('[name=operator]').selectOption('电信');await p.locator('[name=demandName]').fill(name+'-webkit');await p.locator('#createStation').click();await p.waitForURL('**/#station/**');
 await p.reload();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await p.evaluate(()=>stationBy(route().id).demandName),name+'-webkit');assert.equal(await p.evaluate(()=>due(stationBy(route().id))),false,'new site is not immediately overdue');
 await p.screenshot({path:path.join(evidence,'webkit-created.png'),fullPage:true});console.log('PASS WebKit HTTPS: login, new station form, persistence and phone layout');
 }finally{await b.close()}}else console.log('NOT RUN WebKit: runtime unavailable; no iPhone hardware test');
 console.log('Evidence: '+evidence);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 const {DatabaseSync}=require('node:sqlite'),dir='cloudflare/.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
 for(const file of fs.readdirSync(dir).filter(n=>n.endsWith('.sqlite'))){const db=new DatabaseSync(path.join(dir,file));try{if(!db.prepare("SELECT name FROM sqlite_master WHERE name='feixi_stations'").get())continue;db.prepare("DELETE FROM feixi_stations WHERE json_extract(data,'$.station.demandName') LIKE ?").run(name+'%');db.exec("UPDATE feixi_meta SET data=json_set(data,'$.stationCount',(SELECT count(*) FROM feixi_stations)) WHERE id='main'")}finally{db.close()}}
});
