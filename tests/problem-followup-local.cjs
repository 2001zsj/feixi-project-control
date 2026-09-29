// Local database only: test the actual editor, cloud persistence and independent sessions.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const origin='http://127.0.0.1:8787';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 async function open(width){const p=await b.newPage({viewport:{width,height:900}});await p.goto(origin);await p.locator('#password').fill(JSON.parse(fs.readFileSync('cloudflare/secrets.local.json')).APP_PASSWORD);await p.getByRole('button',{name:'进入工作台'}).click();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);return p}
 const p=await open(390);const before=await p.evaluate(()=>{const s=state.stations.find(s=>stationModule(s)==='difficult');return {id:s.id,problem:s.selectionProblem,status:s.selectionProblemStatus,n:s.selectionFollowups.length}});
 await p.evaluate(id=>{location.hash='#station/'+id;renderStation(id)},before.id);await p.locator('#editProblemFollowup').click();
 const note='本地验证最新跟进 '+Date.now()+' <测试>';await p.locator('#problemFollowupText').fill(note);
 await p.evaluate(()=>cloudRefresh());assert.equal(await p.locator('#problemFollowupText').inputValue(),note);
 await p.locator('#saveProblemFollowup').click();await p.waitForFunction(()=>!cloudSync.dirty&&!cloudSync.saving&&!cloudSync.lastError);assert.equal(await p.locator('#problemFollowupValue').innerText(),note);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const q=await open(1440);await q.evaluate(id=>renderStation(id),before.id);assert.equal(await q.locator('#problemFollowupValue').innerText(),note);
 const after=await q.evaluate(id=>{const s=stationBy(id);return {id:s.id,problem:s.selectionProblem,status:s.selectionProblemStatus,n:s.selectionFollowups.length,module:stationModule(s)}},before.id);
 assert.equal(after.problem,before.problem);assert.equal(after.status,before.status);assert.equal(after.module,'difficult');assert.equal(after.n,before.n+1);
 await q.evaluate(()=>renderList('difficult'));assert((await q.locator(`[data-open="${before.id}"]`).innerText()).includes(note));
 await p.reload();await p.waitForFunction(()=>typeof cloudSync!=='undefined'&&cloudSync.ready);await p.evaluate(id=>renderStation(id),before.id);assert.equal(await p.locator('#problemFollowupValue').innerText(),note);
 console.log('PASS problem-only followup editor, refresh protection, literal text, local cloud persistence, independent session, unchanged problem/status, list and mobile layout');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
