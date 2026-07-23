(function(){
  'use strict';
  const titleCase=value=>String(value||'').replace(/\.html$/,'').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());
  async function init(){
    if(!window.VIACollections)return;
    if(!document.querySelector('link[href="/assets/css/knowledge-showcase.css"]')){
      const stylesheet=document.createElement('link');
      stylesheet.rel='stylesheet';
      stylesheet.href='/assets/css/knowledge-showcase.css';
      document.head.appendChild(stylesheet);
    }
    const slug=location.pathname.split('/').filter(Boolean).pop()||'';
    const industry=document.body.dataset.industry||titleCase(slug);
    const footer=document.querySelector('footer');
    const main=document.querySelector('main');
    if(!footer||!main||document.querySelector('[data-vic-industry-shelf]'))return;
    const mount=document.createElement('div');
    mount.dataset.vicIndustryShelf=industry;
    mount.innerHTML=`<section class="vic-industry-shelf" aria-live="polite"><div class="vic-section-head"><span class="eyebrow">Relevant Intelligence Collections</span><h2>Loading governed Collections</h2></div></section>`;
    main.appendChild(mount);
    try{
      const apiBase=typeof API_BASE_URL!=='undefined'?API_BASE_URL:'';
      const response=await fetch(`${apiBase}/api/public/flagship-sample-library`,{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      const catalog=(payload?.catalog?.reports||[]).map(entry=>window.VIACollections.normalizeCollection(entry));
      mount.innerHTML=window.VIACollections.renderIndustryShelf(industry,catalog);
    }catch(error){
      mount.innerHTML=`<section class="vic-industry-shelf" role="status"><div class="vic-section-head"><span class="eyebrow">Relevant Intelligence Collections</span><h2>Collection relationships are temporarily unavailable</h2><p>The industry page remains available. Retry from the Intelligence Library.</p></div><a class="btn btn-ghost" href="/sample-reports.html">Open Intelligence Library</a></section>`;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
