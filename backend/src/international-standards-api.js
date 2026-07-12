import { requireAuth, json } from './utils.js';
import { evaluateInternationalStandards } from './international-research-standards.js';
import { generateProcurementPack } from './procurement-readiness.js';
import { buildIndependentAudit } from './independent-audit.js';
const roles=new Set(['super_admin','founder','org_admin','me_officer','data_analyst','report_reviewer']); const id=p=>`${p}_${crypto.randomUUID()}`;
const orgFor=(request,c)=>{const requested=request.headers.get('x-organization-id'); return requested&&['super_admin','founder'].includes(c.role)?requested:(c.organization_id||c.org_id);};
export async function handleInternationalStandardsRoute(request,env){
 const url=new URL(request.url), path=url.pathname, method=request.method;
 if(!path.startsWith('/api/standards/v216')&&!path.startsWith('/api/procurement/v216')&&!path.startsWith('/api/audit/v216'))return null;
 const claims=await requireAuth(request,env); if(!roles.has(claims.role))return json({error:'International standards permission required'},403); const orgId=orgFor(request,claims); if(!orgId)return json({error:'Organization context required'},400);
 if(path==='/api/standards/evaluate'&&method==='POST'){
  const body=await request.json().catch(()=>null); if(!body?.report_id)return json({error:'report_id is required'},400); const out=evaluateInternationalStandards(body); const run=id('isr'),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO international_standards_runs(id,organization_id,report_id,standards_version,score,status,publication_allowed,components_json,blockers_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(run,orgId,body.report_id,'v216.0',out.score,out.status,out.publication_allowed?1:0,JSON.stringify(out.components),JSON.stringify(out.blockers),claims.sub,now).run();
  return json({...out,run_id:run},out.publication_allowed?200:422,{'Cache-Control':'no-store'});
 }
 if(path==='/api/procurement/generate'&&method==='POST'){
  const body=await request.json().catch(()=>({})); const out=generateProcurementPack({...body,organization_id:orgId}); const packId=id('prp'),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO procurement_readiness_packs(id,organization_id,score,status,packs_json,blockers_json,generated_by,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(packId,orgId,out.score,out.status,JSON.stringify(out.packs),JSON.stringify(out.blockers),claims.sub,now).run(); return json({...out,pack_id:packId},out.status==='READY'?200:422);
 }
 if(path==='/api/audit/run'&&method==='POST'){
  if(!['super_admin','founder','org_admin','report_reviewer'].includes(claims.role))return json({error:'Audit reviewer permission required'},403); const body=await request.json().catch(()=>({})); const out=buildIndependentAudit(body); const auditId=id('aud'),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO independent_audits(id,organization_id,audit_version,verdict,dimensions_json,summary_json,findings_json,auditor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(auditId,orgId,'v216.0',out.verdict,JSON.stringify(out.dimensions),JSON.stringify(out.summary),JSON.stringify(out.findings),claims.sub,now).run(); return json({...out,audit_id:auditId},200);
 }
 const runMatch=path.match(/^\/api\/standards\/v216\/runs\/([^/]+)$/); if(runMatch&&method==='GET'){const row=await env.DB.prepare('SELECT * FROM international_standards_runs WHERE id=? AND organization_id=?').bind(runMatch[1],orgId).first(); if(!row)return json({error:'Not found'},404); return json({...row,components:JSON.parse(row.components_json||'{}'),blockers:JSON.parse(row.blockers_json||'[]')},200);}
 return json({error:'Not found'},404);
}
