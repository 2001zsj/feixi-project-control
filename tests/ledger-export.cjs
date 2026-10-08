const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('cloudbase-dist/index.html','utf8');
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1].replace(/\nboot\(\);\s*$/,'\n');
let blob,download;
const storage=new Map();
const c=vm.createContext({Date,Map,Set,URLSearchParams,console,TextEncoder,Blob,Uint8Array,DataView,
  URL:{createObjectURL:b=>(blob=b,'blob:test'),revokeObjectURL:()=>{}},setTimeout:()=>{},
  document:{createElement:()=>{const a={click:()=>{download=a.download}};return a}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
vm.runInContext(code,c);const run=s=>vm.runInContext(s,c);const realToday=run('today()');run(`today=()=> '2026-09-27'`);
function unzip(buffer){
  const files={};let p=0;
  while(buffer.readUInt32LE(p)===0x04034b50){
    assert.equal(buffer.readUInt16LE(p+8),0);const size=buffer.readUInt32LE(p+18),n=buffer.readUInt16LE(p+26),e=buffer.readUInt16LE(p+28);
    const name=buffer.subarray(p+30,p+30+n).toString(),start=p+30+n+e;
    files[name]=buffer.subarray(start,start+size).toString();p=start+size;
  }
  assert.equal(buffer.readUInt32LE(p),0x02014b50);return files;
}
const fixtures=[
  {id:'a',demandName:'=SUM(1,2)<&\u0001',demandOrder:'00123456789012345678'},
  {id:'b',demandName:'第二个选址'},
  {id:'d',isDifficultSite:true,selectionProblem:'产权未解决'},
  {id:'p',selectionDone:true,pendingEstablishProgress:'重新立项'},
  {id:'s',demandName:'同名站点',towerName:'同名站点',establishRef:'P123',establishDate:'2026-09-01',entryDate:'2026-09-02',plannedNodes:{pourDate:'2026-10-15',towerDate:'2026-11-01'},currentSituation:'实际已进场，尚未浇筑',currentNextAction:'协调浇筑',currentOwner:'负责人'},
  {id:'c',completeConfirmed:true,towerDate:'2026-09-03'},
  {id:'h',demandName:'暂时保留样例',selectionHold:true}
];
(async()=>{
  c.fixtures=fixtures;run(`state={stations:fixtures,moduleOrders:{selection:['b','a']}};exportXls(fixtures,'ledger','总台账')`);
  const files=unzip(Buffer.from(await blob.arrayBuffer()));
  const wb=files['xl/workbook.xml'];
  for(const name of ['总览','选址中','问题站点','待立项','施工中','完工站','暂时保留'])assert.ok(wb.includes('name="'+name+'"'));
  const expected=[7,2,1,1,1,1,1];
  for(let i=1;i<=7;i++){
    const sheet=files[`xl/worksheets/sheet${i}.xml`];
    assert.equal([...sheet.matchAll(/<row r=/g)].length-4,expected[i-1]);
    assert.ok(sheet.includes('state="frozen"'));assert.ok(sheet.includes('<autoFilter'));
    assert.ok(files['xl/_rels/workbook.xml.rels'].includes(`Target="worksheets/sheet${i}.xml"`));
    assert.ok(files['[Content_Types].xml'].includes(`/xl/worksheets/sheet${i}.xml`));
  }
  assert.ok(files['xl/worksheets/sheet2.xml'].indexOf('第二个选址')<files['xl/worksheets/sheet2.xml'].indexOf('=SUM'));
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('00123456789012345678'));
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('=SUM(1,2)&lt;&amp;'));
  assert.ok(!files['xl/worksheets/sheet2.xml'].includes('<f>'));
  assert.ok(files['xl/worksheets/sheet6.xml'].includes('装塔日期'));
  const overview=files['xl/worksheets/sheet1.xml'];
  const header=overview.match(/<row r="4"[\s\S]*?<\/row>/)[0];
  assert.ok(header.indexOf('需求站名')<header.indexOf('所属模块'));
  assert.ok(header.includes('当前进展/问题'));assert.ok(!header.includes('需求订单号'));
  assert.equal((header.match(/<c /g)||[]).length,8);
  assert.ok(header.includes('铁塔站名'));
  const building=files['xl/worksheets/sheet5.xml'];
  const buildHeaders=[...building.match(/<row r="4"[\s\S]*?<\/row>/)[0].matchAll(/<t>(.*?)<\/t>/g)].map(x=>x[1]);
  const buildCells=[...building.match(/<row r="5"[\s\S]*?<\/row>/)[0].matchAll(/<c r="([A-Z]+)5"[\s\S]*?(?:<\/c>|\/>)/g)].map(x=>x[0]);
  assert.equal((building.match(/同名站点/g)||[]).length,2);
  assert.ok(!building.includes('计划浇筑'));assert.ok(!building.includes('计划装塔'));
  assert.ok(building.includes('outlineLevel="1"'));
  assert.ok(building.includes('hidden="1"'));assert.ok(building.includes('collapsed="1"'));
  assert.ok(buildHeaders.indexOf('项目编码')<buildHeaders.indexOf('当前进展'));
  for(const field of ['下一步动作','当前责任人','当前进展'])assert.ok(buildHeaders.includes(field),field);
  assert.ok(buildCells[buildHeaders.indexOf('浇筑日期')].endsWith('/>'),'plan must not become actual pour');
  assert.ok(building.includes('协调浇筑'));
  const xfs=[...files['xl/styles.xml'].match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].matchAll(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)].map(x=>x[0]);
  for(let i=1;i<=7;i++){
    const sheet=files[`xl/worksheets/sheet${i}.xml`];
    for(const row of sheet.matchAll(/<row r="(?:[5-9]|\d{2,})"[\s\S]*?<\/row>/g)){
      for(const cell of row[0].matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"/g)){
        const style=xfs[Number(cell[2])];assert.ok(style.includes('vertical="center"'));
        if(['A','B'].includes(cell[1])){assert.ok(style.includes('horizontal="center"'));assert.ok(style.includes('wrapText="1"'))}
      }
    }
  }
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('s="19"'));assert.ok(header.includes('s="20"'));
  assert.ok(overview.includes('ySplit="4"'));assert.ok(overview.includes('<autoFilter ref="A4:'));
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('基础资料'));
  assert.ok(files['xl/worksheets/sheet6.xml'].includes('完工日期'));
  assert.ok(wb.includes('!$1:$4'));assert.ok(overview.includes('&amp;L&amp;A'));
  assert.ok(overview.includes('scale="80"'));assert.ok(overview.includes('<tabColor'));
  assert.ok(wb.includes('!$A:$B'));
  const multiline=run(`exportXls([{demandName:'长文本测试',selectionProgress:'第一行\\n第二行\\n第三行\\n第四行'}],'selection','',true).sheet`);
  assert.ok(Number(multiline.match(/<row r="5" ht="([\d.]+)"/)[1])>=76);
  assert.equal(download,'肥西站点总台账_2026-09-27.xlsx');
  const stale={id:'gaodian',demandName:'肥西高店运河新镇',towerName:'肥西高店运河新镇',selectionDone:true,isDifficultSite:false,establishRef:'26A09AHHF011005311',establishDate:'2026-09-29',currentSituation:'设计表记录：选址未完成，问题站点；备注：楼面站选址'};
  c.stale=stale;
  const staleSheet=run(`exportXls([stale],'building','',true).sheet`);
  const staleHeaders=[...staleSheet.match(/<row r="4"[\s\S]*?<\/row>/)[0].matchAll(/<t>(.*?)<\/t>/g)].map(x=>x[1]);
  const staleCells=[...staleSheet.match(/<row r="5"[\s\S]*?<\/row>/)[0].matchAll(/<c r="([A-Z]+)5"[\s\S]*?(?:<\/c>|\/>)/g)].map(x=>x[0]);
  assert.ok(!staleCells[staleHeaders.indexOf('当前进展')].includes('问题站点'),'legacy source must not describe current problem');
  assert.ok(staleCells[staleHeaders.indexOf('历史导入备注')].includes('选址未完成，问题站点'),'source must be preserved');
  assert.ok(staleCells[staleHeaders.indexOf('当前进展')].includes('待进场放线'));
  assert.ok(run(`exportXls([{...stale,constructionProblem:true}],'building','',true).sheet`).includes('有施工问题'),'explicit current construction problem must remain');
  const ongoing=run(`exportXls([{...stale,currentSituation:'现场协调未完成，等待进场'}],'building','',true).sheet`);
  assert.ok(ongoing.includes('现场协调未完成，等待进场'),'manual current progress must remain');
  run(`exportXls([],'ledger','总台账')`);
  const empty=unzip(Buffer.from(await blob.arrayBuffer()));
  assert.equal(Object.keys(empty).filter(k=>k.startsWith('xl/worksheets/')).length,7);
  assert.ok(empty['xl/worksheets/sheet1.xml'].includes('站点数量：0'));
  run(`exportXls(fixtures.slice(0,2),'selection','选址中')`);
  assert.equal(Object.keys(unzip(Buffer.from(await blob.arrayBuffer()))).filter(k=>k.startsWith('xl/worksheets/')).length,1);
  if(process.argv[2]){
    c.exportDay=realToday;run('today=()=>exportDay');
    c.fixtures=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).stations.map(r=>r.data.station);
    run(`exportXls(fixtures,'ledger','总台账')`);
    const data=Buffer.from(await blob.arrayBuffer());
    if(process.argv[3])fs.writeFileSync(process.argv[3],data);
    const real=unzip(data);const counts=Array.from({length:7},(_,i)=>[...real[`xl/worksheets/sheet${i+1}.xml`].matchAll(/<row r=/g)].length-4);
    assert.equal(counts[0],c.fixtures.length);assert.equal(counts.slice(1).reduce((a,b)=>a+b,0),counts[0]);
    console.log('Snapshot sheet row counts:',counts);
  }
  console.log('PASS workbook package, seven sheets, partitions, manual order, text IDs, XML escaping, formula-safe text, empty modules and existing single-sheet export');
})().catch(e=>{console.error(e);process.exit(1)});
