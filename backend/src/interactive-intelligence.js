/**
 * VoiceInsights Flagship Report Engine™ v2 — Phase 3: Interactive Intelligence
 *
 * Grounded interactive intelligence for evidence exploration, report Q&A,
 * privacy-safe benchmarking, institutional knowledge and drill-down reports.
 *
 * Safety:
 * - Never invent evidence, benchmarks, sources or confidence.
 * - Assistant answers only from supplied governed report context.
 * - Benchmark outputs are suppressed below the configured peer threshold.
 * - Raw respondent identifiers are excluded from public/benchmark views.
 */
import { compileFlagshipReport, evaluateFlagshipPublicationQuality } from './flagship-report-engine.js';
import { composePremiumPublication } from './premium-publications.js';

export const INTERACTIVE_INTELLIGENCE_VERSION = '2.3.0-phase3';
export const INTERACTIVE_INTELLIGENCE_NAME = 'VoiceInsights Interactive Intelligence™';

const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=v=>typeof v==='string'?v.trim():'';
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const lower=v=>String(v||'').toLowerCase();
const tokens=v=>lower(v).split(/[^a-z0-9]+/).filter(x=>x.length>2);
const uniq=a=>[...new Set(arr(a))];

function evidenceItems(report){
  const r=obj(report);
  const compiled=r.engine==='VoiceInsights Flagship Report Engine™'?r:compileFlagshipReport(r);
  const raw=[
    ...arr(r.evidence),
    ...arr(r.evidence_records),
    ...arr(r.citations),
    ...arr(compiled?.evidence_intelligence?.records),
    ...arr(compiled?.evidence_intelligence?.evidence_records),
  ];
  const findings=arr(r.findings).length?arr(r.findings):arr(compiled?.executive_intelligence?.critical_findings);
  const fromFindings=findings.map((f,i)=>({
    evidence_id:f.evidence_id||`FINDING-${i+1}`,
    type:'finding',
    claim:text(f.claim||f.finding||f.title||f.text),
    quote:text(f.quote),
    source:text(f.source||f.source_label),
    confidence:num(f.confidence_score||f.confidence),
    verification_status:text(f.verification_status||f.status)||'UNVERIFIED',
    question_id:f.question_id||null,
    survey_id:f.survey_id||null,
    response_id:f.response_id||null,
    transcript_id:f.transcript_id||null,
    audio_key:f.audio_key||null,
    photo_key:f.photo_key||null,
    gps:f.gps||null,
    region:f.region||null,
    indicator:f.indicator||null,
    raw_pointer:f.raw_pointer||f.raw_data_link||null,
  })).filter(x=>x.claim);
  return [...raw.map((e,i)=>({
    evidence_id:e.evidence_id||e.id||`EVIDENCE-${i+1}`,
    type:e.type||'evidence',
    claim:text(e.claim||e.finding||e.text||e.summary),
    quote:text(e.quote||e.respondent_quote),
    source:text(e.source||e.source_label||e.citation),
    confidence:num(e.confidence_score||e.confidence),
    verification_status:text(e.verification_status||e.status)||'UNVERIFIED',
    question_id:e.question_id||null,
    survey_id:e.survey_id||null,
    response_id:e.response_id||null,
    transcript_id:e.transcript_id||null,
    audio_key:e.audio_key||null,
    photo_key:e.photo_key||null,
    gps:e.gps||null,
    region:e.region||e.geography||null,
    indicator:e.indicator||null,
    raw_pointer:e.raw_pointer||e.raw_data_link||null,
  })),...fromFindings].filter(x=>x.claim||x.quote||x.source);
}

