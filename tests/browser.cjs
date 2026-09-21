const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'audit-evidence');
const origin='http://127.0.0.1:8766';
const key='feixi-v072-state';
(async()=>{
 const server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html')))});
 await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',acceptDownloads:true});
 const page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 const test=async(name,fn)=>{try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message)}};
 await page.goto(origin);
 await page.waitForSelector('.summary');
 const baseline=await page.evaluate(k=>localStorage.getItem(k),key);
 const reset=async()=>{await page.evaluate(([k,v])=>localStorage.setItem(k,v),[key,baseline]);await page.reload();await page.waitForSelector('.summary, .rows, .base');};
 const nav=async(p)=>{await page.locator(`.nav [data-page="${p}"]`).click();await page.waitForFunction(p=>location.hash==='#'+p&&document.querySelector('.nav button.on')?.dataset.page===p,p);};
 await test('desktop modules and downloads',async()=>{
  for(const [module,count] of [['selection',16],['difficult',11],['pending',8],['building',13],['complete',27]]){
   await nav(module);assert.equal(await page.locator('.row').count(),count);
   const download=page.waitForEvent('download');await page.locator('#exportBtn').click();const d=await download;await d.saveAs(path.join(out,module+'.xlsx'));
  }
  await nav('building');await page.screenshot({path:path.join(out,'desktop-after.png'),fullPage:true});
  const problems=await page.locator('.row').evaluateAll(rows=>rows.slice(0,2).every(r=>r.classList.contains('problem-row')));assert.ok(problems);
 });
 await test('UI status transition on project code save and completion',async()=>{
  await page.goto(origin+'/#station/design-2026-028');await page.locator('#editBaseBtn').click();await page.locator('#be_establishRef').fill('AUDIT-ONLY');await page.locator('#saveBase').click();
  assert.ok((await page.locator('#app').innerText()).includes('施工中'));await nav('building');assert.equal(await page.locator('.row').count(),14);
  await page.goto(origin+'/#station/design-2026-028');await page.locator('#estDate').fill('2026-09-09');await page.locator('#saveEst').click();
  await page.locator('#nodeSel').selectOption('completeDate');await page.locator('#nodeDate').fill('2026-09-20');await page.locator('#saveNode').click();
  assert.ok((await page.locator('#app').innerText()).includes('完工归档'));await nav('complete');assert.equal(await page.locator('.row').count(),28);
  await nav('selection');assert.equal(await page.locator('.row').count(),15);await reset();
 });
 await test('normal and difficult streams survive UI switching',async()=>{
  await page.goto(origin+'/#station/design-2026-028');await page.locator('#editProgressBtn').click();await page.locator('#progressText').fill('测试进展保留');await page.locator('#saveProgress').click();
  const progressTime=await page.evaluate(()=>stationBy('design-2026-028').selectionProgressUpdatedAt);
  await page.locator('#toggleDifficult').click();await page.locator('#editProblemBtn').click();await page.locator('#problemText').fill('测试问题保留');await page.locator('#problemStatus').selectOption({label:'已解决'});await page.locator('#saveProblem').click();
  const problemTime=await page.evaluate(()=>stationBy('design-2026-028').selectionProblemUpdatedAt);
  await page.locator('#toggleDifficult').click();assert.ok((await page.locator('.problem').innerText()).includes('测试进展保留'));
  await page.locator('#toggleDifficult').click();assert.ok((await page.locator('.problem').innerText()).includes('测试问题保留'));
  const s=await page.evaluate(()=>stationBy('design-2026-028'));assert.equal(s.selectionProblemStatus,'已解决');assert.equal(s.selectionProgressUpdatedAt,progressTime);assert.equal(s.selectionProblemUpdatedAt,problemTime);
  await page.reload();assert.ok((await page.locator('.problem').innerText()).includes('测试问题保留'));await reset();
 });
 await test('old #schedule route goes to building only',async()=>{await page.goto(origin+'/#schedule');assert.equal(await page.locator('h1').innerText(),'施工中');assert.equal(await page.locator('.nav [data-page="schedule"]').count(),0)});
 await test('calendar and date badges',async()=>{await nav('calendar');assert.equal(await page.locator('.calmonth').count(),12);assert.equal(await page.locator('.calday.makeup-work').count(),6)});
 await test('mobile/tablet/desktop layout and visible status',async()=>{
  for(const width of [360,390,768,1280]){
   await page.setViewportSize({width,height:900});
   for(const module of ['home','selection','difficult','pending','building','complete','calendar']){
    await nav(module);
    const dims=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));assert.ok(dims.s<=dims.w+1,`${width} ${module} overflows ${dims.s}`);
   }
   await nav('building');assert.ok(await page.locator('.row .mobilehide').first().isVisible());
   if(width===390)await page.screenshot({path:path.join(out,'mobile-after.png'),fullPage:true});
   await page.goto(origin+'/#station/design-2026-009');await page.locator('#editBaseBtn').click();
   const dims=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));assert.ok(dims.s<=dims.w+1,`${width} edit overflows ${dims.s}`);
   if(width===390)await page.screenshot({path:path.join(out,'mobile-edit-after.png'),fullPage:true});
  }
 });
 await test('no runtime exceptions in happy paths',async()=>assert.deepEqual(errors,[]));
 await context.close();
 const corrupt=await browser.newContext();await corrupt.addInitScript(k=>localStorage.setItem(k,'{broken'),key);const cp=await corrupt.newPage();await cp.goto(origin);await cp.waitForSelector('.err');
 await test('corrupt real browser storage remains untouched',async()=>assert.equal(await cp.evaluate(k=>localStorage.getItem(k),key),'{broken'));
 await corrupt.close();
 await test('real browser upgrade preserves manual code and exposes conflicts',async()=>{
  const old=JSON.parse(baseline);delete old.presetSafetyVersion;delete old.selectionPendingCorrectionVersion;
  old.stations.find(s=>s.id==='design-2026-005').establishRef='MANUAL-NEW-CODE';
  const raw=JSON.stringify(old),migration=await browser.newContext();
  await migration.addInitScript(([k,v])=>{if(localStorage.getItem(k)===null)localStorage.setItem(k,v)},[key,raw]);
  const mp=await migration.newPage();await mp.goto(origin);
  assert.ok(await mp.locator('#migrationNotice').isVisible());await mp.locator('#migrationNotice summary').click();
  assert.ok((await mp.locator('#migrationNotice').innerText()).includes('MANUAL-NEW-CODE'));
  const value=await mp.evaluate(k=>JSON.parse(localStorage.getItem(k)).stations.find(s=>s.id==='design-2026-005').establishRef,key);
  assert.equal(value,'MANUAL-NEW-CODE');assert.equal(await mp.evaluate(k=>localStorage.getItem(k+':before-preset-safety-v1'),key),raw);
  await mp.screenshot({path:path.join(out,'migration-conflicts.png'),fullPage:true});await migration.close();
 });
 await browser.close();await new Promise(resolve=>server.close(resolve));
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
 console.log(results);if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
