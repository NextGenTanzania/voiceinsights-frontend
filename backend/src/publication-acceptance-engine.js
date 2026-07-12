export const PUBLICATION_ACCEPTANCE_STANDARD='VoiceInsights International Publication Acceptance Standard';
const arr=v=>Array.isArray(v)?v:[];
export function evaluatePublicationReadiness(report={}){
 const evidence=arr(report.evidence||report.evidence_traceability), findings=arr(report.findings||report.key_findings), recs=arr(report.recommendations||report.actions), limits=arr(report.limitations);
 const checks={title:Boolean(report.title||report.report_title),executive_summary:Boolean(report.executive_summary||report.summary),findings:findings.length>=1,recommendations:recs.length>=1,methodology:Boolean(report.methodology&&Object.keys(report.methodology).length),limitations:limits.length>=1,evidence:evidence.length>=1,evidence_confidence:evidence.every(e=>Number(e.confidence_score??e.confidence??0)>=0),sample_size:Number(report.sample_size||report.total_responses||report.responses||0)>0};
 const passed=Object.values(checks).filter(Boolean).length,total=Object.keys(checks).length,score=Math.round(passed/total*100);
 return{standard:PUBLICATION_ACCEPTANCE_STANDARD,score,status:score>=90?'PASS':score>=75?'CONDITIONAL_PASS':'BLOCK',checks,blocking_reasons:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k.replace(/_/g,' ')),publication_ready:score>=90};
}
export function buildAcceptanceReport(report={}){const readiness=evaluatePublicationReadiness(report);return{...readiness,acceptance_scope:['Report Library','Audience-specific reports','Evidence Explorer','Quality Gates','AI Assistant','Interactive Reports','Mobile Reader','PDF','PowerPoint','Word','Excel'],tested_at:new Date().toISOString()};}