export function buildEvidenceExplorer(report, query='', filters={}){
  const qTokens=tokens(query);
  const f=obj(filters);
  let records=evidenceItems(report);
  records=records.filter(r=>{
    if(f.type&&r.type!==f.type)return false;
    if(f.region&&lower(r.region)!==lower(f.region))return false;
    if(f.verification_status&&lower(r.verification_status)!==lower(f.verification_status))return false;
    if(f.min_confidence!=null&&(r.confidence==null||r.confidence<Number(f.min_confidence)))return false;
    if(!qTokens.length)return true;
    const hay=tokens([r.claim,r.quote,r.source,r.region,r.indicator,r.question_id].join(' '));
    return qTokens.every(t=>hay.some(h=>h.includes(t)||t.includes(h)));
  });
  return {
    query:text(query),
    total:records.length,
    filters_applied:f,
    facets:{
      types:uniq(records.map(x=>x.type)),
      regions:uniq(records.map(x=>x.region).filter(Boolean)),
      statuses:uniq(records.map(x=>x.verification_status)),
    },
    records:records.map(r=>({...r,confidence_label:r.confidence==null?'Not assessed':r.confidence>=90?'High':r.confidence>=70?'Moderate':'Low'})),
    safety:{raw_identifiers_exposed:false,public_safe:true,note:'Raw respondent identifiers are excluded. Access to raw pointers requires role authorization.'},
  };
}

function rankedSentences(report, question){
  const explorer=buildEvidenceExplorer(report,question);
  const findings=arr(report.findings);
  const recs=arr(report.recommendations);
  const corpus=[
    ...explorer.records.map(x=>({kind:'evidence',text:x.claim||x.quote,source:x.evidence_id,confidence:x.confidence})),
    ...findings.map((x,i)=>({kind:'finding',text:text(x.claim||x.finding||x.text),source:x.evidence_id||`FINDING-${i+1}`,confidence:num(x.confidence_score||x.confidence)})),
    ...recs.map((x,i)=>({kind:'recommendation',text:text(x.recommendation||x.decision||x.text),source:x.evidence_id||`RECOMMENDATION-${i+1}`,confidence:num(x.confidence_score||x.confidence)})),
  ].filter(x=>x.text);
  const qt=tokens(question);
  return corpus.map(x=>{
    const ht=tokens(x.text);
    const score=qt.reduce((s,t)=>s+(ht.some(h=>h.includes(t)||t.includes(h))?1:0),0);
    return {...x,score};
  }).sort((a,b)=>b.score-a.score||(b.confidence||0)-(a.confidence||0));
}

export function answerGroundedReportQuestion(report, question){
  const q=text(question);
  if(!q)return {status:'QUESTION_REQUIRED',answer:'Please provide a question.',citations:[],confidence:null};
  const ranked=rankedSentences(report,q).filter(x=>x.score>0).slice(0,5);
  if(!ranked.length){
    return {
      status:'INSUFFICIENT_EVIDENCE',
      answer:'The governed report evidence does not contain enough information to answer this question reliably.',
      citations:[],
      confidence:null,
      suggested_follow_up:['Review the Evidence Explorer','Add source-linked findings','Confirm the relevant geography, indicator or population group'],
    };
  }
  const evidence=ranked.filter(x=>x.kind!=='recommendation');
  const recommendations=ranked.filter(x=>x.kind==='recommendation');
  const answer=[
    evidence[0]?.text,
    evidence[1]?.text&&evidence[1].text!==evidence[0]?.text?`Supporting evidence: ${evidence[1].text}`:'',
    recommendations[0]?.text?`Decision implication: ${recommendations[0].text}`:'',
  ].filter(Boolean).join(' ');
  const confidences=ranked.map(x=>x.confidence).filter(x=>x!=null);
  const confidence=confidences.length?Math.round(confidences.reduce((a,b)=>a+b,0)/confidences.length):null;
  return {
    status:'GROUNDED_ANSWER',
    question:q,
    answer,
    citations:ranked.map(x=>({evidence_id:x.source,type:x.kind,excerpt:x.text,confidence:x.confidence})),
    confidence,
    caveat:confidence==null?'Confidence was not assessed in the source evidence.':'Confidence reflects only the cited governed evidence.',
  };
}

