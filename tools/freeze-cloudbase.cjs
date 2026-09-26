// Read-only Phase A capture. Authentication creates a session; business tables are GET-only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const ENV = 'zsj1314-d9ger6ak4a25a8717';
const gateway = `https://${ENV}.api.tcloudbasegateway.com`;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function request(route, options = {}) {
  const r = await fetch(gateway + route, {...options, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw Error(`CloudBase ${options.method || 'GET'} ${route.split('?')[0]}: HTTP ${r.status}`);
  return r.json();
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const startedAt = new Date().toISOString();
  const auth = await request('/auth/v1/signin/anonymously', {
    method: 'POST', headers: {'Content-Type':'application/json','x-device-id':'feixi-codex-readonly-audit-v1'}, body:'{}'
  });
  const token = auth.access_token || auth.accessToken || auth.data?.access_token;
  if (!token) throw Error('Anonymous session did not return a token');
  const headers = {Authorization:`Bearer ${token}`};
  async function read(table) {
    const rows = [];
    for (let offset = 0; ; offset += 50) {
      const page = await request(`/v1/rdb/rest/${table}?select=*&order=id.asc&limit=50&offset=${offset}`, {headers});
      if (!Array.isArray(page)) throw Error('Expected row array');
      rows.push(...page);
      if (page.length < 50) return rows;
      if (offset > 10000) throw Error('Unexpected table size');
    }
  }
  // Bracket the full read with a second complete scan, including metadata and bundle content.
  const first = {stations:await read('feixi_stations'), meta:await read('feixi_meta')};
  const second = {stations:await read('feixi_stations'), meta:await read('feixi_meta')};
  const stable = JSON.stringify(first) === JSON.stringify(second);
  const capturedAt = new Date().toISOString();
  const snapshot = {format:'feixi-cloudbase-readonly-snapshot-v1', envId:ENV, startedAt, capturedAt,
    gitCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    stableAcrossTwoReads:stable, ...first};
  const out = path.join(root,'audit-evidence','phase-a',capturedAt.replace(/[:.]/g,'-'));
  fs.mkdirSync(out,{recursive:true});
  const bytes = JSON.stringify(snapshot,null,2)+'\n';
  fs.writeFileSync(path.join(out,'snapshot.json'),bytes,{flag:'wx'});
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt,stableAcrossTwoReads:stable,
    stationCount:first.stations.length,metaCount:first.meta.length,sha256:sha(bytes)},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({out,stableAcrossTwoReads:stable,stationCount:first.stations.length,sha256:sha(bytes)}));
  if (!stable) throw Error('Data changed during capture; snapshot retained but not accepted as baseline');
}
if (require.main === module) main().catch(e=>{console.error(e.message);process.exitCode=1});
