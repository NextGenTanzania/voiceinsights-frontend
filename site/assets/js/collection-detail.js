(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const normalizeKind=value=>String(value||'').trim().toLowerCase().replaceAll('-','_');
  async function fetchJson(path){
    const apiBase=typeof API_BASE_URL!=='undefined'?API_BASE_URL:'';
    const response=await fetch(`${apiBase}${path}`,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(response.status===404?'Intelligence Collection not found.':`Collection service returned HTTP ${response.status}.`);
    return response.json();
  }
  function loading(){
    const root=$('#collection-experience');
    if(root)root.innerHTML='<section class="vic-detail-state" aria-live="polite"><h1>Opening Intelligence Collection</h1><p>Loading governed identity, evidence, Product Views and trust information.</p></section>';
  }
  function failure(error){
    const root=$('#collection-experience');
    if(root)root.innerHTML='<section class="vic-detail-state" role="alert"><h1>Governed Collection temporarily unavailable</h1><p>The platform could not verify the current product version. No availability or approval status has been inferred. Retry to reconnect to the governed product catalogue.</p><button type="button" class="btn btn-ghost" id="collection-retry">Retry</button></section>';
    $('#collection-retry')?.addEventListener('click',init);
  }
  function renderSelectedProduct(product,lineage){
    if(!product)return'';
    const artifacts=Array.isArray(product.artifacts)?product.artifacts.filter(item=>item.status==='AVAILABLE'&&item.href):[];
    return `<section class="vic-section vic-selected-product" aria-labelledby="selected-product-title" data-product-kind="${componentsEscape(product.product_kind)}"><div class="vic-section-head"><span class="eyebrow">${componentsEscape(String(product.product_kind).replaceAll('_',' '))}</span><h1 id="selected-product-title">${componentsEscape(product.title)}</h1><p>${componentsEscape(product.purpose)}</p></div><dl class="vic-card-meta"><div><dt>Product status</dt><dd>${componentsEscape(product.lifecycle?.approval_state||product.approval_state)}</dd></div><div><dt>Version</dt><dd>${componentsEscape(product.current_version)}</dd></div><div><dt>Evidence references</dt><dd>${product.provenance?.evidence_ids?.length||0}</dd></div><div><dt>Methodology</dt><dd>${product.intelligence?.methodology?'Available':'Not attached'}</dd></div><div><dt>Lineage</dt><dd>${lineage?.product_id===product.product_id?'Verified':'Unavailable'}</dd></div></dl><div class="publication-actions">${artifacts.map(item=>`<a class="btn btn-ghost" href="${componentsEscape(item.href)}" download type="${componentsEscape(item.mime_type)}">Download ${componentsEscape(item.label)}</a>`).join('')}</div></section>`;
  }
  const componentsEscape=value=>window.VIACollections.escape(value);
  async function init(){
    const components=window.VIACollections;
    if(!components){failure(new Error('Shared Collection components are unavailable.'));return}
    const key=new URLSearchParams(location.search).get('key');
    if(!key){failure(new Error('No Collection key was supplied.'));return}
    loading();
    try{
      const [catalogPayload,detail]=await Promise.all([
        fetchJson('/api/public/intelligence-products'),
        fetchJson(`/api/public/flagship-sample-library/${encodeURIComponent(key)}`)
      ]);
      const entries=(catalogPayload?.collections||[]).map(collection=>({
        ...collection.compatibility_catalog_entry,
        canonical_source:collection.canonical_source,
        canonical_products:collection.products
      }));
      const entry=entries.find(item=>item.key===key);
      if(!entry)throw new Error('Intelligence Collection not found.');
      const collection=components.normalizeCollection(entry,detail);
      const requestedKind=normalizeKind(new URLSearchParams(location.search).get('product'));
      const selectedSummary=requestedKind?entry.canonical_products.find(product=>normalizeKind(product.product_kind)===requestedKind):null;
      if(requestedKind&&!selectedSummary)throw new Error('Intelligence Product not found.');
      const [selectedPayload,lineage]=selectedSummary?await Promise.all([
        fetchJson(selectedSummary.routes.api),
        fetchJson(selectedSummary.routes.lineage)
      ]):[null,null];
      const selectedProduct=selectedPayload?.product||selectedPayload?.intelligence_product||null;
      if(selectedSummary&&selectedProduct?.product_id!==selectedSummary.product_id)throw new Error('Intelligence Product identity mismatch.');
      const catalog=entries.map(item=>components.normalizeCollection(item));
      document.title=`${selectedProduct?.title||collection.title} | VoiceInsights Africa`;
      document.body.dataset.productKind=selectedProduct?.product_kind||'collection';
      const root=$('#collection-experience');
      root.innerHTML=[
        renderSelectedProduct(selectedProduct,lineage),
        components.renderIdentityHeader(collection),
        components.renderHero(collection),
        components.renderDecisionContext(collection),
        components.renderIntelligenceGlance(collection),
        components.renderEvidenceOverview(collection),
        components.renderAnalysisExperience(collection),
        components.renderDecisionOptions(collection),
        components.renderProductConstellation(collection),
        '<section class="vic-section" aria-labelledby="publication-reader-title"><div class="vic-section-head"><span class="eyebrow">Online Product View</span><h2 id="publication-reader-title">Explore the governed publication</h2><p>The online publication remains synchronized with the existing rendering and publication-gate service.</p></div></section>',
      ].join('');
      $('#share-btn')?.addEventListener('click',()=>sharePublication(collection.title));
      $('#bookmark-btn')?.addEventListener('click',()=>toggleBookmark(collection.key,collection.title));
      if(typeof updateBookmarkButton==='function')updateBookmarkButton(collection.key);
      const lower=$('#collection-after-publication');
      if(lower)lower.innerHTML=[
        components.renderTrustPanel(collection),
        components.renderRelatedCollections(collection,catalog),
        components.renderCollectionFooter(collection)
      ].join('');
    }catch(error){failure(error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
