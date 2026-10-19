const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),q=await browser.newPage({viewport:{width:390,height:900}});
 for(const page of [p,q]){await page.goto('http://127.0.0.1:8787');await page.locator('#password').fill(JSON.parse(fs.readFileSync('cloudflare/secrets.local.json','utf8')).APP_PASSWORD);await page.getByRole('button',{name:'进入工作台'}).click();await page.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready)}
 const id=await p.evaluate(()=>activeStations()[0].id),original=await p.evaluate(id=>clone(stationBy(id)),id),count=await p.evaluate(()=>activeStations().length);
 await p.evaluate(id=>go('station/'+id),id);p.once('dialog',d=>d.accept());await p.locator('#deleteStation').click();await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.syncing&&!cloudSync.lastError);
 await q.evaluate(()=>cloudRefresh(true));assert.equal(await q.evaluate(()=>activeStations().length),count-1);assert.equal(await q.evaluate(id=>stationModule(stationBy(id)),id),'trash');
 await q.evaluate(id=>go('station/'+id),id);await q.locator('[data-restore-station="'+id+'"]').waitFor();
 await p.reload();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.equal(await p.evaluate(id=>stationModule(stationBy(id)),id),'trash');
 await q.locator('[data-restore-station="'+id+'"]').click();await q.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.syncing&&!cloudSync.lastError);await p.evaluate(()=>cloudRefresh(true));assert.equal(await p.evaluate(()=>activeStations().length),count);
 const recovered=await p.evaluate(id=>clone(stationBy(id)),id);assert.deepEqual(recovered,{...original,lastUpdate:await p.evaluate(()=>today())});
 for(let i=0;i<2;i++){await p.evaluate(id=>restoreStationHistory(id),id);await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.syncing&&!cloudSync.lastError)}assert.deepEqual(await p.evaluate(id=>clone(stationBy(id)),id),original);
 console.log('PASS local D1: confirmed delete, desktop/mobile synchronization, persistence after reload, recovery with all dates/history and two undo actions');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
