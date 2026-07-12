const STATES=['FIXED','PARTIALLY_FIXED','NOT_FIXED','REQUIRES_EXTERNAL_VALIDATION']; const arr=v=>Array.isArray(v)?v:[]; const txt=v=>String(v??'').trim();
export function buildIndependentAudit(input={}){
 const findings=arr(input.previous_findings).map((f,i)=>{const state=STATES.includes(f.status)?f.status:'NOT_FIXED'; return {finding_id:txt(f.finding_id||`finding-${i+1}`),title:txt(f.title),previous_severity:txt(f.previous_severity||f.severity),status:state,code_evidence:arr(f.code_evidence),test_evidence:arr(f.test_evidence),deployment_evidence:arr(f.deployment_evidence),remaining_gap:txt(f.remaining_gap),external_validation:state==='REQUIRES_EXTERNAL_VALIDATION'};});
 const dimensions={source_code_readiness:Number(input.source_code_readiness||0),live_production_readiness:Number(input.live_production_readiness||0),enterprise_readiness:Number(input.enterprise_readiness||0),report_quality:Number(input.report_quality||0),methodology:Number(input.methodology||0),evidence_integrity:Number(input.evidence_integrity||0)};
 const invalid=Object.entries(dimensions).filter(([,v])=>v<0||v>100).map(([k])=>k); if(invalid.length)throw new Error(`Invalid score(s): ${invalid.join(', ')}`);
 const unresolved=findings.filter(f=>!['FIXED'].includes(f.status));
 return {audit_version:'v216.0',audit_date:new Date().toISOString(),findings,summary:Object.fromEntries(STATES.map(s=>[s,findings.filter(f=>f.status===s).length])),dimensions,unresolved_count:unresolved.length,verdict:unresolved.some(f=>f.status==='NOT_FIXED')?'BLOCKERS_REMAIN':unresolved.length?'EXTERNAL_OR_PARTIAL_VALIDATION_REQUIRED':'SOURCE_CODE_VERIFIED',disclaimer:'Source-code readiness is not proof of live production readiness. External controls must be independently validated.'};
}
export {STATES};
