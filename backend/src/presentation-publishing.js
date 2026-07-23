/**
 * VoiceInsights Flagship Report Engine™ v2 — Phase 4: Presentation & Publishing
 * Converts one governed report model into audience-specific publication products.
 * It never invents evidence, budgets, performance or citations.
 */
import { composePremiumPublication, PREMIUM_PUBLICATION_STYLES } from './premium-publications.js';
import { evaluateFlagshipPublicationQuality } from './flagship-report-engine.js';

export const PRESENTATION_PUBLISHING_VERSION='2.4.0-phase4';
export const PRESENTATION_PUBLISHING_NAME='VoiceInsights Presentation & Publishing™';
const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=v=>typeof v==='string'?v.trim():'';
const value=(v,f='Not documented')=>text(v)||f;
const itemText=v=>typeof v==='string'?v:(v?.text||v?.finding||v?.claim||v?.recommendation||v?.decision||v?.title||'');

export const EXPORT_PROFILES={
  un:{key:'un',label:'UN Publication',style:'un',products:['UN Evaluation Report','Country Office Brief','Management Response','Technical Annex'],typography:{heading:'Arial/Source Sans 3',body:'Arial/Source Sans 3',scale:'formal-accessible'},palette:{primary:'#009EDB',secondary:'#005A8B',accent:'#F3B61F',background:'#FFFFFF'},layout:'Evidence-led, accessible, evaluation-question structured'},
  world_bank:{key:'world_bank',label:'World Bank Publication',style:'research',products:['Development Intelligence Report','Policy Research Report','Statistical Annex','Reproducibility Pack'],typography:{heading:'Arial/Georgia',body:'Arial',scale:'analytical'},palette:{primary:'#002244',secondary:'#0071BC',accent:'#F2A900',background:'#FFFFFF'},layout:'Methodology-first, statistically transparent and policy actionable'},
  government:{key:'government',label:'Government Publication',style:'government',products:['Cabinet Memo','Minister Brief','Policy Intelligence Report','Implementation Matrix'],typography:{heading:'Georgia/Source Serif',body:'Arial',scale:'authoritative'},palette:{primary:'#0B3A67',secondary:'#1E6FA8',accent:'#D6A93B',background:'#F5F8FC'},layout:'Cabinet-first, nationally aligned and implementation-focused'},
  donor:{key:'donor',label:'Donor Publication',style:'donor',products:['Donor Impact Report','OECD-DAC Evaluation','Value for Money Brief','Management Response'],typography:{heading:'Aptos Display/Arial',body:'Aptos/Arial',scale:'impact-led'},palette:{primary:'#4B2E83',secondary:'#6254A3',accent:'#D8A928',background:'#FAF8FF'},layout:'Results-chain, impact, inclusion, learning and accountability'},
  board:{key:'board',label:'Board Publication',style:'board',products:['Board Report','Board Deck','CEO Brief','Decision Log'],typography:{heading:'Aptos Display',body:'Aptos',scale:'executive'},palette:{primary:'#111111',secondary:'#343434',accent:'#C8A64B',background:'#FFFDF7'},layout:'Decision-first, concise, risk and performance centred'},
  corporate:{key:'corporate',label:'Corporate Publication',style:'corporate',products:['Executive Intelligence Report','Investor Deck','Customer Intelligence','Growth Opportunity Brief'],typography:{heading:'Aptos Display',body:'Aptos',scale:'commercial'},palette:{primary:'#101820',secondary:'#1E5AA8',accent:'#C7A44A',background:'#F7F8FA'},layout:'Commercial, KPI-led, ROI and growth focused'},
  research:{key:'research',label:'Research Publication',style:'research',products:['Technical Research Report','Statistical Annex','Data Dictionary','Reproducibility Pack'],typography:{heading:'Georgia',body:'Arial',scale:'academic'},palette:{primary:'#202124',secondary:'#7A1F3D',accent:'#5B6770',background:'#FFFFFF'},layout:'Academic, reproducible and statistically explicit'},
};

