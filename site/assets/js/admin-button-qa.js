
(function(){
  function toast(msg){
    let t=document.getElementById('admin-qa-toast');
    if(!t){t=document.createElement('div');t.id='admin-qa-toast';t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;background:#101a17;color:#fff;border:1px solid rgba(228,162,58,.45);border-radius:14px;padding:.8rem 1rem;box-shadow:0 12px 40px rgba(0,0,0,.35);font:600 14px Inter,Segoe UI,Arial,sans-serif;max-width:min(92vw,560px);display:none';document.body.appendChild(t);} 
    t.textContent=msg;t.style.display='block';clearTimeout(window.__adminQaToastTimer);window.__adminQaToastTimer=setTimeout(()=>t.style.display='none',3200);
  }
  function isDeadHref(a){ const h=(a.getAttribute('href')||'').trim(); return !h || h==='#' || h.toLowerCase()==='javascript:void(0)' || h.toLowerCase()==='javascript:;'; }
  document.addEventListener('click',function(e){
    const el=e.target.closest('a,button'); if(!el) return;
    if(el.tagName==='A' && isDeadHref(el)){ e.preventDefault(); toast('This admin action is not linked yet. Use the main dashboard navigation or refresh after login.'); return; }
    if(el.tagName==='BUTTON'){
      const type=(el.getAttribute('type')||'').toLowerCase();
      const hasHandler=el.getAttribute('onclick') || el.dataset.action || el.dataset.modal || el.closest('form') || type==='submit';
      if(!hasHandler){ toast('Admin button checked: no action is attached yet.'); }
    }
  },true);
  window.adminButtonQA={toast};
})();
