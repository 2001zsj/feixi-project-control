const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html')))});
 await new Promise(r=>server.listen(8767,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage({timezoneId:'Asia/Shanghai',acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767');
 await page.locator('#backupData').waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('#backupData').click();const download=await downloadPromise;
 const backupPath=path.join(root,'audit-evidence/full-backup-test.json');await download.saveAs(backupPath);
 const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(backup.data.stations.length,75);
 assert.deepEqual(backup.data,await page.evaluate(()=>JSON.parse(storageSnapshot)));
 await page.evaluate(()=>{state.stations[0].selectionProblem='恢复前测试';state.extraTest={value:123};save()});
 await page.locator('#backupFile').setInputFiles(backupPath);await page.locator('#confirmRestore').waitFor();
 await page.locator('#restorePreview summary').click();assert.match(await page.locator('#restorePreview').innerText(),/恢复前测试/);
 await page.locator('#cancelRestore').click();assert.equal(await page.evaluate(()=>state.extraTest.value),123);
 await page.locator('#backupFile').setInputFiles(backupPath);await page.locator('#confirmRestore').click();
 assert.deepEqual(await page.evaluate(()=>state),backup.data);
 assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes(':before-restore:'))));
 await page.reload();assert.deepEqual(await page.evaluate(()=>state),backup.data);
 const failures=await page.evaluate(()=>{
   const envelope={format:'feixi-full-backup',version:1,data:clone(state)},out=[];
   const bad=clone(envelope);bad.data.stations[1].id=bad.data.stations[0].id;
   try{validateBackup(JSON.stringify(bad));out.push(false)}catch{out.push(true)}
   try{validateBackup('{}');out.push(false)}catch{out.push(true)}
   previewBackup(JSON.stringify(envelope));state.extra='changed';save();
   try{restoreBackup();out.push(false)}catch{out.push(true)}
   previewBackup(JSON.stringify({...envelope,data:{...envelope.data,extra:'restored'}}));
   const old=storageSnapshot,original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k===KEY)throw Error('quota');original.call(this,k,v)};
   window.alert=()=>{};
   try{restoreBackup();out.push(false)}catch{out.push(localStorage.getItem(KEY)===old&&state.extra==='changed')}
   Storage.prototype.setItem=original;return out;
 });assert.deepEqual(failures,[true,true,true,true]);
 await page.evaluate(()=>{today=()=> '2026-09-22';window.dispatchEvent(new Event('focus'))});
 assert.match(await page.locator('#dateStatus').innerText(),/2026-09-22/);
 await page.goto('http://127.0.0.1:8767/#station/design-2026-028');await page.locator('#editProgressBtn').click();await page.locator('#progressText').fill('未保存内容');
 await page.evaluate(()=>{today=()=> '2026-09-23';refreshDay()});
 assert.equal(await page.locator('#progressText').inputValue(),'未保存内容');assert.match(await page.locator('#dateStatus').innerText(),/保存或离开/);
 await page.locator('.nav [data-page="home"]').click();assert.match(await page.locator('#dateStatus').innerText(),/2026-09-23/);
 await page.setViewportSize({width:360,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(root,'audit-evidence/daily-tools-mobile.png'),fullPage:true});
 console.log('PASS backup download/preview/cancel/restore/reload, validation, stale preview, quota rollback, day rollover, draft protection, mobile');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
