(()=>{const API=(window.VIA_CONFIG&&window.VIA_CONFIG.API_BASE)||'https://voiceinsights-api.kitentyatsnp.workers.dev';const token=()=>localStorage.getItem('via_token')||localStorage.getItem('token')||'';const msg=t=>document.getElementById('ect-message').textContent=t;const row=(a,b)=>`<div class="ect-row"><span>${a}</span><strong>${b}</strong></div>`;
async function api(path,opts={}){const r=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`,...opts.headers}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||data.message||`Request failed (${r.status})`);return data;}
let lastWorkspace=null;
async function load(){try{const {workspace:w}=await api('/api/enterprise-control/workspace');lastWorkspace=w;document.getElementById('ect-kpis').innerHTML=[['Active Workflows',w.workflow.active],['Pending Approvals',w.workflow.pending_approval],['MFA Coverage',`${w.identity.mfa_coverage_pct}%`],['Consent Coverage',`${w.security.consent_coverage_pct}%`],['SSO Connections',w.identity.sso_active],['SCIM Connections',w.identity.scim_active]].map(([a,b])=>`<article class="ect-card ect-kpi"><strong>${b}</strong><span>${a}</span></article>`).join('');document.getElementById('ect-security').innerHTML=row('API Keys',w.identity.api_keys)+row('Encryption Controls',`${w.security.encryption_controls_pct}%`)+row('Critical Events',w.security.open_critical_events);document.getElementById('ect-compliance').innerHTML=row('SOC 2 Readiness',`${w.compliance.soc2_readiness}%`)+row('ISO Evidence',`${w.compliance.iso_evidence_pct}%`)+row('Procurement Evidence',`${w.compliance.procurement_evidence_pct}%`);document.getElementById('ect-role').innerHTML=Object.entries(w.role_home).slice(0,7).map(([a,b])=>row(a.replaceAll('_',' '),b)).join('');}catch(e){msg(e.message);}}
// Global Certification Phase 2: this button previously POSTed a fixed
// claims payload (iam_rbac/mfa/audit/consent/encryption/secrets all
// hardcoded to "implemented"/"system_verified") on every click, regardless
// of this organization's real state — and the server persists that claim
// permanently to procurement_evidence_runs, attributed to the clicking
// user. Every control below is now derived from the same real workspace
// numbers already rendered on this page: full (100%) coverage maps to a
// real status, partial or zero coverage honestly stays
// "evidence_pending" (buildProcurementEvidenceChecklist's own default —
// never asserted here). Controls this workspace endpoint has no real
// per-organization signal for (iam_rbac, audit, secrets, and the other
// controls in the full 14-item checklist) are intentionally left out of
// this payload so they keep their honest "evidence_pending" default,
// rather than guessed from unrelated code-level facts.
function realProcurementClaims(w){
  const claims={};
  if(w.identity.mfa_coverage_pct>=100) claims.mfa='implemented';
  if(w.security.consent_coverage_pct>=100) claims.consent='system_verified';
  if(w.security.encryption_controls_pct>=100) claims.encryption='implemented';
  if(w.identity.sso_active>0&&w.identity.scim_active>0) claims.sso_scim='implemented';
  return claims;
}
document.getElementById('ect-generate').addEventListener('click',async()=>{try{if(!lastWorkspace){msg('Workspace data has not loaded yet — try again in a moment.');return;}msg('Generating evidence checklist…');const data=await api('/api/enterprise-control/procurement-evidence',{method:'POST',body:JSON.stringify(realProcurementClaims(lastWorkspace))});msg(`Evidence checklist generated: ${data.pack.completion_pct}% complete, based on this organization's real measured state. External verification remains required where stated.`);}catch(e){msg(e.message);}});load();})();
