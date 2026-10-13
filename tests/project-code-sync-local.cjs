const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),q=await browser.newPage({viewport:{width:390,height:900}});
  for(const page of [p,q]){await page.goto('http://127.0.0.1:8787');await page.locator('#password').fill(JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD);await page.getByRole('button',{name:'进入工作台'}).click();await page.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready)}
  const id=await p.evaluate(()=>state.stations.find(s=>stationModule(s)==='pending').id);
  const original=await p.evaluate(id=>clone(stationBy(id)),id);
  await p.evaluate(id=>go('station/'+id),id);await p.locator('#editBaseBtn').click();
  await p.locator('#be_establishRef').fill('LOCAL-BASE-CODE-ONLY');await p.locator('#be_towerName').fill('仅本地测试铁塔站名');await p.locator('#saveBase').click();
  await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.syncing&&!cloudSync.lastError);
  await q.evaluate(()=>cloudRefresh(true));await q.evaluate(id=>go('station/'+id),id);
  assert.equal(await q.evaluate(id=>stationBy(id).establishRef,id),'LOCAL-BASE-CODE-ONLY');assert.equal(await q.evaluate(id=>stationBy(id).towerName,id),'仅本地测试铁塔站名');
  assert.equal(await q.evaluate(id=>stationModule(stationBy(id)),id),'building');assert.equal(await q.evaluate(id=>stationBy(id).establishDate||'',id),original.establishDate||'');
  await q.locator('#editBaseBtn').click();assert.equal(await q.locator('#be_establishRef').evaluate(el=>el.readOnly),true);await q.locator('#cancelBase').click();
  await p.reload();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await p.evaluate(id=>stationBy(id).establishRef,id),'LOCAL-BASE-CODE-ONLY');
  await p.evaluate(id=>restoreStationHistory(id),id);await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.syncing&&!cloudSync.lastError);
  assert.deepEqual(await p.evaluate(id=>clone(stationBy(id)),id),original);
  await q.evaluate(()=>cloudRefresh(true));assert.deepEqual(await q.evaluate(id=>clone(stationBy(id)),id),original);
  console.log('PASS local D1: base-info code + tower name synchronize across desktop/mobile, survive reload and undo together');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
