// VoiceInsights Africa Enterprise Release 4(v216)
// Deterministic international research standards validation. Fails closed.
export const STANDARD_STATUS = Object.freeze({ PASS:'PASS', PARTIAL:'PARTIAL', FAIL:'FAIL', EXTERNAL:'REQUIRES_EXTERNAL_VALIDATION' });
const arr=v=>Array.isArray(v)?v:[]; const txt=v=>String(v??'').trim(); const num=v=>Number.isFinite(Number(v))?Number(v):null;
const present=v=>Array.isArray(v)?v.length>0:(typeof v==='object'&&v!==null?Object.keys(v).length>0:txt(v).length>0);
const result=(name,checks,external=[])=>{ const failed=checks.filter(x=>!x.ok); const score=Math.round((checks.filter(x=>x.ok).length/Math.max(1,checks.length))*100); return {name,status:failed.length===0?(external.length?STANDARD_STATUS.EXTERNAL:STANDARD_STATUS.PASS):(score>=60?STANDARD_STATUS.PARTIAL:STANDARD_STATUS.FAIL),score,checks,failures:failed.map(x=>x.requirement),external_validation:external}; };
const check=(requirement,value,evidence_ids=[])=>({requirement,ok:present(value),evidence_ids:arr(evidence_ids),value_present:present(value)});

export function validateResearchMethodology(m={}){
 const sampling=m.sampling||{}; const quality=m.quality||{}; const metadata=m.metadata||{};
 const checks=[
  check('research objectives',m.research_objectives,m.research_objective_evidence_ids),check('evaluation questions',m.evaluation_questions),check('sampling frame',sampling.frame),
  check('sample size calculation',sampling.sample_size_calculation),check('stratification',sampling.stratification),check('weights',sampling.weights),
  check('confidence intervals',sampling.confidence_intervals),check('design effect',sampling.design_effect),check('missing data treatment',quality.missing_data),
  check('reliability assessment',quality.reliability),check('validity assessment',quality.validity),check('limitations',m.limitations),check('metadata',metadata)
 ];
 const errors=[]; const size=num(sampling.achieved_sample_size); if(size!==null&&size<1)errors.push('achieved_sample_size must be positive');
 const confidence=num(sampling.confidence_level); if(confidence!==null&&(confidence<=0||confidence>=100))errors.push('confidence_level must be between 0 and 100');
 const base=result('Research Methodology',checks); return {...base,errors,publication_eligible:base.score===100&&errors.length===0};
}

export const OECD_DAC_CRITERIA=['relevance','coherence','effectiveness','efficiency','impact','sustainability'];
export function validateOecdDac(input={}){
 const criteria=OECD_DAC_CRITERIA.map(name=>{const c=input[name]||{}; const evidence=arr(c.evidence_ids); const ok=present(c.assessment)&&evidence.length>0; return {criterion:name,assessment:txt(c.assessment),evidence_ids:evidence,confidence:num(c.confidence),limitations:arr(c.limitations),status:ok?'EVIDENCE_VERIFIED':'INSUFFICIENT_EVIDENCE'};});
 const score=Math.round(criteria.filter(c=>c.status==='EVIDENCE_VERIFIED').length/criteria.length*100); return {standard:'OECD-DAC',criteria,score,status:score===100?'PASS':score>=50?'PARTIAL':'FAIL',publication_eligible:score===100};
}

export function validateResultsFramework(rbm={}){
 const chain=['inputs','activities','outputs','outcomes','impact']; const checks=chain.map(k=>check(k,rbm[k]));
 checks.push(check('indicators',rbm.indicators),check('means of verification',rbm.means_of_verification),check('risks',rbm.risks),check('assumptions',rbm.assumptions));
 const indicatorIssues=arr(rbm.indicators).flatMap((i,n)=>['name','baseline','target','source','frequency'].filter(k=>!present(i[k])).map(k=>`indicators[${n}].${k}`));
 const base=result('Results-Based Management',checks); return {...base,indicator_issues:indicatorIssues,publication_eligible:base.score===100&&indicatorIssues.length===0};
}

