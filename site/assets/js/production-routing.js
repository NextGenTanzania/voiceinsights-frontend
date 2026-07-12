(function(){
  const OFFICIAL_ORIGIN='https://voiceinsightsafrica.com';
  const host=location.hostname;
  const isDev=host==='localhost'||host==='127.0.0.1';
  const isPreview=host.endsWith('.pages.dev');
  const origin=(isDev||isPreview)?OFFICIAL_ORIGIN:location.origin;
  window.VI_PRODUCTION_ORIGIN=origin;
  window.viProductionUrl=function(path='/'){
    try{const u=new URL(path,origin);return origin+u.pathname+u.search+u.hash}catch{return origin+'/'+String(path).replace(/^\/+/, '')}
  };
  window.viApi=async function(path,options={}){
    const token=localStorage.getItem('vi_token');
    const headers={...(options.headers||{}),'Content-Type':options.body?'application/json':(options.headers||{})['Content-Type']};
    if(token) headers.Authorization=`Bearer ${token}`;
    const base=window.VI_API_BASE||'https://voiceinsights-api.kitentyatsnp.workers.dev';
    const res=await fetch(base+path,{...options,headers});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||`HTTP ${res.status}`);
    return data;
  };
  window.viToast=function(message,type='success'){
    const n=document.createElement('div');n.textContent=message;n.style.cssText=`position:fixed;z-index:99999;right:20px;bottom:20px;padding:12px 16px;border-radius:12px;background:${type==='error'?'#8b1e1e':'#073b32'};color:#fff;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25)`;document.body.appendChild(n);setTimeout(()=>n.remove(),2800);
  };
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a)return;
    const href=a.getAttribute('href')||'';
    if(href.includes('.pages.dev')){e.preventDefault();location.href=href.replace(/^https?:\/\/[^/]+/,origin)}
  });
})();
