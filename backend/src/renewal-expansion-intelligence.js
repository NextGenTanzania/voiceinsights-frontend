export const V2109C_VERSION='v210.9C.0';
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const daysBetween=(a,b)=>Math.ceil((new Date(b)-new Date(a))/86400000);

export function scoreRenewal({health_score=0,adoption_score=0,sla_score=100,training_score=0,open_critical_tickets=0,days_to_expiry=180}={}){
  let score=health_score*.32+adoption_score*.28+sla_score*.16+training_score*.12+12;
  score-=Math.min(25,Number(open_critical_tickets||0)*8);
  if(days_to_expiry<=30) score-=4; else if(days_to_expiry<=60) score-=2;
  score=clamp(Math.round(score));
  return {score,probability:score>=85?'very_high':score>=70?'high':score>=50?'medium':'low',risk:score>=70?'low':score>=50?'medium':'high'};
}

export function scoreExpansion({adoption_score=0,health_score=0,projects=0,channels_used=0,active_users=0,report_downloads=0}={}){
  const score=clamp(Math.round(adoption_score*.30+health_score*.25+Math.min(20,projects*4)+Math.min(12,channels_used*2.4)+Math.min(8,active_users*.4)+Math.min(5,report_downloads*.25)));
  const opportunities=[];
  if(channels_used<3) opportunities.push({module:'Omni-Channel Expansion',reason:'Increase reach through additional collection channels',priority:'high'});
  if(projects>=2) opportunities.push({module:'Knowledge Cloud',reason:'Convert multiple projects into searchable institutional memory',priority:'medium'});
  if(report_downloads>=5) opportunities.push({module:'Enterprise Reports',reason:'High report demand supports publication and presentation upgrades',priority:'high'});
  if(active_users>=10) opportunities.push({module:'Enterprise IAM & SSO',reason:'Growing team requires stronger identity governance',priority:'medium'});
  if(adoption_score>=75) opportunities.push({module:'Benchmark Cloud',reason:'Strong adoption makes comparative intelligence valuable',priority:'medium'});
  return {score,band:score>=80?'ready_now':score>=60?'qualified':score>=40?'developing':'not_ready',opportunities};
}

export function buildRenewalPipeline({contracts=[],profiles=[],now=new Date().toISOString()}={}){
  const rows=contracts.map(c=>{const p=profiles.find(x=>x.organization_id===c.organization_id)||{};const days_to_expiry=daysBetween(now,c.end_date);const renewal=scoreRenewal({...p,days_to_expiry});return {...c,days_to_expiry,renewal,stage:c.status==='renewed'?'renewed':days_to_expiry<=0?'expired':days_to_expiry<=30?'decision':days_to_expiry<=60?'proposal':days_to_expiry<=90?'engagement':'monitoring',next_action:days_to_expiry<=0?'Escalate expired contract':days_to_expiry<=30?'Complete renewal decision':days_to_expiry<=60?'Send renewal proposal':days_to_expiry<=90?'Schedule renewal meeting':'Monitor adoption and value realization'};});
  return {version:V2109C_VERSION,module:'Renewal Pipeline',metrics:{contracts:rows.length,due_90_days:rows.filter(x=>x.days_to_expiry>=0&&x.days_to_expiry<=90).length,at_risk:rows.filter(x=>x.renewal.risk==='high').length,forecast_value:rows.filter(x=>x.renewal.score>=50).reduce((s,x)=>s+Number(x.value||0),0)},contracts:rows};
}

export function buildExpansionWorkspace({organizations=[],profiles=[],usage=[]}={}){
 const opportunities=organizations.map(o=>{const p=profiles.find(x=>x.organization_id===o.id)||{};const u=usage.filter(x=>x.organization_id===o.id);const channels=new Set(u.map(x=>x.channel).filter(Boolean)).size;const result=scoreExpansion({...p,projects:Number(p.projects||0),channels_used:channels,active_users:Number(p.active_users||0),report_downloads:u.filter(x=>x.event_type==='report.download').length});return {organization_id:o.id,organization_name:o.name||o.id,...result};}).sort((a,b)=>b.score-a.score);
 return {version:V2109C_VERSION,module:'Expansion Opportunities',metrics:{organizations:organizations.length,ready_now:opportunities.filter(x=>x.band==='ready_now').length,qualified:opportunities.filter(x=>x.band==='qualified').length,total_recommendations:opportunities.reduce((s,x)=>s+x.opportunities.length,0)},opportunities};
}

