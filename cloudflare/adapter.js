// Adapt the existing revisioned sync client to authenticated, same-origin D1 APIs.
window.cloudbase={init(){return {
 auth(){return {getLoginState:async()=>true}},
 rdb(){return {from(table){let operation='select',fields='*',payload,filters={},limit=100;
  const q={select(f){fields=f;return q},update(p){operation='update';payload=p;return q},eq(k,v){filters[k]=v;return q},limit(n){limit=n;return q},
   async then(resolve,reject){try{
    let cursor=null,rows=[];
    do {
    const response=await fetch('/api/db',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,operation,fields,payload,filters,limit,cursor}),signal:AbortSignal.timeout(20000)});
    if(response.status===401)throw Error('登录已过期，请刷新页面重新登录；未同步修改已保存在本机');
    const result=await response.json();if(!response.ok)throw Error(result.error?.message||'服务暂不可用');
    if(operation!=='select'){resolve(result);return}
    rows.push(...result.data);const next=result.nextCursor;
    if(next&&next===cursor)throw Error('分页未前进');cursor=next;
    }while(cursor&&!filters.id);
    resolve({data:rows});
   }catch(e){reject(e)}}};return q;
 }}}
}}};
