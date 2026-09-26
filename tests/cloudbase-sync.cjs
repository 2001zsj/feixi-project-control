const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'cloudbase-dist/index.html'),'utf8');
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
const results=[];
function boot(){
 const storage=new Map(),els=new Map();
 const c=vm.createContext({console,Date,Map,Set,URL,URLSearchParams,setTimeout,clearTimeout,setInterval:()=>1,
  alert(){},confirm:()=>true,window:{addEventListener(){}},document:{activeElement:null,hidden:false,addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!els.has(id))els.set(id,{textContent:'',className:'',style:{},querySelectorAll:()=>[]});return els.get(id)}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
 vm.runInContext(code,c);
 c.run=s=>vm.runInContext(s,c);c.storage=storage;c.els=els;
 c.run(`state={stations:[{id:'test-isolated',currentSituation:'base'}],stationUndoHistory:{},stationRedoHistory:{}};
  cloudSync.syncedState=clone(state);cloudSync.ready=true;cloudSync.metaRevision=1;cloudSync.stationRevisions.set('test-isolated',1);
  render=()=>{};toast=()=>{};cloudValidateState=x=>x;saveLocalOnly();`);
 return c;
}
function db(c,body=''){c.run(`cloudSync.db={from(table){let fields='';return {select(v){fields=v;return this},eq(){return this},async limit(){${body}
 if(table===CLOUD_META_TABLE)return {data:[{revision:1}]};
 if(fields==='id,revision')return {data:[{id:'test-isolated',revision:2}]};
 return {data:[{id:'test-isolated',revision:2,data:{station:{id:'test-isolated',currentSituation:'remote edit'},undo:[],redo:[]}}]};
 }}}};`)}
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+': '+e.message)}}
(async()=>{
 await test('failed write stays failed and keeps durable pending edit',async()=>{
  const c=boot();c.run(`cloudPushSnapshot=async()=>{throw Error('offline')};state.stations[0].currentSituation='local edit';save()`);await c.run('cloudSync.queue');
  assert.notEqual(c.els.get('cloudStatus').textContent,'云端已同步');assert.equal(c.run('cloudSync.writeFailed'),true);
  assert.equal(JSON.parse(c.storage.get('feixi-v072-state:cloud-outbox-v1')).snapshot.stations[0].currentSituation,'local edit');
 });
 await test('refresh cannot replace an unsynced edit after failure',async()=>{
  const c=boot();c.run(`cloudPushSnapshot=async()=>{throw Error('offline')};state.stations[0].currentSituation='local edit';save()`);await c.run('cloudSync.queue');db(c);await c.run('cloudRefresh(true)');assert.equal(c.run('state.stations[0].currentSituation'),'local edit');
 });
 await test('manual refresh does not report success while dirty',async()=>{
  const c=boot();c.run(`cloudPushSnapshot=async()=>{throw Error('offline')};state.stations[0].currentSituation='local edit';save()`);await c.run('cloudSync.queue');c.run('bindCloudTools()');await c.els.get('cloudRefreshNow').onclick();assert.notEqual(c.els.get('cloudStatus').textContent,'云端已同步');
 });
 await test('refresh staged before a local save is discarded',async()=>{
  const c=boot();c.run(`var releaseRead;var heldRead=new Promise(r=>releaseRead=r);`);db(c,`if(fields==='id,revision')await heldRead;`);
  const refresh=c.run('cloudRefresh(true)');c.run(`cloudPushSnapshot=async()=>{throw Error('offline')};state.stations[0].currentSituation='edit during refresh';save();releaseRead()`);await refresh;await c.run('cloudSync.queue');assert.equal(c.run('state.stations[0].currentSituation'),'edit during refresh');
 });
 await test('failed refresh retains failure status',async()=>{
  const c=boot();db(c,`throw Error('read failure');`);c.run('bindCloudTools()');await c.els.get('cloudRefreshNow').onclick();assert.equal(c.els.get('cloudStatus').textContent,'云端检查失败');
 });
 await test('successful retry clears outbox only after saving latest edit',async()=>{
  const c=boot();c.run(`cloudPushSnapshot=async()=>{throw Error('offline')};state.stations[0].currentSituation='first';save()`);await c.run('cloudSync.queue');
  c.run(`state.stations[0].currentSituation='latest';save();cloudPushSnapshot=async snapshot=>{cloudSync.syncedState=clone(snapshot)};`);
  await c.run('cloudRetrySync()');assert.equal(c.run('cloudSync.syncedState.stations[0].currentSituation'),'latest');assert.equal(c.storage.has('feixi-v072-state:cloud-outbox-v1'),false);assert.equal(c.els.get('cloudStatus').textContent,'云端已同步');
 });
 await test('restart restores dirty state instead of applying legacy migrations',()=>{
  const c=boot();c.run(`state.stations[0].currentSituation='restart edit';cloudSync.dirty=true;cloudPersistOutbox();load()`);
  assert.equal(c.run('state.stations[0].currentSituation'),'restart edit');assert.equal(c.run('cloudSync.dirty'),true);
 });
 await test('corrupt legacy cache does not block cloud startup',()=>{
  const c=boot();c.storage.set('feixi-v072-state','{broken');c.run('load()');assert.equal(c.run('state.stations.length'),0);assert.equal(c.storage.get('feixi-v072-state'),'{broken');
 });
 await test('remote row with mismatched ID is rejected without partial apply',async()=>{
  const c=boot();db(c,`if(fields==='id,data,revision')return {data:[{id:'test-isolated',revision:2,data:{station:{id:'wrong'}}}]};`);await c.run('cloudRefresh(true)');assert.equal(c.run('state.stations[0].id'),'test-isolated');assert.equal(c.els.get('cloudStatus').textContent,'云端检查失败');
 });
 await test('successful refresh preserves data and updates revision together',async()=>{
  const c=boot();db(c);await c.run('cloudRefresh(true)');assert.equal(c.run('state.stations[0].currentSituation'),'remote edit');assert.equal(c.run("cloudSync.stationRevisions.get('test-isolated')"),2);
 });
 await test('real writer advances exactly one revision and retains command receipts',async()=>{
  const c=boot();c.run(`SEED.stations=clone(state.stations);var writes=[];
   cloudSync.remoteAppliedCommands.set('test-isolated',['existing-command']);
   cloudSync.db={from(table){return {update(payload){let filters={};return {eq(k,v){filters[k]=v;return this},then(resolve){writes.push({table,payload,filters});resolve({count:1})}}}}}};
   state.stations[0].currentSituation='saved';save();`);await c.run('cloudSync.queue');
  assert.equal(c.run('writes.length'),1);assert.equal(c.run('writes[0].filters.revision'),1);assert.equal(c.run('writes[0].payload.revision'),2);assert.equal(c.run('writes[0].payload.data.appliedRemoteCommands[0]'),'existing-command');assert.equal(c.run('cloudSync.dirty'),false);
 });
 await test('CAS conflict retains local outbox and prevents a second write',async()=>{
  const c=boot();c.run(`SEED.stations=clone(state.stations);var writes=0;
   cloudSync.db={from(){return {update(){return {eq(){return this},then(resolve){writes++;resolve({count:0})}}}}}};
   state.stations[0].currentSituation='conflicting local edit';save();`);await c.run('cloudSync.queue');await c.run('cloudRetrySync()');
  assert.equal(c.run('writes'),1);assert.equal(c.run('cloudSync.conflict'),true);assert.equal(c.run('state.stations[0].currentSituation'),'conflicting local edit');assert.ok(c.storage.has('feixi-v072-state:cloud-outbox-v1'));
 });
 await test('restart rebases unrelated remote edits but refuses changed dirty station',()=>{
  const c=boot();c.run(`state.stations.push({id:'other',currentSituation:'old'});cloudSync.syncedState=clone(state);cloudSync.stationRevisions.set('other',1);
   state.stations[0].currentSituation='dirty';cloudPersistOutbox();load();
   var remote=clone(cloudSync.syncedState);remote.stations[1].currentSituation='new remote';cloudSync.stationRevisions.set('other',2);
   var resumed=cloudResumeOutbox(remote);`);
  assert.equal(c.run('resumed.stations[0].currentSituation'),'dirty');assert.equal(c.run('resumed.stations[1].currentSituation'),'new remote');
  c.run(`cloudSync.stationRevisions.set('test-isolated',2)`);assert.throws(()=>c.run('cloudResumeOutbox(remote)'),/待同步站点/);assert.equal(c.run('state.stations[0].currentSituation'),'dirty');
 });
 await test('uncertain successful write is recognized after restart without reapplying',()=>{
  const c=boot();c.run(`state.stations[0].currentSituation='sent before reload';cloudPersistOutbox();load();
    var remote=clone(state);cloudSync.stationRevisions.set('test-isolated',2);var resumed=cloudResumeOutbox(remote);`);
  assert.equal(c.run('resumed.stations[0].currentSituation'),'sent before reload');
 });
 await test('later queued edit remains pending when an earlier write fails',async()=>{
  const c=boot();c.run(`var calls=0;cloudPushSnapshot=async()=>{calls++;throw Error('offline')};state.stations[0].currentSituation='first';save();state.stations[0].currentSituation='second';save();`);await c.run('cloudSync.queue');
  assert.equal(c.run('calls'),1);assert.equal(c.run('cloudSync.pending'),0);assert.equal(JSON.parse(c.storage.get('feixi-v072-state:cloud-outbox-v1')).snapshot.stations[0].currentSituation,'second');
 });
 await test('another tab outbox is neither overwritten nor deleted',()=>{
  const c=boot();c.run('cloudPersistOutbox()');c.storage.set('feixi-v072-state:cloud-outbox-v1','another tab pending edit');
  assert.throws(()=>c.run('cloudPersistOutbox()'),/另一个页面/);assert.throws(()=>c.run('cloudClearOutbox()'),/另一个页面/);assert.equal(c.storage.get('feixi-v072-state:cloud-outbox-v1'),'another tab pending edit');
 });
 fs.mkdirSync(path.join(root,'audit-evidence'),{recursive:true});fs.writeFileSync(path.join(root,'audit-evidence/cloudbase-sync-results.json'),JSON.stringify(results,null,2));
 console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
