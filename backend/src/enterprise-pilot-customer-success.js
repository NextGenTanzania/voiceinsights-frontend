export const V2109A_VERSION='v210.9A.0';

export function calculateCustomerHealth(input={}){
  const weights={adoption:30,delivery:25,support:15,training:15,engagement:15};
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const components={
    adoption:clamp(input.adoption_score),
    delivery:clamp(input.delivery_score),
    support:clamp(input.support_score),
    training:clamp(input.training_score),
    engagement:clamp(input.engagement_score),
  };
  const score=Math.round(Object.entries(weights).reduce((s,[k,w])=>s+components[k]*w/100,0));
  const risk=score>=85?'low':score>=70?'moderate':score>=50?'high':'critical';
  const renewal_probability=Math.max(5,Math.min(98,Math.round(score*0.9+(input.contract_in_good_standing===false?-20:8))));
  return {score,risk,renewal_probability,components,weights,status:score>=70?'healthy':'attention_required'};
}

export function buildPilotWorkspace({pilots=[],organizations=[],activities=[]}={}){
  const active=pilots.filter(p=>['kickoff','implementation','running','review'].includes(p.status));
  const blocked=pilots.filter(p=>p.risk_level==='high'||p.risk_level==='critical'||p.status==='blocked');
  const closingSoon=active.filter(p=>p.end_date && (new Date(p.end_date)-Date.now())/86400000<=14);
  return {
    version:V2109A_VERSION,
    module:'Pilot Management Center',
    metrics:{total:pilots.length,active:active.length,blocked:blocked.length,closing_soon:closingSoon.length,organizations:organizations.length},
    pilots,
    recent_activity:activities.slice(0,20),
    stages:['approved','kickoff','implementation','running','review','closed','expansion'],
    health_rules:['adoption','delivery','support','training','engagement']
  };
}

export function buildCustomerSuccessWorkspace({organizations=[],pilots=[],usage=[],tickets=[],training=[]}={}){
  const orgRows=organizations.map(org=>{
    const orgUsage=usage.filter(x=>x.organization_id===org.id);
    const orgTickets=tickets.filter(x=>x.organization_id===org.id);
    const orgTraining=training.filter(x=>x.organization_id===org.id);
    const activePilot=pilots.find(x=>x.organization_id===org.id && !['closed','cancelled'].includes(x.status));
    const adoption=Math.min(100,orgUsage.reduce((s,x)=>s+Number(x.adoption_score||0),0)/(orgUsage.length||1));
    const delivery=activePilot?Number(activePilot.delivery_score||75):70;
    const support=Math.max(0,100-orgTickets.filter(x=>['open','escalated'].includes(x.status)).length*12);
    const trainingScore=orgTraining.length?orgTraining.reduce((s,x)=>s+Number(x.progress_pct||0),0)/orgTraining.length:50;
    const engagement=Number(org.engagement_score||70);
    const health=calculateCustomerHealth({adoption_score:adoption,delivery_score:delivery,support_score:support,training_score:trainingScore,engagement_score:engagement,contract_in_good_standing:org.contract_status!=='overdue'});
    return {organization_id:org.id,organization_name:org.name||org.id,health,active_pilot:activePilot||null,open_tickets:orgTickets.filter(x=>x.status!=='closed').length,training_completion:Math.round(trainingScore),adoption_score:Math.round(adoption)};
  });
  return {version:V2109A_VERSION,module:'Customer Success Workspace',organizations:orgRows,summary:{healthy:orgRows.filter(x=>x.health.risk==='low').length,at_risk:orgRows.filter(x=>['high','critical'].includes(x.health.risk)).length,average_health:orgRows.length?Math.round(orgRows.reduce((s,x)=>s+x.health.score,0)/orgRows.length):0}};
}

export function buildFounderCustomerSuccessAdditions({pilots=[],organizations=[],approvals=[],renewals=[]}={}){
  const revenueForecast=pilots.reduce((s,p)=>s+Number(p.contract_value||0),0);
  return {pending_pilot_approvals:approvals.filter(a=>a.status==='pending').length,active_pilots:pilots.filter(p=>['kickoff','implementation','running','review'].includes(p.status)).length,organizations:organizations.length,revenue_forecast:revenueForecast,at_risk_customers:organizations.filter(o=>o.health_risk==='high'||o.health_risk==='critical').length,upcoming_renewals:renewals.filter(r=>r.status==='upcoming').length};
}

export function buildOperationsCustomerSuccessAdditions({pilots=[],meetings=[],tasks=[],tickets=[]}={}){
  return {pending_kickoffs:pilots.filter(p=>p.status==='approved').length,active_pilots:pilots.filter(p=>['kickoff','implementation','running','review'].includes(p.status)).length,meetings_today:meetings.filter(m=>String(m.date||'').slice(0,10)===new Date().toISOString().slice(0,10)).length,open_tasks:tasks.filter(t=>t.status!=='done').length,open_tickets:tickets.filter(t=>!['closed','resolved'].includes(t.status)).length,high_risk_pilots:pilots.filter(p=>['high','critical'].includes(p.risk_level)).length};
}

export function validatePilot(input={}){
  const required=['organization_id','name','start_date','end_date','owner_id'];
  const missing=required.filter(k=>!input[k]);
  if(missing.length)return {ok:false,error:`Missing required fields: ${missing.join(', ')}`};
  if(new Date(input.end_date)<=new Date(input.start_date))return {ok:false,error:'end_date must be after start_date'};
  return {ok:true,pilot:{...input,status:input.status||'approved',risk_level:input.risk_level||'low',success_criteria:Array.isArray(input.success_criteria)?input.success_criteria:[]}};
}
