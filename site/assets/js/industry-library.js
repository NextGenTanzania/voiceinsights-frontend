(function(global){
  'use strict';
  const state={platform:null,query:'',capability:'',assetType:''};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function render(){
    const root=document.getElementById('industry-results'),status=document.getElementById('industry-status');
    if(!state.platform){root.innerHTML='<div class="ew-empty"><h2>Module Registry unavailable</h2><p>The governed Module contract could not be loaded.</p></div>';return}
    const modules=(state.platform.modules||[]).filter(module=>{const text=JSON.stringify(module).toLowerCase();return(!state.query||text.includes(state.query))&&(!state.capability||module.capabilities?.includes(state.capability))&&(!state.assetType||module.referenced_assets?.some(asset=>asset.asset_type===state.assetType))});
    root.innerHTML=modules.length?`<div class="ew-product-grid">${modules.map(module=>`<article class="ew-product"><span class="ew-chip">Industry Module</span><h2>${esc(module.display_name||module.name)}</h2><p>${esc(module.description)}</p><div class="ew-product-meta"><span class="ew-chip">v${esc(module.version)}</span><span class="ew-chip">${esc(module.status)}</span><span class="ew-chip">${module.referenced_assets?.length||0} referenced assets</span></div></article>`).join('')}</div>`:'<div class="ew-empty"><h2>No Industry Modules available</h2><p>Your organization has not been granted access to an Industry Module. Existing platform capabilities remain available.</p></div>';
    status.textContent=`${modules.length} Industry Module${modules.length===1?'':'s'} available to this organization`;
  }
  async function initIndustryModuleLibrary(){
    document.getElementById('industry-search').addEventListener('input',event=>{state.query=event.target.value.trim().toLowerCase();render()});
    document.getElementById('industry-capability').addEventListener('change',event=>{state.capability=event.target.value;render()});
    document.getElementById('industry-asset-type').addEventListener('change',event=>{state.assetType=event.target.value;render()});
    try{state.platform=await apiRequest('/api/industry-modules');const registry=state.platform.module_registry||{};document.getElementById('industry-capability').insertAdjacentHTML('beforeend',(registry.capabilities||[]).map(x=>`<option value="${esc(x)}">${esc(x.replaceAll('_',' '))}</option>`).join(''));document.getElementById('industry-asset-type').insertAdjacentHTML('beforeend',(registry.asset_types||[]).map(x=>`<option value="${esc(x)}">${esc(x.replaceAll('_',' '))}</option>`).join(''));render()}catch(error){document.getElementById('industry-status').textContent=error.message;render()}
  }
  global.initIndustryModuleLibrary=initIndustryModuleLibrary;
  if(typeof module!=='undefined')module.exports={esc};
})(typeof window!=='undefined'?window:globalThis);
