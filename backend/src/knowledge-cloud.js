// VoiceInsights v210.5 — Knowledge Cloud
// Organization-scoped search across reports, evidence, recommendations and lessons learned.

export const KNOWLEDGE_CLOUD_V2105_VERSION = 'v210.5.0';

function text(v){return String(v ?? '').trim();}
function arr(v){return Array.isArray(v)?v:[];}
function tokens(q){return text(q).toLowerCase().split(/\s+/).filter(Boolean);}
function scoreItem(item, q){
  const hay=[item.title,item.summary,item.content,item.sector,item.country,item.type,...arr(item.tags)].join(' ').toLowerCase();
  const ts=tokens(q); if(!ts.length)return 0;
  return ts.reduce((s,t)=>s+(hay.includes(t)?1:0),0)/ts.length;
}

export function buildKnowledgeRecord(input={}){
  return {
    id: input.id || `knowledge_${crypto.randomUUID()}`,
    organization_id: input.organization_id || null,
    project_id: input.project_id || null,
    report_id: input.report_id || null,
    type: input.type || 'knowledge_note',
    title: text(input.title) || 'Untitled knowledge item',
    summary: text(input.summary),
    content: text(input.content),
    sector: text(input.sector) || 'cross-sector',
    country: text(input.country) || 'Not specified',
    tags: arr(input.tags).map(text).filter(Boolean),
    source_type: input.source_type || 'manual',
    source_reference: input.source_reference || null,
    evidence_classification: input.evidence_classification || 'organization knowledge',
    confidence_score: Math.max(0, Math.min(100, Number(input.confidence_score ?? 80))),
    visibility: input.visibility || 'organization',
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  };
}

export function buildKnowledgeSearch(records=[], query='', filters={}){
  const q=text(query);
  const filtered=arr(records).filter(r=>
    (!filters.type || r.type===filters.type) &&
    (!filters.sector || r.sector===filters.sector) &&
    (!filters.project_id || r.project_id===filters.project_id) &&
    (!filters.report_id || r.report_id===filters.report_id)
  ).map(r=>({...r,relevance_score:q?scoreItem(r,q):1}))
    .filter(r=>!q || r.relevance_score>0)
    .sort((a,b)=>b.relevance_score-a.relevance_score || String(b.updated_at).localeCompare(String(a.updated_at)));
  return {query:q,total:filtered.length,results:filtered};
}

export function buildOrganizationKnowledge(records=[]){
  const rs=arr(records);
  const types={}; rs.forEach(r=>types[r.type]=(types[r.type]||0)+1);
  const sectors=[...new Set(rs.map(r=>r.sector).filter(Boolean))];
  return {
    total_items: rs.length,
    previous_reports: rs.filter(r=>r.type==='report').length,
    recommendations: rs.filter(r=>r.type==='recommendation').length,
    lessons_learned: rs.filter(r=>r.type==='lesson').length,
    evidence_items: rs.filter(r=>r.type==='evidence').length,
    sectors,
    types,
    recent: [...rs].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,8),
  };
}

export function extractKnowledgeFromReport(report={}){
  const now=new Date().toISOString();
  const base={organization_id:report.organization_id,project_id:report.project_id,report_id:report.id,sector:report.sector,country:report.country,source_type:'report',source_reference:report.id,created_at:now,updated_at:now};
  const out=[buildKnowledgeRecord({...base,type:'report',title:report.title||report.report_title||'Previous report',summary:report.executive_summary||report.summary||'',content:report.executive_summary||report.summary||'',confidence_score:report.confidence_score||85})];
  arr(report.recommendations||report.actions).forEach((x,i)=>out.push(buildKnowledgeRecord({...base,type:'recommendation',title:`Recommendation ${i+1}`,summary:typeof x==='string'?x:(x.recommendation||x.action||x.title||''),content:JSON.stringify(x),confidence_score:x.confidence_score||80}))); 
  arr(report.lessons_learned||report.lessons).forEach((x,i)=>out.push(buildKnowledgeRecord({...base,type:'lesson',title:`Lesson learned ${i+1}`,summary:typeof x==='string'?x:(x.lesson||x.title||''),content:JSON.stringify(x),confidence_score:x.confidence_score||80})));
  arr(report.evidence||report.evidence_traceability).forEach((x,i)=>out.push(buildKnowledgeRecord({...base,type:'evidence',title:x.claim||x.title||`Evidence ${i+1}`,summary:x.claim||x.finding||'',content:JSON.stringify(x),evidence_classification:x.evidence_classification||x.evidence_type||'report-model evidence',confidence_score:x.confidence_score||80})));
  return out;
}

export function buildKnowledgeCloudWorkspace(records=[]){
  return {
    version: KNOWLEDGE_CLOUD_V2105_VERSION,
    label: 'VoiceInsights Knowledge Cloud™',
    mission: 'Preserve institutional memory across reports, evidence, recommendations and lessons learned.',
    capabilities: ['Knowledge Search','Previous Reports','Organization Knowledge','Recommendations','Lessons Learned','Evidence Search'],
    overview: buildOrganizationKnowledge(records),
    search_contract: {filters:['type','sector','project_id','report_id'],sort:['relevance','recent'],tenant_isolation:true},
    governance: {organization_scoped:true,raw_respondent_data_excluded_by_default:true,evidence_classification_required:true,audit_searches:true},
  };
}
