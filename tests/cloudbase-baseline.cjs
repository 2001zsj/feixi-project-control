// Uses only the captured CloudBase rows and the deployed-source file, never SEED as business data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file=process.argv[2];
if(!file)throw Error('Usage: node tests/cloudbase-baseline.cjs <snapshot.json>');
const bytes=fs.readFileSync(file),snapshot=JSON.parse(bytes);
const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'manifest.json')));
const html=fs.readFileSync(path.join(__dirname,'../cloudbase-dist/index.html'),'utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
new vm.Script(script);
const ctx=vm.createContext({console,Date,Map,Set,URL,URLSearchParams,structuredClone});
vm.runInContext(script,ctx);
ctx.rows=snapshot.stations;
vm.runInContext(`
  state={...${JSON.stringify(snapshot.meta[0].data.meta)},stations:rows.map(r=>r.data.station),stationUndoHistory:{},stationRedoHistory:{}};
  today=()=> '2026-09-26';
`,ctx);
const run=s=>vm.runInContext(s,ctx),results=[];
function check(name,fn){try{fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
const stations=snapshot.stations.map(r=>r.data.station),byId=id=>stations.find(s=>s.id===id);
check('snapshot SHA-256 and stable double read',()=>{assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.equal(snapshot.stableAcrossTwoReads,true)});
check('76 unique row IDs equal embedded station IDs',()=>{assert.equal(stations.length,76);assert.equal(new Set(stations.map(s=>s.id)).size,76);for(const r of snapshot.stations){assert.equal(r.id,r.data.station.id);assert.ok(Number.isSafeInteger(Number(r.revision))&&Number(r.revision)>0)}});
check('current source accepts captured roster',()=>assert.equal(run('cloudValidateState(state).stations.length'),76));
check('every station has one module; counts match latest reference',()=>{const counts={selection:0,difficult:0,pending:0,building:0,complete:0};for(const m of run('state.stations.map(stationModule)')){assert.ok(Object.hasOwn(counts,m));counts[m]++}assert.deepEqual(counts,{selection:9,difficult:18,pending:11,building:11,complete:27});assert.deepEqual(JSON.parse(run('JSON.stringify(cloudModuleCounts(state))')),counts)});
check('022 pending with archived project and latest manual progress',()=>{const s=byId('design-2026-022');assert.equal(s.establishRef,'');assert.equal(s.selectionDone,true);assert.equal(s.constructionProblem,false);assert.ok(s.priorProjectHistory.some(p=>p.establishRef==='26A09AHHF011005046'));assert.equal(s.pendingEstablishProgress,'重新立项');assert.equal(run("stationModule(stationBy('design-2026-022'))"),'pending')});
check('047 actual entry/pour and curing',()=>{const s=byId('design-2026-047');assert.equal(s.entryDate,'2026-09-22');assert.equal(s.pourDate,'2026-09-23');assert.equal(run("deriveStationState(stationBy('design-2026-047')).stage"),'养护中')});
check('066 entry only; planned pour/tower not promoted',()=>{const s=byId('design-2026-066');assert.equal(s.entryDate,'2026-09-24');assert.equal(s.pourDate,'');assert.equal(s.towerDate,'');assert.equal(run("deriveStationState(stationBy('design-2026-066')).stage"),'待浇筑')});
check('071 actual 09-22 pour preserved',()=>assert.equal(byId('design-2026-071').pourDate,'2026-09-22'));
check('three remote receipts and undo snapshots preserved',()=>{const q=JSON.parse(fs.readFileSync(path.join(__dirname,'../cloudbase-dist/remote-updates.json')));for(const cmd of q.commands){const row=snapshot.stations.find(r=>r.id===cmd.stationId);assert.ok(row.data.appliedRemoteCommands.includes(cmd.id));assert.ok(row.data.undo.length>0)}});
check('reading states does not mutate any captured station',()=>{const before=JSON.stringify(stations);run('state.stations.forEach(s=>{deriveStationState(s);scheduleMeta(s)})');assert.equal(JSON.stringify(stations),before)});
check('pause keeps existing 48-workday deadline',()=>{assert.equal(run("scheduleMeta({...stationBy('design-2026-047'),isPaused:true,pauseStart:'2026-09-24'}).totalDue"),run("scheduleMeta(stationBy('design-2026-047')).totalDue"))});
const report={snapshot:path.resolve(file),source:'cloudbase-dist/index.html',asOf:'2026-09-26',results,
  acceptanceScope:'Read-only baseline and source-level checks only; no production UI, second device, concurrent write or undo acceptance.'};
fs.writeFileSync(path.join(path.dirname(file),'validation.json'),JSON.stringify(report,null,2)+'\n');
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.error?': '+r.error:''}`);
console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);
if(results.some(r=>!r.pass))process.exitCode=1;
