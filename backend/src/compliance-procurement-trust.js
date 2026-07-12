// VoiceInsights Compliance & Procurement Trust
// Customer-facing product label intentionally excludes internal release numbers.

export const COMPLIANCE_DOMAINS = [
  { key: 'security', label: 'Security', weight: 25 },
  { key: 'availability', label: 'Availability', weight: 20 },
  { key: 'confidentiality', label: 'Confidentiality', weight: 20 },
  { key: 'processing_integrity', label: 'Processing Integrity', weight: 20 },
  { key: 'privacy', label: 'Privacy', weight: 15 },
];

export const ISO_FRAMEWORKS = [
  { id: 'ISO_27001', name: 'ISO/IEC 27001', purpose: 'Information security management', certification_claim: false },
  { id: 'ISO_22301', name: 'ISO 22301', purpose: 'Business continuity management', certification_claim: false },
  { id: 'ISO_9001', name: 'ISO 9001', purpose: 'Quality management', certification_claim: false },
  { id: 'ISO_27701', name: 'ISO/IEC 27701', purpose: 'Privacy information management', certification_claim: false },
];

export function normalizeControlStatus(status='evidence_pending') {
  const allowed=['implemented','partially_implemented','documented','evidence_pending','external_verification_required'];
  return allowed.includes(status) ? status : 'evidence_pending';
}

export function buildSoc2Readiness(input={}) {
  const controls=input.controls||[];
  const domains=COMPLIANCE_DOMAINS.map(domain=>{
    const rows=controls.filter(c=>(c.domain||'').toLowerCase()===domain.key);
    const score=rows.length ? Math.round(rows.reduce((sum,c)=>sum+Number(c.score||0),0)/rows.length) : 0;
    return { ...domain, score, evidence_count: rows.reduce((n,c)=>n+Number(c.evidence_count||0),0), missing_controls: rows.filter(c=>normalizeControlStatus(c.status)!=='implemented').length };
  });
  const weighted=Math.round(domains.reduce((sum,d)=>sum+d.score*d.weight,0)/100);
  return { label:'SOC 2 Readiness & Evidence Center', certified:false, certification_note:'Readiness reporting only. External audit and attestation are required before any SOC 2 certification claim.', overall_score:weighted, domains };
}

export function buildIsoPack(controls=[]) {
  return { label:'ISO Control Mapping Pack', certification_claim:false, frameworks:ISO_FRAMEWORKS.map(f=>({ ...f, controls:controls.filter(c=>c.framework===f.id).map(c=>({ ...c, status:normalizeControlStatus(c.status) })) })) };
}

export function buildEvidenceRecord(input={}) {
  return {
    id: input.id || `evidence_${crypto.randomUUID()}`,
    category: input.category || 'security_control',
    title: input.title || 'Control evidence',
    source: input.source || 'VoiceInsights system evidence',
    owner: input.owner || 'Security & Compliance',
    verification_status: input.verification_status || 'system_verified',
    classification: input.classification || 'internal_confidential',
    generated_at: input.generated_at || new Date().toISOString(),
    expires_at: input.expires_at || null,
    reference: input.reference || null,
    metadata: input.metadata || {},
  };
}

export function buildCompliancePack(input={}) {
  const soc2=buildSoc2Readiness(input);
  const iso=buildIsoPack(input.iso_controls||[]);
  const evidence=(input.evidence||[]).map(buildEvidenceRecord);
  const sections=[
    'Security Overview','Privacy Overview','IAM and RBAC Matrix','MFA Coverage','SSO and SCIM Status','Encryption Overview','Consent Management Summary','Audit Coverage','Backup and Recovery Summary','Incident Response Summary','Data Retention Statement','Subprocessor Register','Business Continuity Summary','SLA Summary','Known Gaps and Roadmap'
  ];
  return { label:'Procurement Compliance Pack', generated_at:new Date().toISOString(), organization_id:input.organization_id||null, sections, soc2_readiness:soc2, iso_mapping:iso, evidence_registry:evidence, disclaimer:'This pack distinguishes implemented controls, documented controls, system evidence and external verification requirements. It does not claim external certification unless a valid certificate is attached.' };
}

export function buildProcurementReadiness(input={}) {
  const soc2=buildSoc2Readiness(input);
  const documentation=Math.max(0,Math.min(100,Number(input.documentation_score||0)));
  const evidence=Math.max(0,Math.min(100,Number(input.evidence_score||0)));
  const security=Math.max(0,Math.min(100,Number(input.security_score||0)));
  const score=Math.round((soc2.overall_score+documentation+evidence+security)/4);
  return { label:'Procurement Readiness', score, status: score>=90?'ready_for_enterprise_review':score>=75?'pilot_ready':'remediation_required', dimensions:{soc2:soc2.overall_score,documentation,evidence,security}, external_verification_required:true };
}
