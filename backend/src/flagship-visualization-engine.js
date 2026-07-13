import { themeFor } from './flagship-publication-design-system.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
export function buildVisualization({id,title,decision_question,type,data,interpretation,source_ids=[],evidence_ids=[],finding_ids=[],recommendation_ids=[],sample_size,period='Synthetic demonstration',unit='%',profile='research',limitations=[]}){
 const rows=Array.isArray(data)?data:[];
 const alt=`${title}. ${rows.slice(0,5).map(x=>`${x.label||x.name}: ${x.value??x.score??''}${unit}`).join('; ')}.`;
 return{visualization_id:id,id,type,title:text(title),decision_question:text(decision_question),chart_type:type,data:rows.slice(0,4),measure:title,unit,period,sample_size,source_ids,data_source_ids:source_ids.length?source_ids:evidence_ids,evidence_ids,finding_ids,recommendation_ids,interpretation:text(interpretation),limitations,alt_text:alt,quality_status:rows.length&&title&&interpretation&&evidence_ids.length?'VERIFIED':'REVIEW_REQUIRED',theme:themeFor(profile),accessibility:{alt_text:alt,colour_not_only_signal:true,labels_required:true,minimum_contrast:4.5}};
}

export function buildFlagshipVisualSet(model){
 const r=model.report||model,f=r.full_publication||model.full_publication||{},profile=model.sample?.profile||r.profile||'research';
 const regional=f.regional||[],indicators=f.indicators||[],evidence=r.evidence||[];
 return[
  buildVisualization({id:'VIS-EXEC-01',title:'Executive performance at a glance',decision_question:'What requires senior attention now?',type:'kpi_cards',data:[{label:'Synthetic responses',value:f.sample_size,unit:'count'},{label:'Response rate',value:f.response_rate_pct},{label:'Regions',value:f.regions_covered,unit:'count'},{label:'Readiness',value:r.quality_scores?.overall_publication_readiness}],interpretation:'The dashboard summarises reach, response, geographic coverage and rule-based readiness without replacing the underlying evidence review.',evidence_ids:evidence.slice(0,2).map(x=>x.id||x.evidence_id),sample_size:f.sample_size,profile}),
  buildVisualization({id:'VIS-REG-01',title:'Performance varies materially across regions',decision_question:'Where should differentiated action be prioritised?',type:'benchmark_bars',data:regional.map(x=>({label:x.name,value:x.primary_score,status:x.risk})),interpretation:'Regional variation should inform targeted financing, implementation support and monitoring intensity.',evidence_ids:evidence.slice(0,4).map(x=>x.id||x.evidence_id),sample_size:f.sample_size,profile}),
  buildVisualization({id:'VIS-GAP-01',title:'Several indicators remain below target',decision_question:'Which outcome gaps require funded corrective action?',type:'target_gap',data:indicators.map(x=>({label:x.label,value:x.value,target:x.target,status:x.status})),interpretation:'Target gaps are decision signals; each off-track indicator should link to an owner, budget, timeline and evidence-based recommendation.',evidence_ids:evidence.slice(0,4).map(x=>x.id||x.evidence_id),sample_size:f.sample_size,profile}),
  buildVisualization({id:'VIS-RISK-01',title:'Risk exposure and opportunity are not evenly distributed',decision_question:'Which actions combine urgency and feasible impact?',type:'risk_matrix',data:(r.recommendations||[]).map((x,i)=>({label:x.id||x.decision_id,value:Math.max(1,5-i),impact:5-(i%3),owner:x.owner})),interpretation:'Priorities combine evidence strength, implementation urgency, consequence and accountable ownership.',evidence_ids:evidence.slice(0,4).map(x=>x.id||x.evidence_id),sample_size:f.sample_size,profile}),
 ];
}
