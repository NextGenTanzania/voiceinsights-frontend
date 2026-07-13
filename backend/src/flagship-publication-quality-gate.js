const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
export function evaluateFlagshipPublication(model,{human_reviewed=false,export_checks={}}={}){
 const r=model.report||model,visuals=r.visualizations||[],frameworks=r.framework_applicability||[],evidence=r.evidence||[],findings=r.findings||[],decisions=r.recommendations||[];
 const missingEvidence=findings.filter(x=>!(x.evidence_ids||[]).length).length;
 const contradictionCount=Number(r.assurance?.contradictions||0);
 const components={
  completeness:clamp([r.executive_book,r.statistical_intelligence,r.methodology,r.limitations?.length,r.appendices?.length].filter(Boolean).length/5*100),
  evidence_traceability:clamp((evidence.length&&missingEvidence===0?100:Math.max(0,70-missingEvidence*20))),
  statistical_integrity:clamp(Object.keys(r.statistical_intelligence||{}).length>=12?95:65),
  contradiction_free:contradictionCount===0?100:0,
  recommendation_strength:clamp(decisions.filter(x=>x.owner&&x.timeline&&x.monitoring_indicator&&(x.evidence_used||[]).length).length/Math.max(1,decisions.length)*100),
  visual_quality:clamp(visuals.filter(x=>x.quality_status==='VERIFIED'&&x.alt_text&&x.interpretation).length/Math.max(1,visuals.length)*100),
  storytelling:clamp(r.executive_summary&&findings.every(x=>x.text)?90:60),
  accessibility:clamp(r.accessibility?.wcag_target&&visuals.every(x=>x.alt_text)?95:55),
  framework_applicability:clamp(frameworks.filter(x=>x.rationale&&x.evidence_ids?.length&&x.claim_language==='ALIGNED_WITH').length/Math.max(1,frameworks.length)*100),
  export_consistency:clamp(['pdf','docx','pptx','xlsx'].filter(x=>export_checks[x]?.passed).length/4*100),
  human_review:human_reviewed?100:0,
 };
 const weights={completeness:10,evidence_traceability:15,statistical_integrity:15,contradiction_free:10,recommendation_strength:10,visual_quality:10,storytelling:8,accessibility:8,framework_applicability:6,export_consistency:5,human_review:3};
 const overall=clamp(Object.entries(weights).reduce((s,[k,w])=>s+components[k]*w,0)/100);
 const blockers=[];if(missingEvidence)blockers.push('MISSING_EVIDENCE');if(contradictionCount)blockers.push('CONTRADICTION');if(components.visual_quality<80)blockers.push('VISUAL_QA');if(components.export_consistency<100)blockers.push('EXPORT_QA');if(!human_reviewed)blockers.push('HUMAN_REVIEW');
 let status='DEMONSTRATION_READY';if(blockers.includes('MISSING_EVIDENCE')||blockers.includes('CONTRADICTION'))status='BLOCKED';else if(blockers.includes('VISUAL_QA')||blockers.includes('EXPORT_QA'))status='TECHNICAL_REVIEW_REQUIRED';else if(blockers.includes('HUMAN_REVIEW'))status='HUMAN_REVIEW_REQUIRED';else if(overall>=90)status='PUBLICATION_READY';
 return{status,overall,components,weights,blockers,score_basis:'Weighted evidence, statistical, visual, accessibility, export and human-review rules; never a field-count marketing score.',synthetic_status:'DEMONSTRATION_READY'};
}

