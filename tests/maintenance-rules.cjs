const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const rules=require('../tools/station-rules.cjs');
const html=fs.readFileSync('cloudbase-dist/index.html','utf8'),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
const c=vm.createContext({Date,Map,Set,URL,URLSearchParams,console});vm.runInContext(script,c);const run=s=>vm.runInContext(s,c);
run(`today=()=> '2026-10-20';state={stations:[
 {id:'early',constructionBeforeEstablishment:true,establishDate:'2026-10-13',entryDate:'2026-10-01',pourDate:'2026-10-06'},
 {id:'roof',constructionType:'rooftop',towerDate:'2026-10-15'},
 {id:'ground',establishDate:'2026-10-13',entryDate:'2026-10-01'},
 {id:'deleted',deletedAt:'2026-10-19 12:00',towerDate:'2026-10-15'}]};`);
assert.deepEqual(Array.from(run('smartDataIssues().map(x=>x.s.id)')),['ground'],'special site rules must match homepage data checks');
const original={id:'x',establishRef:'KEEP',establishDate:'2026-10-12',entryDate:'2026-10-13',priorProjectHistory:[{establishRef:'OLD'}]};
const deleted={...original,deletedAt:'2026-10-20 12:00',lastUpdate:'2026-10-20'};
assert.doesNotThrow(()=>rules.assertStationChange(original,deleted,'2026-10-20'));
assert.doesNotThrow(()=>rules.assertStationChange(deleted,{...original,lastUpdate:'2026-10-20'},'2026-10-20'));
for(const patch of [{constructionType:'invalid'},{deletedAt:true},{deletedAt:'not-a-date'},{deletedAt:'2026-02-30 12:00'}])assert.throws(()=>rules.assertStationChange(original,{...original,...patch},'2026-10-20'));
assert.throws(()=>rules.assertStationChange(original,{...deleted,entryDate:'2026-10-14'},'2026-10-20'),'deleting must not alter actual nodes');
assert.throws(()=>rules.assertStationChange(deleted,{...original,towerName:'overwritten'},'2026-10-20'),'restoring must not overwrite business fields');
assert.doesNotThrow(()=>rules.assertStationChange({...original,constructionType:'rooftop'},original,'2026-10-20',true));
console.log('PASS maintenance: rooftop/early-construction data checks, genuine ground errors, type validation and non-destructive deletion/recovery');