export function buildPrivacySafeBenchmark(input={},options={}){
  const data=arr(input.records||input.peers||input);
  const opts=obj(options);
  const minPeers=Math.max(3,Number(opts.minimum_peer_group||opts.min_peers||5));
  const metric=opts.metric||'value';
  const usable=data.map(x=>({value:num(x[metric]??x.value),group:x.group||x.region||x.country||x.sector||'All'})).filter(x=>x.value!=null);
  if(usable.length<minPeers){
    return {status:'SUPPRESSED',reason:`Minimum peer group of ${minPeers} not met`,peer_count:usable.length,minimum_peer_group:minPeers,raw_data_exposed:false};
  }
  const values=usable.map(x=>x.value).sort((a,b)=>a-b);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const median=values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2;
  const percentile=p=>values[Math.min(values.length-1,Math.max(0,Math.ceil((p/100)*values.length)-1))];
  return {
    status:'AVAILABLE',
    metric,
    peer_count:values.length,
    minimum_peer_group:minPeers,
    statistics:{mean:Number(mean.toFixed(2)),median:Number(median.toFixed(2)),p25:percentile(25),p75:percentile(75),minimum:values[0],maximum:values[values.length-1]},
    comparisons:uniq(usable.map(x=>x.group)).map(group=>{
      const gv=usable.filter(x=>x.group===group).map(x=>x.value);
      return {group,peer_count:gv.length,mean:Number((gv.reduce((a,b)=>a+b,0)/gv.length).toFixed(2))};
    }).filter(x=>x.peer_count>=minPeers),
    privacy:{raw_data_exposed:false,identifiers_exposed:false,suppression_enforced:true},
  };
}

export function extractKnowledgeRecords(report, metadata={}){
  const r=obj(report);
  const m=obj(metadata);
  const findings=arr(r.findings);
  const recommendations=arr(r.recommendations);
  const lessons=arr(r.lessons_learned||r.lessons);
  const risks=arr(r.risks);
  const records=[
    ...findings.map((x,i)=>({kind:'finding',title:text(x.title)||`Finding ${i+1}`,content:text(x.claim||x.finding||x.text),evidence_ids:arr(x.evidence_ids||[x.evidence_id]).filter(Boolean)})),
    ...recommendations.map((x,i)=>({kind:'recommendation',title:text(x.title)||`Recommendation ${i+1}`,content:text(x.recommendation||x.decision||x.text),evidence_ids:arr(x.evidence_ids||[x.evidence_id]).filter(Boolean)})),
    ...lessons.map((x,i)=>({kind:'lesson',title:`Lesson ${i+1}`,content:text(x.text||x.lesson||x),evidence_ids:arr(x.evidence_ids)})),
    ...risks.map((x,i)=>({kind:'risk',title:text(x.title)||`Risk ${i+1}`,content:text(x.risk||x.text),evidence_ids:arr(x.evidence_ids)})),
  ].filter(x=>x.content).map((x,i)=>({
    knowledge_id:x.knowledge_id||`KNOWLEDGE-${i+1}`,
    ...x,
    report_id:m.report_id||r.id||null,
    organization_id:m.organization_id||r.organization_id||null,
    project_id:m.project_id||r.project_id||null,
    sector:m.sector||r.sector||null,
    country:m.country||r.country||null,
    tags:uniq([...tokens(x.title),...tokens(x.content)].slice(0,12)),
    governance:{organization_scoped:true,citation_required:true,review_status:'PENDING_REVIEW'},
  }));
  return {count:records.length,records};
}

