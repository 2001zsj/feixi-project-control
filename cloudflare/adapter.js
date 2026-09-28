// Adapt the existing revisioned sync client to authenticated, same-origin D1 APIs.
// Older Android webviews have fetch but no AbortSignal.timeout.
window.fxttRequest=async function(url,body){
 const controller=typeof AbortController==='function'?new AbortController():null;
 let timer;
 try{
  return await Promise.race([
   (async()=>{
    const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),...(controller?{signal:controller.signal}:{})});
    if(response.status===401)throw Error('登录已过期，请刷新页面重新登录；未同步修改已保存在本机');
    if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('接口未返回数据，请刷新或切换网络后重试');
    const result=await response.json();if(!response.ok)throw Error(result.error?.message||'服务暂不可用');return result;
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('连接超时，请切换网络后重试；未同步修改已保留'));controller?.abort()},20000)})
  ]);
 }catch(e){if(e instanceof TypeError)throw Error('网络请求失败，请切换 Wi-Fi 或移动网络后重试');throw e}
 finally{clearTimeout(timer)}
};
window.cloudbase={init(){return {
 auth(){return {getLoginState:async()=>true}},
 rdb(){return {from(table){let operation='select',fields='*',payload,filters={},limit=100;
  const q={select(f){fields=f;return q},update(p){operation='update';payload=p;return q},eq(k,v){filters[k]=v;return q},limit(n){limit=n;return q},
   async then(resolve,reject){try{
    let cursor=null,rows=[];
    do {
    const result=await window.fxttRequest('/api/db',{table,operation,fields,payload,filters,limit,cursor});
    if(operation!=='select'){resolve(result);return}
    rows.push(...result.data);const next=result.nextCursor;
    if(next&&next===cursor)throw Error('分页未前进');cursor=next;
    }while(cursor&&!filters.id);
    resolve({data:rows});
   }catch(e){reject(e)}}};return q;
 }}}
}}};
