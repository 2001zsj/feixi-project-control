const fs=require('node:fs'),crypto=require('node:crypto');
const source=process.argv[2],out=process.argv[3];if(!source||!out)throw Error('Usage: node tools/prepare-d1-import.cjs snapshot.json output.sql');
const snap=JSON.parse(fs.readFileSync(source,'utf8'));
if(snap.stations.length!==76||new Set(snap.stations.map(r=>r.id)).size!==76||snap.meta.length!==1)throw Error('Invalid snapshot');
const sql=[];const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
for(const [table,rows] of [['feixi_stations',snap.stations],['feixi_meta',snap.meta]]){
 sql.push(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL CHECK(revision>0), updated_at TEXT);`);
 for(const r of rows){if(table==='feixi_stations'&&r.data.station.id!==r.id)throw Error('Invalid station ID');if(!Number.isSafeInteger(Number(r.revision)))throw Error('Invalid revision');sql.push(`INSERT INTO ${table}(id,data,revision,updated_at) VALUES (${quote(r.id)},${quote(JSON.stringify(r.data))},${Number(r.revision)},${quote(r.updated_at||'')});`)}
}
fs.writeFileSync(out,sql.join('\n'));
console.log(JSON.stringify({rows:snap.stations.length,meta:snap.meta.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')}));
