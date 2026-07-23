(function(){
  'use strict';
  const state={collections:[],query:'',filters:{},sort:'featured',page:1,pageSize:12,loading:true,error:'',resultOpened:false};
  const $=selector=>document.querySelector(selector);
  const esc=value=>window.VIACollections.escape(value);
  const option=value=>`<option value="${esc(value)}">${esc(value)}</option>`;
  const values=(key)=>[...new Set(state.collections.flatMap(item=>Array.isArray(item[key])?item[key]:[item[key]]).filter(Boolean))].sort();
  const controlMap={
    '#country-filter':'countries','#region-filter':'regions','#sector-filter':'title','#sdg-filter':'sdgs',
    '#language-filter':'languages','#method-filter':'methodologies','#impact-filter':'topics','#collection-filter':'title'
  };
  const specialMap={'#publication-filter':'publication','#research-filter':'research','#date-filter':'date','#author-filter':'author','#organization-filter':'organization','#evidence-filter':'evidence'};
  function track(type,data={}){
    const events=JSON.parse(localStorage.getItem('via_knowledge_analytics')||'[]');
    events.push({type,...data,at:new Date().toISOString()});
    localStorage.setItem('via_knowledge_analytics',JSON.stringify(events.slice(-250)));
  }
  function collectionCard(item){
    const publication=item.publications[0];
    return `<article class="research-collection-card" data-collection="${esc(item.slug)}">
      <div class="research-cover" aria-hidden="true"><span>${esc(item.id)}</span><strong>${esc(item.title)}</strong></div>
      <div class="research-card-body"><div class="research-card-flags"><span>${esc(item.status)}</span>${item.sdgs.slice(0,2).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <h3><a href="${esc(item.url)}">${esc(item.title)}</a></h3><p>${esc(item.summary)}</p>
      <dl><div><dt>Available products</dt><dd>${item.statistics.products}</dd></div><div><dt>Indicators</dt><dd>${item.statistics.indicators}</dd></div><div><dt>Methods</dt><dd>${item.statistics.methods}</dd></div></dl>
      <p class="research-topics">${item.topics.map(x=>`<span>${esc(x)}</span>`).join('')}</p>
      ${publication?`<p class="research-feature"><strong>Featured:</strong> ${esc(publication.title)}</p>`:'<p class="research-feature">This domain is governed; approved Intelligence Products will be listed when catalogue verification completes.</p>'}
      <a class="btn btn-primary" href="${esc(item.url)}" data-track-collection="${esc(item.slug)}">Explore Collection</a></div></article>`;
  }
  function matches(item){
    const query=state.query.toLowerCase();
    const searchable=[item.title,item.summary,...item.topics,...item.sdgs,...item.frameworks,...item.methodologies,...item.indicators,...item.publications.flatMap(p=>[p.title,p.purpose,p.primary_industry,...p.frameworks])].flat().join(' ').toLowerCase();
    if(query&&!searchable.includes(query))return false;
    return Object.entries(state.filters).every(([key,value])=>{
      if(value==='All')return true;
      if(key==='publication')return item.publications.some(p=>p.product_views.some(view=>view.label===value));
      if(key==='research')return value==='Mixed Methods'||item.methodologies.some(method=>method.toLowerCase().includes(value.toLowerCase().split(' ')[0]));
      if(key==='date')return item.updated.startsWith(value)||item.publications.some(p=>String(p.release_date).startsWith(value));
      if(key==='author'||key==='organization')return value==='VoiceInsights Africa';
      if(key==='evidence')return value==='Governed synthetic'||item.publications.some(p=>p.trust?.methodology==='Available'||p.trust?.publication);
      return Array.isArray(item[key])?item[key].includes(value):item[key]===value;
    });
  }
  function sorted(items){
    const result=[...items];
    if(state.sort==='title')result.sort((a,b)=>a.title.localeCompare(b.title));
    else if(state.sort==='newest')result.sort((a,b)=>b.updated.localeCompare(a.updated));
    else if(state.sort==='popular')result.sort((a,b)=>b.statistics.views-a.statistics.views||a.title.localeCompare(b.title));
    else result.sort((a,b)=>Number(b.status==='Featured')-Number(a.status==='Featured')||a.id.localeCompare(b.id));
    return result;
  }
  function render(){
    const root=$('#knowledge-results'),status=$('#catalogue-status');
    if(state.loading){root.innerHTML='<div class="research-collection-grid" aria-hidden="true">'+Array.from({length:8},()=>'<article class="research-collection-card research-skeleton"><span></span><span></span><span></span></article>').join('')+'</div>';root.setAttribute('aria-busy','true');return}
    root.setAttribute('aria-busy','false');
    if(state.error){status.textContent='Knowledge catalogue unavailable';root.innerHTML=`<div class="knowledge-empty" role="alert"><h3>Unable to load the library</h3><p>${esc(state.error)}</p><button class="btn btn-ghost" id="catalogue-retry">Retry</button></div>`;$('#catalogue-retry')?.addEventListener('click',load);return}
    const all=sorted(state.collections.filter(matches)),shown=all.slice(0,state.page*state.pageSize);
    status.textContent=`${all.length} of ${state.collections.length} Intelligence Collections match`;
    root.innerHTML=all.length?`<div class="research-collection-grid">${shown.map(collectionCard).join('')}</div>${shown.length<all.length?'<button class="btn btn-ghost knowledge-load-more" id="knowledge-load-more">Load more collections</button>':''}`:'<div class="knowledge-empty" role="status"><h3>No research intelligence matches this search.</h3><p>Broaden the topic, geography, method or evidence criteria.</p><button class="btn btn-ghost" id="empty-clear">Clear filters</button></div>';
    $('#knowledge-load-more')?.addEventListener('click',()=>{state.page++;render()});
    $('#empty-clear')?.addEventListener('click',clear);
    root.querySelectorAll('[data-track-collection]').forEach(link=>link.addEventListener('click',()=>{state.resultOpened=true;track('collection_view',{collection:link.dataset.trackCollection,query:state.query})}));
  }
  function populate(){
    for(const [selector,key] of Object.entries(controlMap)){const node=$(selector);if(node)node.insertAdjacentHTML('beforeend',values(key).map(option).join(''))}
    $('#publication-filter')?.insertAdjacentHTML('beforeend',['Publication','Research Report','Executive Brief','Policy Brief'].map(option).join(''));
    $('#research-filter')?.insertAdjacentHTML('beforeend',['Quantitative','Qualitative','Mixed Methods','Evaluation'].map(option).join(''));
    $('#date-filter')?.insertAdjacentHTML('beforeend',['2026','2025','2024'].map(option).join(''));
    $('#author-filter')?.insertAdjacentHTML('beforeend',option('VoiceInsights Africa'));
    $('#organization-filter')?.insertAdjacentHTML('beforeend',option('VoiceInsights Africa'));
    $('#evidence-filter')?.insertAdjacentHTML('beforeend',['Governed synthetic','Method reviewed','Publication approved'].map(option).join(''));
  }
  function shelfLink(item,label){
    return `<a href="${esc(item.viewer_url)}"><strong>${esc(label||item.title)}</strong><span>${item.product_views.length} available product${item.product_views.length===1?'':'s'} · ${esc(item.version)}</span></a>`;
  }
  function renderShelves(publications){
    const featured=publications.filter(item=>item.product_views.length).slice(0,6);
    const byKind=kind=>publications.filter(item=>item.product_views.some(view=>view.id===kind));
    const featuredRoot=$('#featured-collections');
    if(featuredRoot)featuredRoot.innerHTML=featured.length?featured.map(item=>window.VIACollections.renderCollectionCard(item)).join(''):'<p>The governed catalogue contains no publicly approved products for this view.</p>';
    const shelves=[
      ['#new-publications',publications.slice(0,4)],
      ['#popular-reports',[...byKind('executive_brief'),...byKind('policy_brief'),...byKind('board_pack')].slice(0,4)],
      ['#recent-analyses',[...byKind('executive_analysis'),...byKind('statistical_analysis')].slice(0,4)],
      ['#editor-picks',featured.slice(0,4)]
    ];
    for(const [selector,items] of shelves){
      const node=$(selector);
      if(node)node.innerHTML=items.length?items.map(item=>shelfLink(item)).join(''):'No approved product version is assigned to this governed shelf.';
    }
  }
  function bind(){
    $('#knowledge-search')?.addEventListener('input',event=>{state.query=event.target.value.trim();state.page=1;track('search',{query:state.query});render()});
    for(const [selector,key] of Object.entries(controlMap))$(selector)?.addEventListener('change',event=>{state.filters[key]=event.target.value;state.page=1;track('filter',{filter:key,value:event.target.value});render()});
    for(const [selector,key] of Object.entries(specialMap))$(selector)?.addEventListener('change',event=>{state.filters[key]=event.target.value;state.page=1;track('filter',{filter:key,value:event.target.value});render()});
    $('#knowledge-sort')?.addEventListener('change',event=>{state.sort=event.target.value;track('sort',{value:state.sort});render()});
    $('#knowledge-controls')?.addEventListener('reset',event=>{event.preventDefault();clear()});
  }
  function clear(){state.query='';state.filters={};state.sort='featured';state.page=1;document.querySelectorAll('#knowledge-controls select').forEach(x=>x.value='All');$('#knowledge-sort').value='featured';$('#knowledge-search').value='';render();$('#knowledge-search').focus()}
  async function load(){
    state.loading=true;state.error='';render();
    try{
      const response=await fetch(`${typeof API_BASE_URL!=='undefined'?API_BASE_URL:''}/api/public/intelligence-products`,{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`Catalogue service returned HTTP ${response.status}`);
      const payload=await response.json();
      if(!Array.isArray(payload?.collections))throw new Error('The governed product catalogue returned an invalid response.');
      state.collections=payload.collections.map(collection=>window.VIACollections.normalizeCanonicalCollection(collection));
      const publications=state.collections.map(collection=>collection.publications[0]);
      renderShelves(publications);
      populate();
    }catch(error){
      state.collections=[];
      state.error='The governed product catalogue is temporarily unavailable. Please try again.';
    }finally{state.loading=false;render()}
  }
  function init(){bind();load()}
  addEventListener('beforeunload',()=>{if(state.query&&!state.resultOpened)track('search_abandonment',{query:state.query})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
