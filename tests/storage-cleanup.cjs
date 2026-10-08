const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('cloudbase-dist/index.html','utf8'),code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
const values=new Map(),ctx=vm.createContext({Date,Map,Set,URL,URLSearchParams,console,localStorage:{get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},document:{},window:{}});
vm.runInContext(code,ctx);const run=s=>vm.runInContext(s,ctx),key='feixi-v072-state',prefix=key+':before-cloud-load:';
run("state={stations:[],stationUndoHistory:{},stationRedoHistory:{}};cloudSync.syncedState=clone(state);cloudSync.ready=true;toast=()=>{};");
values.set(prefix+'100','old1');values.set(prefix+'200','old2');values.set(prefix+'300','latest');
for(const suffix of [':before-cloud-load',':cloud-conflict-backup:1',':cloud-outbox-archive:1',':before-restore:1',':unreadable-cache:1',':new-station-draft',':before-cloud-load:unknown'])values.set(key+suffix,'protected');
(async()=>{
 for(const flag of ['dirty','pending','syncing','conflict','writeFailed','recovery']){run(`cloudSync.${flag}=true`);await run('cloudCleanupSyncedCache()');assert(values.has(prefix+'100'),flag);run(`cloudSync.${flag}=false`)}
 values.set(key+':cloud-outbox-v1','pending');await run('cloudCleanupSyncedCache()');assert(values.has(prefix+'100'));values.delete(key+':cloud-outbox-v1');
 run("indexedDB={};cloudOutboxIDB=async()=>({raw:'other-tab'});");await run('cloudCleanupSyncedCache()');assert(values.has(prefix+'100'));
 run('cloudOutboxIDB=async()=>null');await run('cloudCleanupSyncedCache()');assert(!values.has(prefix+'100'));assert(!values.has(prefix+'200'));assert.equal(values.get(prefix+'300'),'latest');
 for(const suffix of [':before-cloud-load',':cloud-conflict-backup:1',':cloud-outbox-archive:1',':before-restore:1',':unreadable-cache:1',':new-station-draft',':before-cloud-load:unknown'])assert.equal(values.get(key+suffix),'protected');
 assert.equal(run('cloudSync.cacheCleanup.removed'),2);assert(values.has(key));await run('cloudCleanupSyncedCache()');assert.equal(run('cloudSync.cacheCleanup.removed'),0);
 console.log('PASS synchronized cache cleanup: pending/errors/other tabs protected; newest recovery copy retained; conflicts, drafts and histories preserved; idempotent.');
})().catch(e=>{console.error(e);process.exitCode=1});
