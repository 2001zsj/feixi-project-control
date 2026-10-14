const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const html=fs.readFileSync('cloudbase-dist/index.html','utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--no-proxy-server']});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.route('http://fxtt.test/**',route=>route.fulfill({contentType:'text/html',body:html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')}));
   await page.goto('http://fxtt.test/');await page.addScriptTag({content:script});
   await page.evaluate(()=>{today=()=> '2026-10-13';save=()=>{};toast=()=>{};});
   for(const early of [false,true]){
    const original={id:'test-code',demandName:'仅测试项目编码',selectionDone:true,establishRef:'',establishDate:'',entryDate:early?'2026-10-01':'',pourDate:early?'2026-10-06':'',constructionStarted:early,constructionBeforeEstablishment:early,pourConfirmed:early,priorProjectHistory:[{establishRef:'ARCHIVED-CODE'}]};
    await page.evaluate(station=>{state={stations:[station]};renderStation(station.id)},original);
    await page.locator('#editBaseBtn').click();
    assert.equal(await page.locator('#be_establishRef').evaluate(el=>el.readOnly),false,'blank project code must be editable in basic information');
    await page.locator('#be_establishRef').fill(' LOCAL-CODE-ONLY ');
    await page.locator('#be_towerName').fill('仅测试铁塔站名');
    await page.locator('#saveBase').click();
    const actual=await page.evaluate(()=>({station:state.stations[0],undo:stationHistoryList('test-code','undo')}));
    assert.equal(actual.station.establishRef,'LOCAL-CODE-ONLY');assert.equal(actual.station.towerName,'仅测试铁塔站名');
    assert.equal(actual.station.establishDate,'');assert.equal(actual.station.entryDate,original.entryDate);assert.equal(actual.station.pourDate,original.pourDate);
    assert.deepEqual(actual.station.priorProjectHistory,original.priorProjectHistory);
    assert.equal(actual.undo.length,1);assert.deepEqual(actual.undo[0].snapshot,original);
    await page.locator('#editBaseBtn').click();assert.equal(await page.locator('#be_establishRef').evaluate(el=>el.readOnly),true);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await page.evaluate(()=>{state={stations:[{id:'roof-test',selectionDone:true,demandName:'楼面工期测试',establishRef:'LOCAL-ROOF-ONLY',establishDate:'2026-10-12',entryDate:'2026-10-13'}]};renderStation('roof-test')});
   await page.locator('#editBaseBtn').click();await page.locator('#be_constructionType').selectOption('rooftop');await page.locator('#saveBase').click();
   assert.equal(await page.evaluate(()=>stationBy('roof-test').constructionType),'rooftop');assert.equal(await page.evaluate(()=>scheduleMeta(stationBy('roof-test')).totalDue),'2026-11-18');
   assert((await page.locator('#app').innerText()).includes('/28 工作日'));assert.equal(await page.evaluate(()=>stationBy('roof-test').entryDate),'2026-10-13');
   console.log('PASS '+width+'px: basic-info code entry, retained dates/history, single undo, established-code protection and rooftop selector/28-day display');await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
