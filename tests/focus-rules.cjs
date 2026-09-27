const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('cloudbase-dist/index.html','utf8');
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
const c=vm.createContext({Date,Map,Set,URL,URLSearchParams,console});vm.runInContext(code,c);const run=s=>vm.runInContext(s,c);run(`today=()=> '2026-09-27'`);
const cases=[
 ['recent unresolved issue',{isDifficultSite:true,selectionProblemStatus:'未解决',selectionProblemUpdatedAt:'2026-09-27'},true],
 ['resolved issue',{isDifficultSite:true,selectionProblemStatus:'已解决'},false],
 ['legacy pending without explicit status',{selectionDone:true,pendingEstablishProgress:'重新立项'},true],
 ['explicit hold',{selectionDone:true,pendingEstablishStatus:'暂缓/无需关注'},false],
 ['normal pending',{selectionDone:true,pendingEstablishStatus:'待规划'},true],
 ['normal selection recent',{selectionProgressUpdatedAt:'2026-09-27'},false],
 ['normal selection due',{selectionProgressUpdatedAt:'2026-09-24'},true],
 ['selection hold',{selectionHold:true,selectionProgressUpdatedAt:'2026-09-20'},false],
 ['reminder disabled',{followupEnabled:false},false],
 ['construction blocker',{establishRef:'test',constructionProblem:true},true],
 ['missing establish date',{establishRef:'test'},true],
 ['historical lateness only',{establishRef:'test',establishDate:'2026-09-01',entryDate:'2026-09-10',pourDate:'2026-09-15'},false],
 ['current overdue',{establishRef:'test',establishDate:'2026-09-01'},true],
 ['completed',{completeConfirmed:true,constructionProblem:true,isDifficultSite:true},false]
];
for(const [name,s,expected] of cases){c.fixture=s;assert.equal(run('needsFocus(fixture)'),expected,name)}
run(`state={stations:[{id:'diff',isDifficultSite:true,selectionProblemUpdatedAt:'2026-09-27'},{id:'pending',selectionDone:true},{id:'problem',establishRef:'x',constructionProblem:true}]}`);
assert.equal(run('focusItems().length'),3);assert.equal(run('focusItems()[0].s.id'),'problem');assert.equal(run('new Set(focusItems().map(x=>x.s.id)).size'),3);
console.log('PASS 14 focus eligibility cases, low-priority membership, urgent-first ordering and unique rows');
if(process.argv[2]){const snap=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));c.rows=snap.stations;run('state={stations:rows.map(r=>r.data.station)}');console.log(run(`JSON.stringify({stations:state.stations.length,total:focusItems().length,modules:Object.fromEntries(['selection','difficult','pending','building','complete'].map(m=>[m,focusItems().filter(x=>stationModule(x.s)===m).length]))})`))}