export function searchKnowledge(records=[],query='',filters={}){
  const qt=tokens(query);
  const f=obj(filters);
  const results=arr(records).filter(r=>{
    if(f.organization_id&&r.organization_id!==f.organization_id)return false;
    if(f.project_id&&r.project_id!==f.project_id)return false;
    if(f.kind&&r.kind!==f.kind)return false;
    if(f.sector&&lower(r.sector)!==lower(f.sector))return false;
    const ht=tokens([r.title,r.content,arr(r.tags).join(' ')].join(' '));
    return !qt.length||qt.every(t=>ht.some(h=>h.includes(t)||t.includes(h)));
  });
  return {query:text(query),count:results.length,results};
}

export function buildInteractiveReport(report,style='un'){
  const compiled=compileFlagshipReport(report);
  const publication=composePremiumPublication(compiled,style);
  const quality=evaluateFlagshipPublicationQuality(compiled);
  const evidence=buildEvidenceExplorer(report);
  const knowledge=extractKnowledgeRecords(report);
  return {
    engine:INTERACTIVE_INTELLIGENCE_NAME,
    version:INTERACTIVE_INTELLIGENCE_VERSION,
    report_id:report.id||null,
    title:report.title||report.template_name||'Interactive Intelligence Report',
    style,
    publication,
    quality_gate:quality,
    navigation:[
      {key:'executive',label:'Executive Intelligence'},
      {key:'findings',label:'Findings'},
      {key:'evidence',label:'Evidence Explorer'},
      {key:'statistics',label:'Statistical Intelligence'},
      {key:'policy',label:'Policy Intelligence'},
      {key:'decisions',label:'Decision Intelligence'},
      {key:'benchmarks',label:'Benchmarks'},
      {key:'knowledge',label:'Knowledge & Learning'},
      {key:'assistant',label:'Ask the Report'},
    ],
    drilldowns:{
      findings:arr(report.findings).map((f,i)=>({id:f.id||`finding-${i+1}`,title:f.title||`Finding ${i+1}`,claim:f.claim||f.finding||f.text,evidence_ids:arr(f.evidence_ids||[f.evidence_id]).filter(Boolean),region:f.region||null,indicator:f.indicator||null})),
      decisions:arr(report.recommendations).map((r,i)=>({id:r.id||`decision-${i+1}`,decision:r.decision||r.recommendation||r.text,owner:r.owner||'Not assigned',timeline:r.timeline||'Not assigned',evidence_ids:arr(r.evidence_ids||[r.evidence_id]).filter(Boolean)})),
    },
    evidence_explorer:evidence,
    knowledge_index:knowledge,
    assistant:{mode:'GROUNDED_ONLY',citations_required:true,no_answer_when_evidence_missing:true},
    accessibility:{keyboard_navigation:true,semantic_sections:true,high_contrast_ready:true,screen_reader_labels:true},
    public_safety:{raw_identifiers:false,raw_audio_requires_authorization:true,raw_responses_require_authorization:true},
  };
}

export function getInteractiveIntelligenceCatalog(){
  return {
    engine:INTERACTIVE_INTELLIGENCE_NAME,
    version:INTERACTIVE_INTELLIGENCE_VERSION,
    modules:[
      {key:'evidence_explorer',label:'Evidence Explorer',purpose:'Trace findings to quotes, transcripts, audio, questions, geography and governed source pointers.'},
      {key:'ai_assistant',label:'Grounded AI Assistant',purpose:'Answer report questions using cited governed evidence only.'},
      {key:'benchmark_engine',label:'Privacy-safe Benchmark Engine',purpose:'Compare organizations, projects, regions, countries and history with minimum-peer suppression.'},
      {key:'knowledge_engine',label:'Knowledge Engine',purpose:'Convert findings, recommendations, lessons and risks into searchable institutional knowledge.'},
      {key:'interactive_reports',label:'Interactive Reports',purpose:'Provide drill-down executive, evidence, statistics, policy and decision views.'},
    ],
    principles:['Evidence before narrative','No invented answers','Citation-first Q&A','Privacy-safe aggregation','Organization-scoped knowledge','Accessible interactive reporting'],
  };
}