export function validateSdgAlignment(input={}){
 const contributions=arr(input.contributions).map((c,i)=>({index:i,goal:txt(c.goal),target:txt(c.target),indicator:txt(c.indicator),programme_contribution:txt(c.programme_contribution),evidence_ids:arr(c.evidence_ids),limitations:arr(c.limitations),status:present(c.goal)&&present(c.target)&&present(c.indicator)&&present(c.programme_contribution)&&arr(c.evidence_ids).length?'VERIFIED':'INSUFFICIENT_EVIDENCE'}));
 const verified=contributions.filter(c=>c.status==='VERIFIED').length; const score=contributions.length?Math.round(verified/contributions.length*100):0; return {standard:'SDG',contributions,score,status:score===100?'PASS':score>=50?'PARTIAL':'FAIL',publication_eligible:contributions.length>0&&score===100};
}

export function validateUneg(input={}){
 const checks=[check('evaluation matrix',input.evaluation_matrix),check('ethics',input.ethics),check('independence',input.independence),check('recommendations',input.recommendations),check('management response',input.management_response),check('disclosure',input.disclosure)];
 const recommendations=arr(input.recommendations); const unsupported=recommendations.filter(r=>!arr(r.evidence_ids).length).map((_,i)=>i);
 const base=result('UNEG',checks,['Evaluator independence and ethics compliance require human/external assurance']); return {...base,unsupported_recommendation_indexes:unsupported,publication_eligible:base.score===100&&unsupported.length===0};
}

export function validateWorldBankStatistics(input={}){
 const checks=[check('sampling documentation',input.sampling),check('weighting methodology',input.weighting),check('uncertainty estimates',input.uncertainty),check('reproducibility package',input.reproducibility),check('metadata',input.metadata),check('microdata governance',input.microdata_governance)];
 const repro=input.reproducibility||{}; const reproducible=present(repro.code_version)&&present(repro.dataset_version)&&present(repro.seed)&&present(repro.software);
 const governance=input.microdata_governance||{}; const governed=present(governance.access_classification)&&present(governance.deidentification)&&present(governance.retention)&&present(governance.disclosure_control);
 const base=result('World Bank Statistical Standards',checks,['Independent replication and disclosure-risk review']); return {...base,reproducible,microdata_governed:governed,publication_eligible:base.score===100&&reproducible&&governed};
}

export function validatePublicationQuality(report={}){
 const checks=['methodology','limitations','confidence','citations','data_dictionary','appendices','quality_statement'].map(k=>check(k,report[k]));
 const citations=arr(report.citations); const invalidCitations=citations.filter(c=>!present(c.evidence_id)||!present(c.source));
 const base=result('Publication Quality',checks); return {...base,invalid_citations:invalidCitations.length,publication_eligible:base.score===100&&invalidCitations.length===0};
}

export function evaluateInternationalStandards(input={}){
 const components={methodology:validateResearchMethodology(input.methodology),oecd_dac:validateOecdDac(input.oecd_dac),rbm:validateResultsFramework(input.rbm),sdg:validateSdgAlignment(input.sdg),uneg:validateUneg(input.uneg),world_bank_statistics:validateWorldBankStatistics(input.world_bank_statistics),publication_quality:validatePublicationQuality(input.publication)};
 const weights={methodology:20,oecd_dac:15,rbm:15,sdg:10,uneg:15,world_bank_statistics:15,publication_quality:10};
 const score=Math.round(Object.entries(components).reduce((s,[k,v])=>s+v.score*weights[k]/100,0));
 const blockers=Object.entries(components).filter(([,v])=>!v.publication_eligible).map(([k,v])=>({component:k,status:v.status,failures:v.failures||[],score:v.score}));
 const assurancePassed=input.ai_assurance?.publication_allowed===true||input.ai_assurance?.publication_gate?.publication_allowed===true;
 if(!assurancePassed)blockers.unshift({component:'ai_assurance',status:'FAIL',failures:['AI assurance publication gate has not passed'],score:0});
 return {standards_version:'v216.0',score,status:blockers.length?'BLOCKED':'PASS',publication_allowed:blockers.length===0,components,blockers,external_validation_required:['Independent methodology review','Live production controls verification','Procurement/legal review']};
}
