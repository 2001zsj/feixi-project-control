const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.env.AUDIT_HTML || path.join(root, 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source); // Includes the real bootstrap in syntax validation.
const bootIndex=source.includes('try{load()}')?source.lastIndexOf('try{load()}'):source.lastIndexOf('load();const app=');
const code = source.slice(0, bootIndex);
function boot(raw = null, options = {}) {
  const storage = new Map(raw === null ? [] : [['feixi-v072-state', raw]]);
  const elements = new Map();
  const node = id => {
    if (!elements.has(id)) elements.set(id, {value:'',innerHTML:'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},click(){}});
    return elements.get(id);
  };
  const ctx = vm.createContext({console,Date,Blob,TextEncoder,Uint8Array,DataView,Map,Set,
    setTimeout(){},alert(t){ctx.alerts.push(t)},confirm(){return true},prompt(){return ''},alerts:[],
    location:{hash:''},history:{back(){}},app:node('app'),
    document:{getElementById:node,querySelectorAll(){return []},createElement(){return node('download')},body:{prepend(){}}},
    URL:{createObjectURL(b){ctx.blob=b;return 'blob:audit'},revokeObjectURL(){}},
    localStorage:{getItem(k){return storage.get(k)??null},setItem(k,v){if(options.quota)throw Error('quota');storage.set(k,v)}}
  });
  vm.runInContext(code,ctx);
  ctx.run = js => vm.runInContext(js,ctx);
  ctx.run("today=()=> '2026-09-20'");
  ctx.storage=storage;ctx.node=node;
  return ctx;
}
const results=[];
function test(name,fn){try{fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message.slice(0,600)})}}
const fresh=boot();fresh.load();
const baseline=JSON.stringify(fresh.state);
function seeded(){return boot(baseline)}
test('75 stations and unique IDs',()=>{assert.equal(fresh.state.stations.length,75);assert.equal(new Set(fresh.state.stations.map(s=>s.id)).size,75)});
test('module counts 16/11/8/13/27',()=>{
 const counts=['selection','difficult','pending','building','complete'].map(p=>{fresh.renderList(p);return (fresh.app.innerHTML.match(/class="row /g)||[]).length});assert.deepEqual(counts,[16,11,8,13,27]);
});
test('48 workdays example August 20',()=>assert.equal(fresh.addConstructionDays('2026-08-20',48),'2026-10-30'));
test('48 workdays example September 9',()=>assert.equal(fresh.addConstructionDays('2026-09-09',48),'2026-11-19'));
test('makeup days and holidays',()=>{for(const s of ['2026-09-20','2026-10-10'])assert.equal(fresh.isConstructionWorkday(s),true);for(const s of ['2026-09-19','2026-09-25','2026-10-01'])assert.equal(fresh.isConstructionWorkday(s),false)});
test('inclusive day 1 and day 48',()=>{assert.equal(fresh.constructionDayOrdinal('2026-08-20','2026-08-20'),1);assert.equal(fresh.constructionDayOrdinal('2026-08-20','2026-10-30'),48);assert.equal(fresh.constructionDayOrdinal('2026-09-19','2026-09-19'),0)});
test('natural day node calculation without timezone shift',()=>{assert.equal(fresh.addDate('2026-09-09',7),'2026-09-16');assert.equal(fresh.addDate('2026-09-19',3),'2026-09-22');assert.equal(fresh.addDate('2026-09-19',28),'2026-10-17')});
test('unknown year stops calculation',()=>{assert.equal(fresh.addConstructionDays('2026-12-01',48),'');assert.equal(fresh.constructionDaysBetween('2026-12-31','2027-01-04'),null)});
test('reverse workday distance counts days after deadline',()=>assert.equal(fresh.constructionDaysBetween('2026-11-02','2026-10-30'),-1));
test('non-working day after deadline does not invent elapsed workday',()=>assert.equal(fresh.constructionDaysBetween('2026-11-01','2026-10-30'),0));
test('7 yellow / 6 red / deadline red / overdue red',()=>{
 const c=seeded();c.load();const s=c.state.stations.find(s=>s.id==='design-2026-049');
 for(const [date,remain,level] of [['2026-10-21',7,'warn'],['2026-10-22',6,'bad'],['2026-10-30',0,'bad'],['2026-11-02',-1,'bad']]){c.run(`today=()=> '${date}'`);const m=c.scheduleMeta(s);assert.equal(m.remain,remain);assert.equal(m.level,level)}
});
test('invalid dates rejected',()=>assert.equal(fresh.parseDate('2026-02-31'),null));
test('historical late node remains',()=>assert.equal(fresh.nodeDeadlineMeta({establishDate:'2026-09-01',entryDate:'2026-09-10',pourDate:'2026-09-13'}).nodeOverdue,true));
test('unknown year does not suppress natural node warning',()=>assert.equal(fresh.scheduleMeta({establishRef:'TEST',establishDate:'2026-12-01',entryDate:'2026-12-10'}).nodeOverdue,true));
test('corrupt storage is not overwritten by seed',()=>{const c=boot('{broken');try{c.load()}catch{}assert.equal(c.storage.get('feixi-v072-state'),'{broken')});
test('save failures are reported',()=>{const c=boot(null,{quota:true});c.state=JSON.parse(baseline);assert.throws(()=>c.save())});
test('migration preserves unknown and historical fields',()=>{const c=seeded();c.load();c.state.stations[0].nodeOverdueReasonManual='历史用户原因';c.state.stations[0].futureField={note:'用户记录'};c.mergeLatestBase();assert.equal(c.state.stations[0].nodeOverdueReasonManual,'历史用户原因');assert.equal(c.state.stations[0].futureField.note,'用户记录')});
test('known duplicate order never merges stations',()=>{const c=seeded();c.load();for(const s of c.state.stations.filter(s=>s.demandOrder==='1226041515562086')){s.id='old-'+s.id;s.towerName='唯一标记-'+s.demandName}c.mergeLatestBase();for(const s of c.state.stations.filter(s=>s.demandOrder==='1226041515562086'))assert.equal(s.towerName,'唯一标记-'+s.demandName)});
test('one old record cannot be reused by ID and name',()=>{const c=seeded();c.load();const a=c.state.stations[0],b=c.state.stations[1];a.demandName=b.demandName;a.towerName='不应跨站';c.state.stations=c.state.stations.filter(s=>s.id!==b.id);try{c.mergeLatestBase()}catch{return}assert.notEqual(c.state.stations.find(s=>s.id===b.id).towerName,'不应跨站')});
test('Huayi tower mapping',()=>assert.equal(fresh.state.stations.find(s=>s.id==='design-2026-026').towerName,'肥西横排头路与将军岭中路交口东南'));
test('repeated load is idempotent',()=>{const c=seeded();c.load();const once=JSON.stringify(c.state);c.load();assert.equal(JSON.stringify(c.state),once)});
test('new project code overrides stale selection flag',()=>{const c=seeded();c.load();c.state.stations[1].establishRef='TEST-PROJECT';c.renderList('building');assert.ok(c.app.innerHTML.includes('design-2026-002'));c.renderList('selection');assert.ok(!c.app.innerHTML.includes('design-2026-002'))});
test('completed station cannot appear in selection',()=>{const c=seeded();c.load();c.state.stations[1].completeConfirmed=true;c.renderList('selection');assert.ok(!c.app.innerHTML.includes('design-2026-002'));assert.equal(c.due(c.state.stations[1]),false)});
test('no code with historical date still shows pending',()=>{const c=seeded();c.load();const s=c.state.stations.find(s=>s.id==='design-2026-005');s.establishDate='2026-09-01';assert.ok(c.constructionHtml(s).includes('待立项状态'))});
test('same-day pouring and tower entry refused in both directions',()=>{for(const k of ['towerDate','pourDate']){const c=seeded();c.load();const s=c.state.stations.find(s=>s.id==='design-2026-049');s.entryDate='2026-09-01';s.pourDate=k==='towerDate'?'2026-09-10':'';s.towerDate=k==='pourDate'?'2026-09-10':'';c.bindConstruction(s);c.node('nodeSel').value=k;c.node('nodeDate').value='2026-09-10';c.node('saveNode').onclick();assert.equal(s[k],'')}});
test('recent filter excludes never updated disabled stations',()=>{const c=seeded();c.load();c.renderList('selection',{follow:'recent'});assert.ok(!c.app.innerHTML.includes('design-2026-002'))});
test('pending export follows website status',()=>{const c=seeded();c.load();c.exportXls(c.state.stations.filter(s=>s.selectionDone&&!s.establishRef&&!c.isComplete(s)),'pending');assert.ok(c.blob);});
test('safe HTML escaping in user text',()=>assert.equal(fresh.esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;'));
test('old cache upgrade keeps full original backup',()=>{const old=JSON.parse(baseline);old.baseDataVersion='old';old.stations[0].customUserNote='保留';const raw=JSON.stringify(old),c=boot(raw);c.load();assert.equal(c.storage.get('feixi-v072-state:before-audit-v1'),raw);assert.equal(c.state.stations[0].customUserNote,'保留');assert.equal(c.state.stations.length,75)});
test('unmatched old station stops migration without losing original',()=>{const old=JSON.parse(baseline);old.baseDataVersion='old';old.stations[0].id='UNKNOWN';old.stations[0].demandName='不能猜测';old.stations[0].demandOrder='UNKNOWN';const raw=JSON.stringify(old),c=boot(raw);assert.throws(()=>c.load());assert.equal(c.storage.get('feixi-v072-state'),raw)});
test('duplicate fixed IDs stop load without writing',()=>{const old=JSON.parse(baseline);old.stations[0].id=old.stations[1].id;const raw=JSON.stringify(old),c=boot(raw);assert.throws(()=>c.load());assert.equal(c.storage.get('feixi-v072-state'),raw)});
test('stale tab cannot overwrite other tab save',()=>{const c=seeded();c.load();c.storage.set('feixi-v072-state','other-tab-snapshot');assert.throws(()=>c.save());assert.equal(c.storage.get('feixi-v072-state'),'other-tab-snapshot')});
test('first migration backup is not overwritten on next load',()=>{const c=seeded();c.load();const raw=c.storage.get('feixi-v072-state:before-audit-v1');c.state.stations[0].selectionProblem='更新';c.save();c.load();assert.equal(c.storage.get('feixi-v072-state:before-audit-v1'),raw)});
test('unique order fallback succeeds only for unassigned legacy IDs',()=>{const c=seeded();c.load();const old=c.state.stations[0];old.id='legacy';old.demandName='历史精确名称已改变';old.towerName='明确已确认值';c.mergeLatestBase();assert.equal(c.state.stations[0].towerName,'明确已确认值')});
test('duplicate old names stop ambiguous fallback',()=>{const c=seeded();c.load();const a=c.state.stations[0],b=c.state.stations[1];a.id='legacy-a';b.id='legacy-b';b.demandName=a.demandName;assert.throws(()=>c.mergeLatestBase())});
test('unknown current year stops workday assessment even for old deadline',()=>{const c=seeded();c.load();c.run("today=()=> '2027-01-01'");const m=c.scheduleMeta(c.state.stations.find(s=>s.id==='design-2026-049'));assert.equal(m.remain,null);assert.match(m.reason,/未配置年度/)});
test('natural day count crosses DST without losing a day',()=>assert.equal(fresh.days('2026-03-07','2026-03-09'),2));
test('positive/negative workday intervals symmetric',()=>{const dates=['2026-09-19','2026-09-20','2026-09-25','2026-10-01','2026-10-10','2026-10-30','2026-11-02'];for(const a of dates)for(const b of dates)assert.equal(fresh.constructionDaysBetween(a,b)+fresh.constructionDaysBetween(b,a),0)});
test('48-day ordinal and remaining identity across calendar boundaries',()=>{for(const start of ['2025-01-01','2025-09-28','2026-01-01','2026-04-30','2026-09-19']){const deadline=fresh.addConstructionDays(start,48);assert.equal(fresh.constructionDayOrdinal(start,deadline),48);for(const n of [1,7,24,47,48]){const d=fresh.addConstructionDays(start,n);assert.equal(fresh.constructionDayOrdinal(start,d)+fresh.constructionDaysBetween(d,deadline),48)}}});
test('entry and tower same day remains allowed',()=>{const c=seeded();c.load();const s=c.state.stations.find(s=>s.id==='design-2026-049');s.entryDate='2026-09-20';s.pourDate='';s.towerDate='';c.bindConstruction(s);c.node('nodeSel').value='towerDate';c.node('nodeDate').value='2026-09-20';c.node('saveNode').onclick();assert.equal(s.towerDate,'2026-09-20')});
test('separate selection timestamps do not contaminate each other',()=>{const c=seeded();c.load();const s=c.state.stations[0];s.selectionProgressUpdatedAt='2026-09-01T10:00';s.selectionProblemUpdatedAt='2026-09-20T10:00';s.isDifficultSite=true;assert.equal(c.lastFollow(s),'2026-09-20T10:00');s.isDifficultSite=false;assert.equal(c.lastFollow(s),'2026-09-01T10:00');assert.equal(c.due(s),true)});
test('suspended work does not extend 48-day deadline',()=>{const c=seeded();c.load();const s=c.state.stations.find(s=>s.id==='design-2026-049');const due=c.scheduleMeta(s).totalDue;s.isPaused=true;s.pauseStart='2026-08-25';assert.equal(c.scheduleMeta(s).totalDue,due)});
// Original unresolved observations remain on disk; preset-safety.cjs locks down the repaired load path.
fs.mkdirSync(path.join(root,'audit-evidence'),{recursive:true});
fs.writeFileSync(path.join(root,'audit-evidence',process.env.AUDIT_RESULT||'unit-results.json'),JSON.stringify({timezone:process.env.TZ,results},null,2));
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.pass?'':': '+r.error}`);
console.log(`${results.filter(x=>x.pass).length}/${results.length} passed`);
if(results.some(x=>!x.pass))process.exitCode=1;
module.exports={boot,baseline,root};
