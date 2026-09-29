// Local D1 only. Two isolated browser sessions, no production writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 async function open(width){const p=await b.newPage({viewport:{width,height:900},hasTouch:width<700});await p.goto('http://127.0.0.1:8787');await p.locator('#password').fill(JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD);await p.getByRole('button',{name:'进入工作台'}).click();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);await p.locator('[data-page="selection"]').click();await p.locator('.sort-handle').first().waitFor();return p}
 const p=await open(1440),q=await open(390);const baseline=await p.evaluate(()=>JSON.stringify(state.stations));
 const ids=await p.evaluate(()=>defaultModuleCards('selection').map(s=>s.id));const legacy=ids.slice().reverse();
 await p.evaluate(legacy=>{localStorage.setItem(MODULE_ORDER_KEY,JSON.stringify({selection:legacy}));renderList('selection')},legacy);p.on('dialog',d=>d.accept());await p.locator('#importLegacyOrder').click();await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.saving&&!cloudSync.lastError);
 await q.evaluate(()=>cloudRefresh(true));assert.deepEqual(await q.locator('.row').evaluateAll(rs=>rs.map(r=>r.dataset.open)),legacy);
 await q.locator('.sort-handle').first().press('ArrowDown');await q.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.saving&&!cloudSync.lastError);await p.evaluate(()=>cloudRefresh(true));const expected=[legacy[1],legacy[0],...legacy.slice(2)];assert.deepEqual(await p.locator('.row').evaluateAll(rs=>rs.map(r=>r.dataset.open)),expected);
 await p.reload();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);assert.deepEqual(await p.locator('.row').evaluateAll(rs=>rs.map(r=>r.dataset.open)),expected);
 // Stale writer must not silently overwrite the first writer's ordering.
 await p.locator('.sort-handle').first().press('ArrowDown');await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.saving);await q.evaluate(()=>saveModuleOrder('selection',[]));await q.waitForFunction(()=>cloudSync.conflict);assert.equal(await q.evaluate(()=>cloudSync.dirty),true);
 const fresh=await open(390);assert.deepEqual(await fresh.locator('.row').evaluateAll(rs=>rs.map(r=>r.dataset.open)),legacy);assert.equal(await fresh.evaluate(()=>JSON.stringify(state.stations)),baseline);
 await fresh.locator('#resetModuleOrder').click();await fresh.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.saving);await p.evaluate(()=>cloudRefresh(true));assert.deepEqual(await p.locator('.row').evaluateAll(rs=>rs.map(r=>r.dataset.open)),ids);
 console.log('PASS legacy import, desktop/mobile independent sessions, reorder both ways, reload, shared reset, stale-write conflict and unchanged stations');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