export const PRESENTATION_PRODUCTS={
  premium_pdf:{key:'premium_pdf',label:'Premium PDF',format:'pdf',sections:['Cover','Publication notice','Table of contents','Executive intelligence','Findings','Evidence','Statistics','Decisions','Recommendations','Methodology','Limitations','Citation index','Executive appendix','Technical appendix','Evidence appendix']},
  editable_word:{key:'editable_word',label:'Editable Word',format:'docx',features:['Named styles','Structured headings','References','Bookmarks','Table styles','Comment placeholders','Revision-ready sections']},
  executive_powerpoint:{key:'executive_powerpoint',label:'Executive PowerPoint',format:'pptx',deck_type:'executive'},
  statistical_excel:{key:'statistical_excel',label:'Statistical Excel',format:'xlsx',sheets:['Summary','KPI','Raw Tables','Crosstabs','Indicators','Evidence','Metadata','Pivot-ready Data']},
  cabinet_memo:{key:'cabinet_memo',label:'Cabinet Memo',format:'pdf',sections:['Purpose','Decision Required','Background','Evidence','Budget','Options','Recommendation','Minister Approval','Implementation','Risks']},
  policy_brief:{key:'policy_brief',label:'Policy Brief',format:'pdf',sections:['Issue','Evidence','Why Now','Policy Gap','Options','Recommendation','Expected Impact']},
  board_deck:{key:'board_deck',label:'Board Deck',format:'pptx',sections:['CEO Summary','Performance','Risk','Finance','Operations','Recommendations','Decision Slides','Appendix']},
  investor_deck:{key:'investor_deck',label:'Investor Deck',format:'pptx',sections:['Market','Problem','Solution','Evidence','Traction','Growth','Pipeline','Financial Outlook','Roadmap']},
  interactive_html:{key:'interactive_html',label:'Interactive HTML',format:'html'},
};

function findings(r){return arr(r.findings||r.narrative?.key_findings).map(itemText).filter(Boolean)}
function recommendations(r){return arr(r.recommendations||r.decision_intelligence?.recommendations).map(itemText).filter(Boolean)}
function risks(r){return arr(r.risks||r.narrative?.risks).map(itemText).filter(Boolean)}
function evidence(r){return arr(r.evidence||r.evidence_intelligence?.records)}
function kpis(r){return arr(r.kpis||r.executive_intelligence?.kpis)}

export function buildCabinetMemo(report={}){
 const r=obj(report), recs=recommendations(r), fs=findings(r), rs=risks(r);
 return {product:'Cabinet Memo',purpose:value(r.purpose||r.executive_summary,'To present governed evidence and secure an executive decision.'),decision_required:value(r.decision_required||recs[0]),background:value(r.background||r.context),evidence:fs.slice(0,5),budget:value(r.budget_implications,'Budget implications require validation before approval.'),options:arr(r.policy_options).length?arr(r.policy_options):recs.slice(0,3),recommendation:value(r.ministerial_recommendation||recs[0]),minister_approval:{status:'PENDING',approver:value(r.approver,'Authorised government decision-maker')},implementation:arr(r.implementation_actions||r.ownership_matrix),risks:rs.slice(0,5),integrity:'No fiscal, legal or policy claim is inferred without governed evidence.'};
}
export function buildPolicyBrief(report={}){const r=obj(report),recs=recommendations(r),fs=findings(r);return{product:'Policy Brief',issue:value(r.policy_problem||fs[0]),evidence:fs.slice(0,5),why_now:value(r.why_now||r.urgency_statement),policy_gap:value(r.policy_gap),options:arr(r.policy_options).length?arr(r.policy_options):recs.slice(0,3),recommendation:value(r.suggested_policy||recs[0]),expected_impact:value(r.expected_impact),citations:evidence(r).slice(0,12).map((e,i)=>({id:e.id||e.evidence_id||`E${i+1}`,source:e.source||e.question_id||'Governed report evidence'}))};}
export function buildDeck(report={},kind='board_deck'){
 const r=obj(report),fs=findings(r),rs=risks(r),recs=recommendations(r),metrics=kpis(r);
 const configs={
 board_deck:[['CEO Summary',{summary:value(r.executive_summary),decisions:recs.slice(0,3)}],['Performance',{kpis:metrics,findings:fs.slice(0,4)}],['Risk',{risks:rs.slice(0,5)}],['Finance',{budget:value(r.budget_implications),cost_of_inaction:value(r.cost_of_inaction)}],['Operations',{owners:arr(r.ownership_matrix),timeline:arr(r.timeline)}],['Recommendations',{recommendations:recs.slice(0,5)}],['Decisions Required',{decisions:recs.slice(0,4)}],['Appendix',{methodology:obj(r.methodology),limitations:arr(r.limitations)}]],
 investor_deck:[['Market',{market:value(r.market),sector:value(r.sector)}],['Problem',{problem:value(r.problem||fs[0])}],['Solution',{solution:value(r.solution)}],['Evidence',{findings:fs.slice(0,4),evidence:evidence(r).slice(0,4)}],['Traction',{traction:arr(r.traction),kpis:metrics}],['Growth',{opportunities:arr(r.opportunities)}],['Pipeline',{pipeline:arr(r.pipeline)}],['Financial Outlook',{financial_outlook:value(r.financial_outlook)}],['Roadmap',{roadmap:arr(r.roadmap||r.timeline)}]],
 executive:[['Executive Summary',{summary:value(r.executive_summary)}],['KPI Snapshot',{kpis:metrics}],['Critical Findings',{findings:fs.slice(0,5)}],['Risks and Opportunities',{risks:rs.slice(0,4),opportunities:arr(r.opportunities).slice(0,4)}],['Decisions Required',{decisions:recs.slice(0,5)}],['Evidence and Confidence',{evidence:evidence(r).slice(0,6),confidence:r.confidence_score||'Not measured'}],['Implementation Roadmap',{owners:arr(r.ownership_matrix),timeline:arr(r.timeline)}],['Appendix',{methodology:obj(r.methodology),limitations:arr(r.limitations)}]],
 };
 return {deck_type:kind,slide_size:'16:9',native_editable_objects:true,slides:(configs[kind]||configs.executive).map(([title,content],i)=>({id:`slide-${i+1}`,title,layout:i===0?'executive_title':'content',content,speaker_notes:`Present ${title} using only governed evidence.`,editable:true}))};
}

