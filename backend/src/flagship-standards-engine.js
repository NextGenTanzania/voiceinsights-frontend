const APPLICABILITY=new Set(['APPLICABLE','PARTIALLY_APPLICABLE','CONTEXT_ONLY','NOT_APPLICABLE']);
export function mapFramework({id,name,applicability='APPLICABLE',rationale,criteria=[],evidence_ids=[],indicator_ids=[],finding_ids=[],decision_ids=[],limitations='Synthetic demonstration; no institutional endorsement.',reviewer='VoiceInsights governed demonstration review'}){
 if(!APPLICABILITY.has(applicability))throw new Error('Invalid framework applicability');
 return{framework_id:id,framework_name:name,applicability,rationale,criteria_used:criteria,evidence_ids,indicator_ids,finding_ids,decision_ids,implementation_gaps:[],limitations,validation_status:'INTERNALLY_REVIEWED',reviewer,review_date:new Date().toISOString().slice(0,10),claim_language:'ALIGNED_WITH'};
}
export function standardsFor(model){
 const r=model.report||model,p=model.sample?.profile||r.profile||'research',e=(r.evidence||[]).slice(0,4).map(x=>x.id||x.evidence_id),i=(r.full_publication?.indicators||[]).slice(0,4).map(x=>x.id),f=(r.findings||[]).slice(0,3).map(x=>x.id),d=(r.recommendations||[]).slice(0,3).map(x=>x.id||x.decision_id);
 const common=[mapFramework({id:'DATA_PROTECTION',name:'Data Protection and Privacy Controls',rationale:'The publication uses governed response, evidence and export data.',criteria:['Purpose limitation','Data minimisation','Access control','Retention','Disclosure control'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d})];
 // Global Publication Excellence: every sample already carries real,
 // governed gender/participation data (full_publication.demographics.sex
 // nationally, regional[].women_pct per region) that was never cited as a
 // named framework anywhere — added here, universally, because the real
 // data backing it exists on every sample without exception, unlike most
 // of the framework list this addition was requested alongside (Sendai,
 // Paris Agreement, ESG/ISSB/GRI, STROBE/CONSORT/PRISMA, disability
 // disaggregation) — none of which this governed model has a real field
 // to support, so none of those are added; inventing the citation would be
 // exactly the "framework inserted merely to impress" this engine's own
 // discipline forbids.
 const women=r.full_publication?.demographics?.sex?.find(([label])=>label==='Women')?.[1];
 const regionalWomenPct=(r.full_publication?.regional||[]).map(x=>x.women_pct).filter(Number.isFinite);
 if(Number.isFinite(women)){
  const spread=regionalWomenPct.length>1?Math.max(...regionalWomenPct)-Math.min(...regionalWomenPct):null;
  common.push(mapFramework({id:'GENDER_EQUALITY',name:'Gender Equality (SDG 5)',rationale:`The respondent base is ${women}% women nationally${spread!=null?`, with a real ${spread}-point spread in women's participation share across regions`:''} — findings are read against gender-equitable participation, not assumed even by default.`,criteria:['Participation parity','Regional variation','Disaggregated reporting'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 }
 if(['government','donor','ngo','humanitarian'].includes(p))common.push(mapFramework({id:'RBM',name:'Results-Based Management',rationale:'Findings and recommendations are connected to outputs, outcomes and indicators.',criteria:['Results chain','Indicators','Assumptions','Monitoring'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}),mapFramework({id:'TOC',name:'Theory of Change',rationale:'The report tests causal pathways, assumptions and risks without claiming unsupported attribution.',criteria:['Inputs','Activities','Outputs','Outcomes','Impact','Assumptions'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 if(p==='donor')common.push(mapFramework({id:'OECD_DAC',name:'OECD-DAC Evaluation Criteria',rationale:'The publication evaluates programme relevance, coherence and results.',criteria:['Relevance','Coherence','Effectiveness','Efficiency','Impact','Sustainability'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}),mapFramework({id:'UNEG',name:'UNEG Evaluation Norms and Standards',rationale:'The evaluation product documents credibility, ethics, utility and limitations.',criteria:['Independence','Impartiality','Credibility','Utility','Ethics','Human rights and gender equality'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 if(p==='humanitarian')common.push(mapFramework({id:'CHS',name:'Core Humanitarian Standard',rationale:'The report assesses quality and accountability to crisis-affected people.',criteria:Array.from({length:9},(_,n)=>`Commitment ${n+1}`),evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}),mapFramework({id:'PROTECTION',name:'Protection, Safeguarding and Human Rights Based Approach',rationale:'Severity analysis includes safety, participation, non-discrimination and referral considerations.',criteria:['Do no harm','Participation','Complaints','PSEA','Referral pathways','Inclusion'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 if(['research','statistical','evidence'].includes(p))common.push(mapFramework({id:'REPRODUCIBILITY',name:'Reproducibility and Microdata Governance',rationale:'The publication includes versioned data, methods, disclosure controls and lineage.',criteria:['Dataset version','Instrument version','Analysis plan','Weights','Software','Checksums','Disclosure control'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}),mapFramework({id:'RESEARCH_ETHICS',name:'Research Ethics',rationale:'Evidence collection and publication require consent, minimisation and protection of participants.',criteria:['Consent','Vulnerability','Withdrawal','Harm assessment','Conflict of interest'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 if(['board','corporate','interactive'].includes(p))common.push(mapFramework({id:'RESPONSIBLE_AI',name:'Responsible AI',rationale:'AI-assisted interpretation requires grounding, human review, privacy and limitations.',criteria:['Model provenance','Evidence grounding','Bias review','Human oversight','Override log'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}),mapFramework({id:'ACCESSIBILITY',name:'Accessibility',rationale:'Publications must be readable and operable across formats and assistive technologies.',criteria:['Contrast','Reading order','Alt text','Table headers','Keyboard access'],evidence_ids:e,indicator_ids:i,finding_ids:f,decision_ids:d}));
 return common;
}

