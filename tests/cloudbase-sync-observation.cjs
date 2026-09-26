// Isolated reproduction of known defects, not a green product regression suite.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
  if(!process.argv[2])throw Error('Historical repro only: pass a pre-fix HTML file. Current regression: node tests/cloudbase-sync.cjs');
  const html=fs.readFileSync(process.argv[2],'utf8');
  const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
  const c=vm.createContext({console,Date,Map,Set,URL,URLSearchParams});
  vm.runInContext(code,c);
  vm.runInContext(`
    var statuses=[];
    cloudStatus=(kind,text)=>statuses.push({kind,text});
    globalThis.alert=()=>{};
    state={stations:[{id:'test-isolated',currentSituation:'base'}],stationUndoHistory:{},stationRedoHistory:{}};
    cloudSync.syncedState=clone(state);
    cloudSync.ready=true;cloudSync.metaRevision=1;cloudSync.stationRevisions.set('test-isolated',1);
    state.stations[0].currentSituation='unsynced user edit';
    cloudPushSnapshot=async()=>{throw Error('injected offline failure')};
    queueCloudSync(clone(state));
  `,c);
  await vm.runInContext('cloudSync.queue',c);
  const status=JSON.parse(vm.runInContext('JSON.stringify(statuses)',c));
  assert.equal(status.at(-1).text,'云端已同步');
  vm.runInContext(`
    cloudSync.db={from(table){let fields='';return {select(value){fields=value;return this},eq(){return this},async limit(){
      if(table===CLOUD_META_TABLE)return {data:[{revision:1}]};
      if(fields==='id,revision')return {data:[{id:'test-isolated',revision:2}]};
      return {data:[{id:'test-isolated',revision:2,data:{station:{id:'test-isolated',currentSituation:'remote edit'},undo:[],redo:[]}}]};
    }}}};
    saveLocalOnly=()=>{};render=()=>{};toast=()=>{};cloudValidateState=value=>value;
  `,c);
  await vm.runInContext('cloudRefresh(true)',c);
  const after=vm.runInContext('state.stations[0].currentSituation',c);
  assert.equal(after,'remote edit');
  const result={source:'cloudbase-dist/index.html',isolated:true,productionWrites:0,
    observed:{falseSyncedStatusAfterFailure:true,unsyncedEditReplacedByRemoteRefresh:true},statuses:status,
    note:'Expected defects reproduced; these assertions must be replaced by preservation/success-state regression tests in B0.'};
  const out=path.join(__dirname,'../audit-evidence/phase-a/sync-defect-observation.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1});
