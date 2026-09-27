const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../cloudbase-dist/index.html'),'utf8');
const start=html.indexOf('// SHARED_STATION_RULES_BEGIN'),end=html.indexOf('// SHARED_STATION_RULES_END');
if(start<0||end<start)throw Error('Shared station rules missing');
const context=vm.createContext({Date});vm.runInContext(html.slice(start,end),context);
module.exports={assertStationChange:context.assertStationChange,applyRemoteStationPatch:context.applyRemoteStationPatch,ruleDateError:context.ruleDateError,ruleNodeError:context.ruleNodeError};
