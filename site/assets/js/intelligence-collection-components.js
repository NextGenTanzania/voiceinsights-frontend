(function(global){
  'use strict';

  const SYNTHETIC_FALLBACK='This collection contains governed synthetic demonstration evidence. It is not an assessment of any real population, country or institution.';
  const FORMAT_DEFINITIONS=Object.freeze({
    pdf:{label:'PDF',mime:'application/pdf',product:'Publication'},
    docx:{label:'DOCX',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',product:'Research Report'},
    pptx:{label:'PPTX',mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',product:'Presentation'},
    xlsx:{label:'XLSX',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',product:'Dataset'}
  });
  const COMPONENT_CONTRACTS=Object.freeze({
    identityHeader:{purpose:'Preserve collection identity and governance context.',inputs:['collection'],outputs:['breadcrumb','identity','metadata'],dependencies:[],reuse:['detail'],states:['ready','loading','error','empty'],accessibility:'Landmarked breadcrumb, one canonical title and persistent disclosure.'},
    hero:{purpose:'Establish purpose, decision relevance and approved actions.',inputs:['collection'],outputs:['hero'],dependencies:['identityHeader','quickDownload'],reuse:['detail'],states:['ready','loading','error'],accessibility:'Decision question is text; actions have explicit destinations.'},
    decisionContext:{purpose:'Explain who uses the intelligence and which decisions it supports.',inputs:['decision_questions','audiences'],outputs:['decision context'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Questions and audiences use structured headings and lists.'},
    intelligenceGlance:{purpose:'Separate Findings, Insights, Risks and Opportunities.',inputs:['intelligence'],outputs:['object summaries'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Object type is expressed in text, never by colour alone.'},
    evidenceOverview:{purpose:'Summarize evidence coverage, quality and method.',inputs:['evidence','methodology'],outputs:['evidence overview'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Status and coverage have text equivalents.'},
    analysisExperience:{purpose:'Connect analysis, Findings, Insights and limitations.',inputs:['analysis','findings','insights','limitations'],outputs:['analysis experience'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Progressive disclosure uses native details elements.'},
    decisionOptions:{purpose:'Expose choices, trade-offs, benefits, risks and Outcomes.',inputs:['decisions','recommendations'],outputs:['option comparison'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Comparison remains readable as a sequential list.'},
    productConstellation:{purpose:'Expose approved Product Views only.',inputs:['product_views'],outputs:['grouped product navigation'],dependencies:[],reuse:['detail','library'],states:['ready','empty'],accessibility:'Groups and availability are announced in text.'},
    quickDownload:{purpose:'Provide verified native artifacts without placeholder controls.',inputs:['downloads'],outputs:['download menu'],dependencies:[],reuse:['cards','hero','footer'],states:['ready','empty'],accessibility:'Native details menu; format appears in every link label.'},
    trustPanel:{purpose:'Make evidence, review, AI, publication and version states inspectable.',inputs:['trust'],outputs:['trust summary'],dependencies:[],reuse:['detail'],states:['ready','empty'],accessibility:'Definition list preserves label/value relationships.'},
    relatedCollections:{purpose:'Recommend unique collections through governed metadata similarity.',inputs:['collection','catalog'],outputs:['related collection cards'],dependencies:['collectionCard'],reuse:['detail'],states:['ready','empty'],accessibility:'Every recommendation explains its relationship.'},
    industryShelf:{purpose:'Show canonical collection references on existing Industry pages.',inputs:['industry','catalog'],outputs:['four to eight collection cards'],dependencies:['collectionCard'],reuse:['industry pages'],states:['ready','loading','error','empty'],accessibility:'Section heading and result status precede the cards.'},
    collectionFooter:{purpose:'Close with citation, version, related resources and enterprise action.',inputs:['collection'],outputs:['citation','enterprise CTA'],dependencies:['quickDownload'],reuse:['detail'],states:['ready'],accessibility:'CTA purpose and citation are explicit.'}
  });

  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text=value=>String(value??'').trim();
  const list=value=>Array.isArray(value)?value.filter(Boolean):[];
  const titleCase=value=>text(value).replaceAll('_',' ').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());
  const unique=value=>[...new Set(list(value).map(text).filter(Boolean))];
  const stripReport=value=>text(value).replace(/\s+Report$/i,'').trim();
  const sentence=value=>{const result=text(value);return result&&!/[.!?]$/.test(result)?`${result}.`:result};

  function approvedDownloads(entry,detail){
    const canonicalProducts=list(entry.canonical_products);
    if(canonicalProducts.length){
      const seen=new Set();
      return canonicalProducts.flatMap(product=>list(product.artifacts)).filter(item=>item.status==='AVAILABLE'&&item.href&&!seen.has(item.href)&&seen.add(item.href)).map(item=>({
        format:item.format,
        label:item.label,
        mime:item.mime_type,
        product:titleCase(item.format),
        href:item.href,
        version:text(productVersion(canonicalProducts,item)||entry.version||entry.last_updated||'current'),
        status:'AVAILABLE',
        canonical:true
      }));
    }
    const manifest=list(detail?.report?.export_manifest);
    const manifestFormats=new Set(manifest.filter(item=>text(item.status).includes('GENERATED')).map(item=>text(item.path).split('/').pop()).filter(format=>FORMAT_DEFINITIONS[format]));
    const formats=manifestFormats.size?[...manifestFormats]:Object.keys(FORMAT_DEFINITIONS);
    return formats.map(format=>({
      format,
      ...FORMAT_DEFINITIONS[format],
      href:`/sample-exports/${encodeURIComponent(entry.key)}/${encodeURIComponent(entry.key)}.${format}`,
      version:text(entry.version||entry.last_updated||'current'),
      status:'AVAILABLE'
    }));
  }

  function productVersion(products,artifact){
    return products.find(product=>list(product.artifacts).some(item=>item.artifact_id===artifact.artifact_id))?.current_version;
  }

  function approvedProductViews(entry,detail,downloads){
    const canonicalProducts=list(entry.canonical_products);
    if(canonicalProducts.length){
      const groups={analysis_product:'Analysis',professional_report:'Analysis',premium_publication:'Executive',executive_brief:'Executive',dashboard:'Interactive',dataset_reference:'Resources',indicator_pack:'Resources'};
      return canonicalProducts.map(product=>({
        id:product.product_kind,
        product_id:product.product_id,
        label:titleCase(product.product_kind),
        group:groups[product.product_type]||'Analysis',
        online:product.routes?.online||product.routes?.overview,
        download:list(product.artifacts)[0]?.href,
        canonical_uri:product.canonical_uri,
        version:product.current_version,
        approval_state:product.lifecycle?.approval_state
      }));
    }
    const report=detail?.report||{};
    const views=[];
    if(report.findings?.length||report.analytical_depth)views.push({id:'analysis',label:'Analysis',group:'Analysis',online:'#collection-analysis'});
    if(entry.viewer_url||report.full_publication||detail?.full_publication)views.push({id:'publication',label:'Publication',group:'Analysis',online:`${entry.viewer_url||`/flagship-sample-report.html?key=${encodeURIComponent(entry.key)}`}#publication-reader`});
    if(report.methodology||/report/i.test(entry.title))views.push({id:'research-report',label:'Research Report',group:'Analysis',online:report.methodology?'#collection-methodology':entry.viewer_url});
    if(report.executive_book||report.executive_summary)views.push({id:'executive-brief',label:'Executive Brief',group:'Executive',online:'#collection-decision-context'});
    if(report.policy_implications)views.push({id:'policy-brief',label:'Policy Brief',group:'Executive',online:'#collection-decisions'});
    if(list(report.exports).some(item=>/cabinet/i.test(item)))views.push({id:'cabinet-brief',label:'Cabinet Brief',group:'Executive',online:'#collection-decisions'});
    if(list(report.exports).some(item=>/board/i.test(item)))views.push({id:'board-paper',label:'Board Paper',group:'Executive',online:'#collection-decisions'});
    if(downloads.some(item=>item.format==='pptx'))views.push({id:'presentation',label:'Presentation',group:'Executive',download:downloads.find(item=>item.format==='pptx')?.href});
    if(report.interactive_flow||report.visualizations?.length)views.push({id:'dashboard',label:'Interactive Intelligence',group:'Interactive',online:'#publication-reader'});
    if(report.evidence?.length)views.push({id:'evidence-explorer',label:'Evidence Explorer',group:'Interactive',online:'#collection-evidence'});
    if(detail?.full_publication?.indicators?.length||report.statistical_intelligence)views.push({id:'indicator-explorer',label:'Indicator Explorer',group:'Interactive',online:'#collection-analysis'});
    if(report.decision_intelligence?.length)views.push({id:'decision-explorer',label:'Decision Explorer',group:'Interactive',online:'#collection-decisions'});
    if(report.methodology)views.push({id:'methodology',label:'Methodology',group:'Resources',online:'#collection-methodology'});
    if(downloads.some(item=>item.format==='xlsx'))views.push({id:'dataset',label:'Statistical Dataset',group:'Resources',download:downloads.find(item=>item.format==='xlsx')?.href});
    return views;
  }

  function normalizeCollection(entry,detail=null){
    const report=detail?.report||{};
    const canonicalProducts=list(entry.canonical_products);
    const downloads=approvedDownloads(entry,detail);
    const findings=list(report.findings).map(item=>({id:item.id,title:item.title||item.headline,summary:item.text,confidence:item.confidence_score,status:item.verification_status,evidence_ids:list(item.evidence_ids)}));
    const recommendations=list(report.recommendations);
    const insights=findings.map(item=>({id:`INS-${item.id}`,title:item.title,summary:list(report.findings).find(f=>f.id===item.id)?.interpretation||item.summary,source_finding:item.id}));
    const risks=unique(recommendations.map(item=>item.expected_risk)).map((summary,index)=>({id:`RSK-${index+1}`,title:`Implementation risk ${index+1}`,summary}));
    const opportunities=unique(recommendations.map(item=>item.expected_benefit)).map((summary,index)=>({id:`OPP-${index+1}`,title:`Strategic opportunity ${index+1}`,summary}));
    const primaryIndustry=text(entry.sector||entry.domain||entry.category||'Cross-cutting');
    const relatedIndustries=unique([entry.domain,entry.category,...list(entry.standards).filter(item=>/health|education|agric|government|human|development|research/i.test(item))]).filter(item=>item!==primaryIndustry).slice(0,4);
    const productViews=approvedProductViews(entry,detail,downloads);
    const decisionQuestions=list(report.methodology?.evaluation_questions);
    const governingQuestion=decisionQuestions[0]||`What evidence should decision-makers prioritize within ${text(entry.sector||'this domain')}?`;
    const isSynthetic=/synthetic/i.test(text(report.classification||entry.synthetic_notice));
    const safePurpose=sentence(entry.promise||entry.executive_story||report.subtitle).replace(new RegExp(`\\b${text(entry.country||report.country).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'gi'),'the synthetic demonstration context');
    return {
      key:entry.key,
      title:stripReport(entry.title),
      legacy_title:entry.title,
      purpose:safePurpose,
      summary:sentence(entry.executive_story||report.executive_summary?.overview||entry.promise).replace(new RegExp(`\\b${text(entry.country||report.country).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'gi'),'the synthetic demonstration context'),
      status:text(entry.publication_status||'Demonstration ready'),
      version:text(entry.version||entry.last_updated||report.publication_date||'Current'),
      release_date:text(entry.last_updated||report.publication_date),
      primary_industry:primaryIndustry,
      related_industries:relatedIndustries,
      audiences:unique([titleCase(entry.profile),entry.category,'Executive leadership','Technical reviewers']).slice(0,4),
      decision_question:governingQuestion,
      decision_questions:decisionQuestions.length?decisionQuestions:[governingQuestion],
      synthetic_notice:text(entry.synthetic_notice||detail?.integrity_notice||SYNTHETIC_FALLBACK),
      classification:text(report.classification||'PUBLIC SYNTHETIC DEMONSTRATION'),
      geography:isSynthetic?'Synthetic demonstration context':text(entry.country||report.country||'Geography not stated'),
      period:text(report.publication_date||entry.last_updated),
      language:'English',
      frameworks:list(entry.standards),
      findings,
      insights,
      risks,
      opportunities,
      evidence:list(report.evidence),
      methodology:report.methodology||null,
      limitations:list(report.limitations),
      recommendations,
      decisions:list(report.decision_intelligence),
      ai:report.ai_governance||null,
      downloads,
      product_views:productViews,
      intelligence_products:canonicalProducts,
      canonical_source:entry.canonical_source||canonicalProducts[0]?.canonical_source||null,
      pipeline:canonicalProducts[0]?.provenance?.pipeline||null,
      viewer_url:entry.viewer_url||`/flagship-sample-report.html?key=${encodeURIComponent(entry.key)}`,
      citation:`VoiceInsights Africa (${text(entry.last_updated||'2026')}). ${stripReport(entry.title)}. Synthetic demonstration collection. Version ${text(entry.version||entry.last_updated||'current')}.`,
      trust:{
        evidence:findings.length&&list(report.evidence).length?'Reviewed synthetic evidence':'Evidence details unavailable',
        human_review:text(report.ai_governance?.reviewer||entry.prepared_by||'VoiceInsights Assurance Reviewer'),
        ai:report.ai_governance?text(report.ai_governance.model):'No AI contribution disclosed',
        publication:text(entry.publication_status||report.quality_scores?.gate||'Status unavailable'),
        accessibility:list(entry.trust_badges).find(item=>item.id==='accessibility')?.satisfied?'Review recorded':'Not verified',
        methodology:report.methodology?'Available':'Not available',
        version:text(entry.version||entry.last_updated||'Current'),
        citation:'Available',
        frameworks:list(entry.standards).length?`${list(entry.standards).length} relevance mappings`:'No mappings disclosed',
        review_history:text(entry.assurance_status||'Review status unavailable')
      }
    };
  }

  function normalizeCanonicalCollection(collection,detail=null){
    const products=list(collection?.products).filter(product=>
      product.collection_id===collection.collection_id
      && product.visibility==='PUBLIC'
      && product.workflow_state==='PUBLISHED'
      && product.approval_state==='APPROVED'
    );
    const entry={
      ...(collection?.compatibility_catalog_entry||{}),
      key:collection?.key,
      title:collection?.title,
      sector:collection?.sector,
      category:collection?.category,
      version:collection?.version,
      synthetic_notice:collection?.synthetic_notice,
      canonical_source:collection?.canonical_source,
      canonical_products:products
    };
    const normalized=normalizeCollection(entry,detail);
    const productIntelligence=products.map(product=>product.intelligence||{});
    const indicatorLabels=unique(productIntelligence.flatMap(item=>list(item.indicators).map(indicator=>text(indicator?.title||indicator?.name||indicator?.label||indicator?.id||indicator))));
    const frameworks=unique([
      ...list(entry.standards),
      ...productIntelligence.flatMap(item=>list(item.framework_mapping).map(mapping=>text(mapping?.name||mapping?.framework||mapping?.id||mapping)))
    ]);
    const methods=unique(productIntelligence.flatMap(item=>{
      const methodology=item.methodology;
      if(!methodology)return[];
      if(Array.isArray(methodology))return methodology.map(value=>text(value?.name||value?.method||value));
      return list(methodology.methods).map(value=>text(value?.name||value?.method||value)).concat(text(methodology.design||methodology.approach||methodology.name));
    }));
    const topics=unique([
      collection?.sector,
      collection?.category,
      ...products.flatMap(product=>list(product.semantic_context?.topics))
    ]);
    return {
      ...normalized,
      id:text(collection?.collection_id),
      collection_id:text(collection?.collection_id),
      key:text(collection?.key),
      slug:text(collection?.slug),
      url:`/knowledge/collection.html?collection=${encodeURIComponent(text(collection?.slug))}`,
      viewer_url:`/knowledge/collection.html?collection=${encodeURIComponent(text(collection?.slug))}`,
      title:text(collection?.title),
      summary:sentence(collection?.summary||normalized.summary),
      status:text(collection?.status),
      version:text(collection?.version||normalized.version),
      products,
      publications:[normalized],
      topics,
      sdgs:frameworks.filter(value=>/^SDG\b/i.test(value)),
      frameworks,
      methodologies:methods,
      indicators:indicatorLabels,
      countries:[normalized.geography].filter(Boolean),
      regions:['Africa'],
      languages:unique(products.flatMap(product=>list(product.languages)).map(titleCase)),
      updated:text(normalized.release_date||collection?.version||'Current'),
      statistics:{
        publications:products.filter(product=>product.product_kind==='publication').length,
        products:products.length,
        indicators:indicatorLabels.length,
        methods:methods.length,
        countries:normalized.geography?1:0,
        views:0,
        downloads:products.reduce((count,product)=>count+list(product.artifacts).length,0)
      },
      catalogue_status:products.length?'PRODUCTS_AVAILABLE':'NO_APPROVED_PRODUCTS'
    };
  }

  function renderQuickDownload(collection,label='Quick Download'){
    if(!collection.downloads.length)return '';
    return `<details class="vic-download"><summary class="btn btn-ghost">${escape(label)}</summary><div class="vic-download-menu" role="group" aria-label="${escape(collection.title)} downloads">${collection.downloads.map(item=>`<a href="${escape(item.href)}" download type="${escape(item.mime)}"><strong>${escape(item.label)}</strong><span>${escape(item.product)} · ${escape(item.version)}</span></a>`).join('')}</div></details>`;
  }

  function renderCollectionCard(collection,options={}){
    const relationship=options.relationship?`<span class="vic-badge">${escape(options.relationship)}</span>`:'';
    return `<article class="vic-card" data-collection-key="${escape(collection.key)}"><div class="vic-card-top"><span class="vic-status">${escape(collection.status)}</span>${relationship}<h3>${escape(collection.title)}</h3><p>${escape(collection.purpose)}</p></div><dl class="vic-card-meta"><div><dt>Primary industry</dt><dd>${escape(collection.primary_industry)}</dd></div><div><dt>Audience</dt><dd>${escape(collection.audiences[0]||'Enterprise decision-makers')}</dd></div><div><dt>Products</dt><dd>${collection.product_views.length} approved views</dd></div><div><dt>Version</dt><dd>${escape(collection.version)}</dd></div></dl>${collection.related_industries.length?`<p class="vic-related"><strong>Related:</strong> ${collection.related_industries.map(escape).join(' · ')}</p>`:''}<div class="vic-card-actions"><a class="btn btn-primary" href="${escape(collection.viewer_url)}">Explore Collection</a>${renderQuickDownload(collection)}</div></article>`;
  }

  function renderIdentityHeader(collection){
    return `<div class="vic-identity"><nav aria-label="Breadcrumb"><a href="/index.html">VoiceInsights Africa</a><span aria-hidden="true">›</span><a href="/sample-reports.html">Intelligence Library</a><span aria-hidden="true">›</span><span aria-current="page">${escape(collection.title)}</span></nav><div class="vic-identity-line"><span class="vic-status">${escape(collection.status)}</span><span>${escape(collection.primary_industry)}</span><span>Version ${escape(collection.version)}</span><span>Synthetic demonstration</span></div></div>`;
  }

  function renderHero(collection){
    return `<header class="vic-hero"><div><span class="eyebrow">Intelligence Collection</span><h1>${escape(collection.title)}</h1><p class="vic-decision-statement">${escape(collection.decision_question)}</p><p class="lead">${escape(collection.purpose)}</p><div class="vic-hero-actions"><a class="btn btn-primary" href="#collection-glance">Explore the Intelligence</a><a class="btn btn-ghost" href="#collection-decision-context">View Decision Context</a>${renderQuickDownload(collection,'Downloads')}<button class="btn btn-ghost" type="button" id="share-btn">Share</button><button class="btn btn-ghost" type="button" id="bookmark-btn" data-collection-key="${escape(collection.key)}" data-collection-title="${escape(collection.title)}">Save for later</button></div></div><aside class="vic-hero-meta" aria-label="Collection trust summary"><dl><div><dt>Evidence</dt><dd>${escape(collection.trust.evidence)}</dd></div><div><dt>Methodology</dt><dd>${escape(collection.trust.methodology)}</dd></div><div><dt>Human review</dt><dd>${escape(collection.trust.human_review)}</dd></div><div><dt>Accessibility</dt><dd>${escape(collection.trust.accessibility)}</dd></div></dl><p class="vic-synthetic"><strong>Synthetic Demonstration:</strong> ${escape(collection.synthetic_notice)}</p></aside></header>`;
  }

  function renderDecisionContext(collection){
    return `<section id="collection-decision-context" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Decision context</span><h2>Intelligence organized around institutional decisions</h2></div><div class="vic-decision-grid"><div><h3>Governing question</h3><p class="vic-question">${escape(collection.decision_question)}</p>${collection.decision_questions.length>1?`<details><summary>Supporting questions</summary><ul>${collection.decision_questions.slice(1).map(item=>`<li>${escape(item)}</li>`).join('')}</ul></details>`:''}</div><div><h3>Who should read this</h3><ul>${collection.audiences.map(item=>`<li>${escape(item)}</li>`).join('')}</ul><h3>Expected decisions</h3><p>${collection.decisions.length?`${collection.decisions.length} governed decision pathways are available for review.`:'Decision pathways appear only when the Collection contains approved decision intelligence.'}</p></div></div></section>`;
  }

  const objectGroup=(title,items,empty)=>`<section><h3>${escape(title)}</h3>${items.length?items.slice(0,4).map(item=>`<article class="vic-object"><h4>${escape(item.title)}</h4><p>${escape(item.summary)}</p></article>`).join(''):`<p class="vic-empty">${escape(empty)}</p>`}</section>`;
  function renderIntelligenceGlance(collection){
    return `<section id="collection-glance" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Intelligence at a glance</span><h2>From governed evidence to material intelligence</h2></div><div class="vic-glance-grid">${objectGroup('Findings',collection.findings,'No approved Findings are available.')}${objectGroup('Insights',collection.insights,'No approved Insights are available.')}${objectGroup('Risks',collection.risks,'No reviewed Risks are available.')}${objectGroup('Opportunities',collection.opportunities,'No reviewed Opportunities are available.')}</div></section>`;
  }

  function renderEvidenceOverview(collection){
    const families=unique(collection.evidence.map(item=>titleCase(item.type)));
    return `<section id="collection-evidence" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Evidence</span><h2>Coverage, quality and traceability</h2></div><div class="vic-evidence-grid"><div><h3>Evidence families</h3>${families.length?`<ul>${families.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`:'<p class="vic-empty">No public evidence families are available.</p>'}</div><div><h3>Coverage</h3><p>${collection.evidence.length?`${collection.evidence.length} public-safe evidence records support this Collection.`:'Coverage details are unavailable.'}</p><p><strong>Geography:</strong> ${escape(collection.geography)}</p><p><strong>Period:</strong> ${escape(collection.period||'Not stated')}</p></div><div><h3>Methodology</h3><p>${collection.methodology?escape(list(collection.methodology.research_objectives).join(' ')):'Methodology summary is unavailable.'}</p><a href="#collection-methodology">Inspect method and limitations</a></div></div></section>`;
  }

  function renderAnalysisExperience(collection){
    return `<section id="collection-analysis" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Analysis experience</span><h2>Analysis, interpretation and limitations remain distinct</h2></div><div class="vic-reading-grid"><div><h3>Principal Findings</h3>${collection.findings.length?collection.findings.map(item=>`<article class="vic-finding"><h4>${escape(item.title)}</h4><p>${escape(item.summary)}</p><p class="vic-object-meta">${escape(item.status||'Review status unavailable')} · ${item.evidence_ids.length} evidence reference${item.evidence_ids.length===1?'':'s'}</p></article>`).join(''):'<p class="vic-empty">No Findings are available.</p>'}</div><div><h3>Interpretive Insights</h3>${collection.insights.length?collection.insights.map(item=>`<article class="vic-insight"><h4>${escape(item.title)}</h4><p>${escape(item.summary)}</p><p class="vic-object-meta">Interpretation linked to ${escape(item.source_finding)}</p></article>`).join(''):'<p class="vic-empty">No Insights are available.</p>'}<details id="collection-methodology"><summary>Methodology and limitations</summary>${collection.methodology?`<p><strong>Sampling:</strong> ${escape(collection.methodology.sampling_frame)}</p><p><strong>Weights:</strong> ${escape(collection.methodology.weights)}</p><p><strong>Uncertainty:</strong> ${escape(collection.methodology.confidence_intervals)}</p>`:'<p>Methodology is not available.</p>'}<ul>${collection.limitations.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></details></div></div></section>`;
  }

  function renderDecisionOptions(collection){
    const options=collection.recommendations;
    return `<section id="collection-decisions" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Decision options</span><h2>Choices, trade-offs and expected Outcomes</h2></div>${options.length?`<div class="vic-option-grid">${options.map((item,index)=>`<article class="vic-option"><span>Option ${index+1}</span><h3>${escape(item.recommendation)}</h3><dl><div><dt>Owner</dt><dd>${escape(item.owner)}</dd></div><div><dt>Benefit</dt><dd>${escape(item.expected_benefit)}</dd></div><div><dt>Risk</dt><dd>${escape(item.expected_risk)}</dd></div><div><dt>Resources</dt><dd>${escape(item.budget_requirement)}</dd></div><div><dt>Horizon</dt><dd>${escape(item.timeline)}</dd></div><div><dt>Monitoring</dt><dd>${escape(item.monitoring_indicator)}</dd></div></dl></article>`).join('')}</div>`:'<p class="vic-empty">No approved Decision Options are publicly available.</p>'}</section>`;
  }

  function renderProductConstellation(collection){
    const groups=['Analysis','Executive','Interactive','Resources'];
    return `<section id="collection-products" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Product View constellation</span><h2>One governed Collection, distinct intelligence products</h2></div><div class="vic-product-groups">${groups.map(group=>{const views=collection.product_views.filter(item=>item.group===group);return views.length?`<section><h3>${group}</h3>${views.map(item=>`<a class="vic-product" href="${escape(item.online||item.download)}"${item.download?' download':''}><strong>${escape(item.label)}</strong><span>${item.online?'Explore online':'Native download'}</span></a>`).join('')}</section>`:''}).join('')}</div></section>`;
  }

  function renderTrustPanel(collection){
    return `<section id="collection-trust" class="vic-section vic-trust"><div class="vic-section-head"><span class="eyebrow">Trust and governance</span><h2>Inspect the conditions behind publication</h2></div><dl>${Object.entries(collection.trust).map(([key,value])=>`<div><dt>${escape(titleCase(key))}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p class="vic-synthetic"><strong>Synthetic disclosure:</strong> ${escape(collection.synthetic_notice)}</p></section>`;
  }

  function relatedScore(current,candidate){
    let score=0;const reasons=[];
    if(current.primary_industry===candidate.primary_industry){score+=5;reasons.push('shared primary industry')}
    const sharedIndustries=candidate.related_industries.filter(item=>[current.primary_industry,...current.related_industries].includes(item));
    if(sharedIndustries.length){score+=sharedIndustries.length*2;reasons.push('related industry evidence')}
    const sharedFrameworks=candidate.frameworks.filter(item=>current.frameworks.includes(item));
    if(sharedFrameworks.length){score+=sharedFrameworks.length;reasons.push('shared framework relevance')}
    if(current.audiences.some(item=>candidate.audiences.includes(item))){score+=1;reasons.push('audience fit')}
    return{score,reason:reasons[0]||'complementary intelligence'};
  }
  function recommendRelated(current,catalog,limit=4){
    const seen=new Set([current.key]);
    return list(catalog).map(item=>({collection:item,...relatedScore(current,item)})).filter(item=>!seen.has(item.collection.key)&&item.score>0&&seen.add(item.collection.key)).sort((a,b)=>b.score-a.score||a.collection.title.localeCompare(b.collection.title)).slice(0,limit);
  }
  function renderRelatedCollections(current,catalog){
    const related=recommendRelated(current,catalog);
    return `<section id="collection-related" class="vic-section"><div class="vic-section-head"><span class="eyebrow">Related intelligence</span><h2>Continue through connected decision questions</h2></div>${related.length?`<div class="vic-card-grid">${related.map(item=>renderCollectionCard(item.collection,{relationship:titleCase(item.reason)})).join('')}</div>`:'<p class="vic-empty">No governed related Collections are available.</p>'}</section>`;
  }

  function renderIndustryShelf(industry,catalog){
    const normalized=text(industry).toLowerCase();
    const matches=list(catalog).map(collection=>({collection,primary:collection.primary_industry.toLowerCase().includes(normalized)||normalized.includes(collection.primary_industry.toLowerCase()),related:collection.related_industries.some(item=>item.toLowerCase().includes(normalized)||normalized.includes(item.toLowerCase()))})).filter(item=>item.primary||item.related).sort((a,b)=>Number(b.primary)-Number(a.primary)||a.collection.title.localeCompare(b.collection.title)).slice(0,8);
    return `<section class="vic-industry-shelf" aria-labelledby="vic-industry-title"><div class="vic-section-head"><span class="eyebrow">Relevant Intelligence Collections</span><h2 id="vic-industry-title">Decision intelligence for ${escape(industry)}</h2><p>${matches.length} governed Collection${matches.length===1?'':'s'} connected through existing industry metadata.</p></div>${matches.length?`<div class="vic-card-grid">${matches.map(item=>renderCollectionCard(item.collection,{relationship:item.primary?'Primary for this industry':'Cross-sector'})).join('')}</div>`:'<p class="vic-empty">No approved Collection relationships are currently available for this industry.</p>'}</section>`;
  }

  function renderCollectionFooter(collection){
    return `<section class="vic-collection-footer"><div><span class="eyebrow">Produced through VoiceInsights Workspace</span><h2>Build a repeatable intelligence capability around your own evidence.</h2><p>Explore how governed collection, analysis, review, publication and institutional learning can operate across your organization.</p><a class="btn btn-primary" href="/contact.html?request=demo">Request a Demonstration</a><a class="btn btn-ghost" href="/contact.html?request=consultation">Book a Consultation</a></div><aside><h3>Cite this Collection</h3><p>${escape(collection.citation)}</p><p><strong>Version:</strong> ${escape(collection.version)}</p>${renderQuickDownload(collection,'Download products')}</aside></section>`;
  }

  global.VIACollections=Object.freeze({
    COMPONENT_CONTRACTS,FORMAT_DEFINITIONS,escape,normalizeCollection,normalizeCanonicalCollection,renderCollectionCard,renderIdentityHeader,renderHero,renderDecisionContext,renderIntelligenceGlance,renderEvidenceOverview,renderAnalysisExperience,renderDecisionOptions,renderProductConstellation,renderQuickDownload,renderTrustPanel,recommendRelated,renderRelatedCollections,renderIndustryShelf,renderCollectionFooter
  });
  if(typeof module!=='undefined')module.exports=global.VIACollections;
})(typeof window!=='undefined'?window:globalThis);
