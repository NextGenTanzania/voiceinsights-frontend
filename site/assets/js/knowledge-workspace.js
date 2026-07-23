(()=>{
  const form=document.querySelector('#workspace-knowledge-search');
  const status=document.querySelector('#workspace-knowledge-status');
  const results=document.querySelector('#workspace-knowledge-results');
  const moduleSelect=document.querySelector('#knowledge-module');
  const categoryHost=document.querySelector('#knowledge-categories');
  const breadcrumb=document.querySelector('#knowledge-breadcrumb');
  const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let categories=[];
  let activeCategory='';

  const labelFor=(items,id,key='category_id')=>items.find(item=>item[key]===id)?.name||id;
  function updateBreadcrumb(asset=''){
    const moduleName=moduleSelect.selectedOptions[0]?.textContent||'Choose a Module';
    const categoryName=activeCategory?labelFor(categories,activeCategory):'Choose a Category';
    breadcrumb.textContent=['Knowledge Hub',moduleName,categoryName,asset].filter(Boolean).join(' → ');
  }
  function renderCategories(){
    categoryHost.innerHTML=categories.map(category=>`<button type="button" class="${activeCategory===category.category_id?'active':''}" data-category="${escape(category.category_id)}" ${moduleSelect.value?'':'disabled'}>${escape(category.name)}</button>`).join('');
    categoryHost.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{activeCategory=button.dataset.category;renderCategories();updateBreadcrumb();search()}));
  }
  async function loadRegistry(){
    const response=await fetch('/api/industry-modules',{credentials:'include'});
    const body=await response.json();
    if(!response.ok){status.textContent=body.error||'Unable to load Industry Modules.';return}
    categories=body.category_registry||[];
    moduleSelect.innerHTML='<option value="">Choose a Module</option>'+(body.modules||[]).map(module=>`<option value="${escape(module.module_id)}">${escape(module.display_name||module.name)}</option>`).join('');
    renderCategories();
  }
  function buildSearchParameters(){
    const data=new FormData(form);
    const params=new URLSearchParams({q:data.get('query')||''});
    if(moduleSelect.value)params.set('module_id',moduleSelect.value);
    if(activeCategory)params.set('category_id',activeCategory);
    for(const name of ['product_type','framework','indicator','language','tag'])if(data.get(name))params.set(name,data.get(name));
    return params;
  }
  async function search(event){
    event?.preventDefault();
    if(!moduleSelect.value||!activeCategory){status.textContent='Choose an Industry Module and Knowledge Category first.';results.innerHTML='';return}
    const response=await fetch(`/api/knowledge/search?${buildSearchParameters()}`,{credentials:'include'});
    const body=await response.json();
    if(!response.ok){status.textContent=body.error||'Search failed';return}
    status.textContent=`${body.total} governed asset${body.total===1?'':'s'} found`;
    results.innerHTML=(body.results||[]).map(asset=>`<article class="knowledge-card"><p class="eyebrow">${escape(labelFor((body.modules||[]),asset.module_id,'module_id')||moduleSelect.selectedOptions[0]?.textContent)} → ${escape(labelFor(categories,asset.category_id))} → Asset</p><h3>${escape(asset.title)}</h3><p>${escape(asset.summary)}</p><span>${escape(asset.visibility)} · ${escape(asset.access_state)}</span></article>`).join('');
  }
  moduleSelect.addEventListener('change',()=>{activeCategory='';renderCategories();updateBreadcrumb();results.innerHTML='';status.textContent=moduleSelect.value?'Choose a Knowledge Category.':'Choose an Industry Module.'});
  form.addEventListener('submit',search);
  document.querySelector('#save-search').addEventListener('click',async()=>{
    if(!moduleSelect.value||!activeCategory){status.textContent='Choose an Industry Module and Knowledge Category before saving.';return}
    const data=new FormData(form);
    const filters=Object.fromEntries([...buildSearchParameters()].filter(([key])=>key!=='q'));
    const response=await fetch('/api/knowledge/saved-searches',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`${moduleSelect.selectedOptions[0].textContent}: ${labelFor(categories,activeCategory)}`,query:data.get('query')||'',filters})});
    status.textContent=response.ok?'Search saved to this organization workspace.':'Unable to save search.';
  });
  loadRegistry();
})();
