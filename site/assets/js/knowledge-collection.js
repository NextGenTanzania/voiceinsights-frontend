(function(){
  'use strict';
  const esc=value=>window.VIACollections.escape(value);
  const normalizeIdentifier=value=>String(value||'').trim().toLowerCase().replaceAll('_','-').replace(/^collection-/,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
  const slug=normalizeIdentifier(new URLSearchParams(location.search).get('collection'));
  const root=document.querySelector('#collection-experience'),loading=document.querySelector('#collection-loading');
  const track=(type,data={})=>{const events=JSON.parse(localStorage.getItem('via_knowledge_analytics')||'[]');events.push({type,...data,at:new Date().toISOString()});localStorage.setItem('via_knowledge_analytics',JSON.stringify(events.slice(-250)))};
  const empty=message=>`<div class="knowledge-empty"><p>${esc(message)}</p></div>`;
  const publicationCard=item=>{
    const tags=[item.primary_industry,...item.frameworks].filter(Boolean).slice(0,4);
    return `<article class="research-publication-card"><div class="publication-cover" aria-hidden="true"><span>VoiceInsights Africa</span><strong>${esc(item.title)}</strong></div><div><p class="publication-badges"><span>Research quality reviewed</span><span>Verification recorded</span></p><h3><a href="${esc(item.viewer_url)}">${esc(item.title)}</a></h3><p>${esc(item.summary||item.purpose)}</p><dl><div><dt>Available products</dt><dd>${item.product_views.length}</dd></div><div><dt>Sector</dt><dd>${esc(item.primary_industry)}</dd></div><div><dt>Country</dt><dd>${esc(item.geography)}</dd></div><div><dt>Language</dt><dd>${esc(item.language)}</dd></div><div><dt>Date</dt><dd>${esc(item.release_date||'Current')}</dd></div><div><dt>Reading time</dt><dd>${Math.max(6,Math.min(35,item.findings.length*4+8))} minutes</dd></div><div><dt>Author</dt><dd>VoiceInsights Africa</dd></div><div><dt>Organization</dt><dd>VoiceInsights Africa</dd></div></dl><p class="research-topics">${item.product_views.map(view=>`<span>${esc(view.label)}</span>`).join('')}</p><p class="research-topics">${tags.map(x=>`<span>${esc(x)}</span>`).join('')}</p><div class="publication-actions"><a class="btn btn-primary" href="${esc(item.viewer_url)}">Explore products</a>${window.VIACollections.renderQuickDownload(item,'Downloads')}<button class="btn btn-ghost citation-copy" data-citation="${esc(item.citation)}">Copy citation</button></div></div></article>`;
  };
  const productCard=(product,collection)=>{
    const artifacts=Array.isArray(product.artifacts)?product.artifacts.filter(item=>item.status==='AVAILABLE'&&item.href):[];
    const status=product.lifecycle?.approval_state||product.approval_state||'Status unavailable';
    const version=product.current_version||product.canonical_source?.version||collection.version;
    return `<article class="research-publication-card" data-product-id="${esc(product.product_id)}"><div class="publication-cover" aria-hidden="true"><span>${esc(String(product.product_kind).replaceAll('_',' '))}</span><strong>${esc(product.title)}</strong></div><div><p class="publication-badges"><span>${esc(status)}</span><span>${esc(product.workflow_state||product.lifecycle?.workflow_state||'State unavailable')}</span></p><h3><a href="${esc(product.routes?.online||product.routes?.overview)}">${esc(product.title)}</a></h3><p>${esc(product.purpose)}</p><dl><div><dt>Product type</dt><dd>${esc(String(product.product_kind).replaceAll('_',' '))}</dd></div><div><dt>Status</dt><dd>${esc(status)}</dd></div><div><dt>Version</dt><dd>${esc(version)}</dd></div><div><dt>Evidence</dt><dd>${product.provenance?.evidence_ids?.length||0} linked records</dd></div><div><dt>Methodology</dt><dd>${product.intelligence?.methodology?'Available':'Not attached'}</dd></div><div><dt>Downloads</dt><dd>${artifacts.length}</dd></div></dl><div class="publication-actions"><a class="btn btn-primary" href="${esc(product.routes?.online||product.routes?.overview)}">Open ${esc(String(product.product_kind).replaceAll('_',' '))}</a>${artifacts.length?`<details class="vic-download"><summary class="btn btn-ghost">Downloads</summary><div class="vic-download-menu">${artifacts.map(item=>`<a href="${esc(item.href)}" download type="${esc(item.mime_type)}"><strong>${esc(item.label)}</strong><span>Version ${esc(version)}</span></a>`).join('')}</div></details>`:''}<a class="btn btn-ghost" href="${esc(product.routes?.lineage)}">Inspect lineage</a></div></div></article>`;
  };
  const list=(title,items)=>`<section class="collection-domain-block"><h2>${esc(title)}</h2>${items.length?`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:empty(`No approved ${title.toLowerCase()} are currently published.`)}</section>`;
  function setSeo(collection){
    const canonical=`https://voiceinsightsafrica.com/knowledge/collection.html?collection=${encodeURIComponent(collection.slug)}`;
    document.title=`${collection.title} Intelligence Collection | VoiceInsights Africa`;
    document.querySelector('#canonical-url').href=canonical;
    for(const selector of ['#seo-description','#og-description'])document.querySelector(selector).content=collection.summary;
    document.querySelector('#og-title').content=document.title;document.querySelector('#twitter-title').content=document.title;
    document.querySelector('#collection-jsonld').textContent=JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:collection.title,description:collection.summary,url:canonical,isPartOf:{'@type':'CollectionPage',name:'VoiceInsights Africa Knowledge Hub',url:'https://voiceinsightsafrica.com/sample-reports.html'},breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Knowledge Hub',item:'https://voiceinsightsafrica.com/sample-reports.html'},{'@type':'ListItem',position:2,name:collection.title,item:canonical}]}});
  }
  function render(collection,collections){
    setSeo(collection);const pubs=collection.publications,featured=collection.products,latest=[...pubs].sort((a,b)=>String(b.release_date).localeCompare(String(a.release_date))).slice(0,3),related=window.VIACollections.recommendRelated(collection,collections).map(item=>item.collection);
    const top=pubs[0];const aiSummary=top?`Based only on published metadata, this domain currently connects ${pubs.length} governed publication${pubs.length===1?'':'s'} across ${collection.topics.join(', ')}. Open each publication to inspect its evidence and limitations.`:'No publication metadata is available for AI-assisted summarization.';
    root.innerHTML=`<nav class="knowledge-hierarchy" aria-label="Breadcrumb"><a href="/sample-reports.html">Knowledge Hub</a><span aria-hidden="true">›</span><span aria-current="page">${esc(collection.title)}</span></nav>
      <header class="collection-domain-hero"><div><span class="eyebrow">${esc(collection.status)} Intelligence Collection</span><h1>${esc(collection.title)}</h1><p class="lead">${esc(collection.summary)}</p><div class="knowledge-showcase-actions"><a class="btn btn-primary" href="#featured-publications">Explore publications</a><a class="btn btn-ghost" href="#interactive-statistics">View statistics</a></div></div><aside class="collection-domain-cover" aria-label="${esc(collection.title)} collection identity"><span>${esc(collection.id)}</span><strong>${esc(collection.title)}</strong><small>Research · Evidence · Decisions</small></aside></header>
      <section class="collection-stat-band" aria-label="Collection statistics">${[['Available products',collection.statistics.products],['Indicators',collection.statistics.indicators],['Methods',collection.statistics.methods],['Countries',collection.statistics.countries]].map(([key,value])=>`<div><strong>${value}</strong><span>${esc(key)}</span></div>`).join('')}</section>
      <nav class="collection-domain-nav" aria-label="Collection sections"><a href="#coverage">Coverage</a><a href="#featured-publications">Featured</a><a href="#latest-publications">Latest</a><a href="#interactive-statistics">Statistics</a><a href="#methods">Methods</a><a href="#related">Related</a><a href="#faqs">FAQs</a></nav>
      <section id="coverage" class="collection-domain-grid">${list('Key Themes',collection.topics)}${list('Research Areas',collection.topics)}${list('Indicators',collection.indicators)}${list('SDGs',collection.sdgs)}${list('OECD-DAC and Frameworks',collection.frameworks)}${list('Countries Covered',collection.countries)}</section>
      <section id="featured-publications" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Featured intelligence</span><h2>Available Intelligence Products</h2></div>${featured.length?featured.map(product=>productCard(product,collection)).join(''):empty('No approved Intelligence Products are currently available in this Collection.')}</section>
      <section id="latest-publications" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Current research</span><h2>Latest, most viewed and most downloaded</h2></div><div class="publication-section-grid"><div><h3>Latest publications</h3>${latest.length?latest.map(publicationCard).join(''):empty('No latest publications.')}</div><div><h3>Most viewed</h3><p>${top?`${esc(top.title)} · governed usage analytics available when published`:'No usage-ranked publications.'}</p><h3>Most downloaded</h3><p>${top?`${esc(top.title)} · verified native formats only`:'No download-ranked publications.'}</p><h3>Trending topics and tags</h3><p class="research-topics">${collection.topics.map(x=>`<span>${esc(x)}</span>`).join('')}</p><h3>Publication timeline</h3><ol class="publication-timeline">${pubs.map(p=>`<li><time>${esc(p.release_date||'Current')}</time><a href="${esc(p.viewer_url)}">${esc(p.title)}</a></li>`).join('')||'<li>No approved timeline entries.</li>'}</ol></div></div></section>
      <section id="interactive-statistics" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Interactive statistics</span><h2>Product and research coverage at a glance</h2></div><div class="collection-stat-visual" role="img" aria-label="${collection.statistics.products} available products, ${collection.statistics.indicators} indicators and ${collection.statistics.methods} research methods">${[['Products',collection.statistics.products,84],['Indicators',collection.statistics.indicators,12],['Methods',collection.statistics.methods,12]].map(([label,value,max])=>`<div><span>${label}</span><progress max="${max}" value="${Math.min(max,value)}">${value}</progress><strong>${value}</strong></div>`).join('')}</div></section>
      <section class="vic-section ai-metadata-insight"><div><span class="eyebrow">AI-assisted metadata insight</span><h2>Research highlights</h2><p>${esc(aiSummary)}</p><small>No research claims were generated. This summary uses publication metadata only.</small></div></section>
      <section id="methods" class="collection-domain-grid">${list('Featured Datasets',pubs.flatMap(p=>p.downloads.filter(d=>d.format==='xlsx').map(()=>`${p.title} statistical dataset`)).slice(0,4))}${list('Evidence Highlights',pubs.flatMap(p=>p.findings.map(f=>f.title)).slice(0,6))}${list('Methodologies',collection.methodologies)}${list('Research Standards',['Evidence lineage','Human review','Method disclosure','Uncertainty visibility','Publication approval'])}${list('Downloads',pubs.flatMap(p=>p.downloads.map(d=>`${d.label}: ${p.title}`)).slice(0,8))}${list('Latest Updates',[`Collection metadata updated ${collection.updated}`])}</section>
      <section id="related" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Related intelligence</span><h2>Connected collections</h2></div><div class="related-domain-grid">${related.map(x=>`<a href="${esc(x.url)}"><strong>${esc(x.title)}</strong><span>${esc(x.topics.join(' · '))}</span></a>`).join('')}</div></section>
      <section id="faqs" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Collection guidance</span><h2>Frequently asked questions</h2></div><details><summary>What belongs in this Collection?</summary><p>Only governed publications, evidence products, indicators and methods relevant to ${esc(collection.title)}.</p></details><details><summary>How are publications verified?</summary><p>Each publication exposes its evidence, methodology, review, version and synthetic status through its Trust Panel.</p></details><details><summary>Can I cite these products?</summary><p>Yes. Use the version-specific citation supplied with each released Product View.</p></details></section>`;
    loading.hidden=true;root.hidden=false;track('collection_view',{collection:collection.slug});
    root.querySelectorAll('.citation-copy').forEach(button=>button.addEventListener('click',async()=>{await navigator.clipboard?.writeText(button.dataset.citation);button.textContent='Citation copied'}));
    root.querySelectorAll('a[download],.vic-download-menu a').forEach(link=>link.addEventListener('click',()=>track('download',{collection:collection.slug,href:link.getAttribute('href')})));
    root.querySelectorAll('.research-publication-card h3 a').forEach(link=>link.addEventListener('click',()=>track('publication_view',{collection:collection.slug,href:link.getAttribute('href')})));
    let completed=false;addEventListener('scroll',()=>{if(!completed&&(scrollY+innerHeight)>=document.documentElement.scrollHeight*.75){completed=true;track('reading_completion',{collection:collection.slug,threshold:75})}},{passive:true});
  }
  function showState(kind){
    const messages={
      missing:'No Collection was selected. Return to the Knowledge Hub.',
      unavailable:'The governed product catalogue is temporarily unavailable. Please try again.',
      unknown:'This Collection was not found in the governed product catalogue.',
      withdrawn:'This Collection is not currently available under its governed publication status.'
    };
    loading.innerHTML=`${esc(messages[kind])} <a href="/sample-reports.html">Return to the Knowledge Hub</a>.`;
  }
  async function init(){
    if(!slug){showState('missing');return}
    try{
      const response=await fetch(`${typeof API_BASE_URL!=='undefined'?API_BASE_URL:''}/api/public/intelligence-products`,{headers:{Accept:'application/json'}});
      if(!response.ok){showState('unavailable');return}
      const payload=await response.json();
      if(!Array.isArray(payload?.collections)){showState('unavailable');return}
      const source=payload.collections.find(item=>{
        const identifiers=[item.slug,item.key,item.collection_id].map(normalizeIdentifier);
        return identifiers.includes(slug);
      });
      if(!source){showState('unknown');return}
      if(['WITHDRAWN','SUPERSEDED','INVALID'].includes(String(source.status).toUpperCase())){showState('withdrawn');return}
      const collections=payload.collections.map(item=>window.VIACollections.normalizeCanonicalCollection(item));
      const collection=collections.find(item=>item.collection_id===source.collection_id);
      render(collection,collections);
    }catch(error){showState('unavailable')}
  }
  init();
})();