export function buildExecutiveForecast({renewals=[],expansion=[],currency='USD'}={}){
 const renewal_weighted=renewals.reduce((s,x)=>s+Number(x.value||0)*(Number(x.renewal?.score||0)/100),0);
 const expansion_weighted=expansion.reduce((s,x)=>s+Number(x.estimated_value||0)*(Number(x.score||0)/100),0);
 const confidence=clamp(Math.round((renewals.length?78:55)+(renewals.length+expansion.length>5?8:0)));
 return {version:V2109C_VERSION,currency,renewal_weighted:Math.round(renewal_weighted),expansion_weighted:Math.round(expansion_weighted),total_forecast:Math.round(renewal_weighted+expansion_weighted),confidence,forecast_band:confidence>=80?'high_confidence':confidence>=65?'moderate_confidence':'early_signal'};
}

export function answerCustomerSuccessQuestion({question='',renewals=[],expansion=[],profiles=[]}={}){
 const q=String(question).toLowerCase();
 if(q.includes('risk')){const atRisk=renewals.filter(x=>x.renewal?.risk==='high');return {intent:'risk',answer:`${atRisk.length} renewal account(s) are currently high risk.`,items:atRisk.slice(0,10)};}
 if(q.includes('expire')||q.includes('renew')){const due=renewals.filter(x=>x.days_to_expiry>=0&&x.days_to_expiry<=90);return {intent:'renewal',answer:`${due.length} contract(s) require renewal attention within 90 days.`,items:due.slice(0,10)};}
 if(q.includes('expand')||q.includes('upsell')){const ready=expansion.filter(x=>['ready_now','qualified'].includes(x.band));return {intent:'expansion',answer:`${ready.length} organization(s) show expansion potential.`,items:ready.slice(0,10)};}
 const low=profiles.filter(x=>Number(x.adoption_score||0)<60);return {intent:'summary',answer:`Customer Success summary: ${renewals.length} renewal records, ${expansion.length} expansion assessments, and ${low.length} low-adoption organization(s).`,items:low.slice(0,10)};
}

export function buildUnifiedCustomerSuccessDashboard({pilots=[],organizations=[],profiles=[],tickets=[],training=[],usage=[],contracts=[]}={}){
 const renewal=buildRenewalPipeline({contracts,profiles});
 const expansion=buildExpansionWorkspace({organizations,profiles,usage});
 const forecast=buildExecutiveForecast({renewals:renewal.contracts,expansion:expansion.opportunities.map(x=>({...x,estimated_value:0}))});
 return {version:V2109C_VERSION,product:'Enterprise Pilot & Customer Success Platform',metrics:{organizations:organizations.length,active_pilots:pilots.filter(x=>!['closed','completed'].includes(x.status)).length,average_health:profiles.length?Math.round(profiles.reduce((s,x)=>s+Number(x.health_score||0),0)/profiles.length):0,open_tickets:tickets.filter(x=>!['resolved','closed'].includes(x.status)).length,training_completion:training.length?Math.round(training.reduce((s,x)=>s+Number(x.progress_pct||0),0)/training.length):0,renewals_due_90_days:renewal.metrics.due_90_days,expansion_ready:expansion.metrics.ready_now},renewal,expansion,forecast,alerts:[...renewal.contracts.filter(x=>x.renewal.risk==='high').map(x=>({type:'renewal_risk',organization_id:x.organization_id,message:`Renewal risk: ${x.name||x.id}`})),...tickets.filter(x=>x.priority==='critical'&&!['resolved','closed'].includes(x.status)).map(x=>({type:'critical_support',organization_id:x.organization_id,message:x.subject}))]};
}