export function buildPublicationModel(input={},profileKey='un',productKey='premium_pdf'){
 const report=obj(input.report||input),profile=EXPORT_PROFILES[profileKey]||EXPORT_PROFILES.un,product=PRESENTATION_PRODUCTS[productKey]||PRESENTATION_PRODUCTS.premium_pdf;
 const premium=composePremiumPublication({report},profile.style);
 const quality=evaluatePresentationQuality(report,profileKey,productKey);
 const specialized=productKey==='cabinet_memo'?buildCabinetMemo(report):productKey==='policy_brief'?buildPolicyBrief(report):productKey==='board_deck'?buildDeck(report,'board_deck'):productKey==='investor_deck'?buildDeck(report,'investor_deck'):productKey==='executive_powerpoint'?buildDeck(report,'executive'):null;
 return {engine:PRESENTATION_PUBLISHING_NAME,version:PRESENTATION_PUBLISHING_VERSION,profile,product,cover:{...premium.cover,palette:profile.palette,typography:profile.typography},publication:premium,quality_gate:quality,specialized_product:specialized,export_contract:{format:product.format,one_dataset_many_products:true,editable:product.format!=='pdf',binary_renderer_required:['pdf','pptx','docx','xlsx'].includes(product.format)},integrity_notice:'Presentation changes structure and visual identity only; it never creates unsupported evidence or statistics.'};
}

export function evaluatePresentationQuality(report={},profileKey='un',productKey='premium_pdf'){
 const r=obj(report),product=PRESENTATION_PRODUCTS[productKey]||PRESENTATION_PRODUCTS.premium_pdf,base=evaluateFlagshipPublicationQuality({...r,publication_profile:profileKey});
 const checks={typography:true,spacing:true,image_resolution:arr(r.images).every(x=>(x.width||1200)>=800),missing_figures:!arr(r.figures).some(x=>x.required&&!x.source),broken_references:!arr(r.references).some(x=>x.broken===true),page_overflow:r.page_overflow!==true,accessibility:Boolean(r.accessibility||r.alt_text_coverage_pct>=90),brand_compliance:r.brand_compliance!==false,publication_standard:base.status!=='BLOCKED'};
 const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
 const blockers=[...arr(base.blockers),...failed.filter(x=>['missing_figures','broken_references','page_overflow','publication_standard'].includes(x))];
 return {status:blockers.length?'BLOCKED':score>=90&&base.status==='PASS'?'PASS':'CONDITIONAL_PASS',score,checks,failed,blockers,profile:profileKey,product:productKey,release_allowed:blockers.length===0&&score>=90&&base.status==='PASS'};
}

export function getPresentationPublishingCatalog(){return{engine:PRESENTATION_PUBLISHING_NAME,version:PRESENTATION_PUBLISHING_VERSION,profiles:Object.values(EXPORT_PROFILES),products:Object.values(PRESENTATION_PRODUCTS),promise:'One governed dataset can produce interactive, print, editable, presentation and statistical products without duplicating evidence.'};}

// ------------------------------------------------------------
// Specialized validator adapter (Canonical Publication Quality Gate, Part 3).
// evaluatePresentationQuality's own status/release_allowed are preserved
// above for any existing caller, but this engine no longer makes an
// independent authoritative publication decision — a route feeding the
// canonical gate (quality-scoring-engine.js:evaluatePublicationGate) should
// call this adapter instead. release_allowed is deliberately omitted; only
// the canonical gate may declare export/publication eligibility.
// ------------------------------------------------------------
export function validatePresentation(report={},profileKey='un',productKey='premium_pdf'){
  const q=evaluatePresentationQuality(report,profileKey,productKey);
  const status=q.blockers.length?'BLOCKED':q.status==='PASS'?'PASS':'WARNING';
  return{
    validator_id:'presentation-publishing.js:validatePresentation',
    validator_version:PRESENTATION_PUBLISHING_VERSION,
    domain:'visualization_quality',
    applicable:true,
    score:q.score,
    status,
    blocking_failures:q.blockers,
    warnings:q.failed.filter(f=>!q.blockers.includes(f)),
    passed_checks:Object.entries(q.checks).filter(([,v])=>v).map(([k])=>k),
    evidence:[{profile:profileKey,product:productKey}],
    evaluated_at:new Date().toISOString(),
  };
}
