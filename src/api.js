export async function api(url, options={}) {
  const method=options.method||'GET';
  const request={method,credentials:'same-origin',headers:{},...options};
  if(method!=='GET')request.headers={'Content-Type':'application/json',...(options.headers||{})};
  if(options.body!==undefined && typeof options.body!=='string')
    request.body=JSON.stringify(options.body);
  const base=import.meta.env.BASE_URL.replace(/\/$/,'');
  const response=await fetch(base+'/api'+url,request);
  let data={};
  try{ data=await response.json(); }catch{}
  if(!response.ok){
    const error=new Error(data.error||'İşlem tamamlanamadı.');
    error.status=response.status;throw error;
  }
  return data;
}
