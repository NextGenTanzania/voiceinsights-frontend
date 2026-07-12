export const V2109B_VERSION='v210.9B.0';

const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));

export function calculateSlaStatus({priority='medium',created_at,first_response_at,resolved_at,now=new Date().toISOString()}={}){
  const targets={critical:{response:1,resolution:4},high:{response:4,resolution:12},medium:{response:8,resolution:48},low:{response:24,resolution:120}};
  const t=targets[priority]||targets.medium; const start=new Date(created_at||now).getTime(); const end=new Date(now).getTime();
  const elapsed=Math.max(0,(end-start)/3600000);
  const responseHours=first_response_at?Math.max(0,(new Date(first_response_at)-start)/3600000):elapsed;
  const resolutionHours=resolved_at?Math.max(0,(new Date(resolved_at)-start)/3600000):elapsed;
  return {priority,target_first_response_hours:t.response,target_resolution_hours:t.resolution,response_hours:Number(responseHours.toFixed(2)),resolution_hours:Number(resolutionHours.toFixed(2)),response_breached:!first_response_at&&elapsed>t.response,resolution_breached:!resolved_at&&elapsed>t.resolution,status:resolved_at?'resolved':elapsed>t.resolution?'breached':elapsed>t.response?'at_risk':'on_track'};
}

export function buildTrainingWorkspace({courses=[],enrollments=[],certifications=[]}={}){
  const avg=enrollments.length?Math.round(enrollments.reduce((s,x)=>s+clamp(x.progress_pct),0)/enrollments.length):0;
  return {version:V2109B_VERSION,module:'Training & Certification Center',metrics:{courses:courses.length,enrollments:enrollments.length,average_progress:avg,certificates:certifications.length,completed:enrollments.filter(x=>x.status==='completed').length},courses,enrollments,certifications,roles:['operations_manager','org_admin','project_manager','head_of_programs','me_officer','data_analyst','enumerator']};
}

export function buildSupportWorkspace({tickets=[]}={}){
  const enriched=tickets.map(t=>({...t,sla:calculateSlaStatus(t)}));
  return {version:V2109B_VERSION,module:'Support & Ticketing Hub',metrics:{total:enriched.length,open:enriched.filter(x=>!['resolved','closed'].includes(x.status)).length,critical:enriched.filter(x=>x.priority==='critical'&&!['resolved','closed'].includes(x.status)).length,breached:enriched.filter(x=>x.sla.status==='breached').length,at_risk:enriched.filter(x=>x.sla.status==='at_risk').length},tickets:enriched,statuses:['open','assigned','investigating','waiting_customer','resolved','closed'],priorities:['critical','high','medium','low']};
}

export function calculateAdoption({events=[],users=[]}={}){
  const activeUsers=new Set(events.map(e=>e.user_id).filter(Boolean)).size; const totalUsers=users.length||Math.max(activeUsers,1);
  const channels=['phone','whatsapp','sms','web','offline']; const channel_usage=channels.map(channel=>({channel,count:events.filter(e=>String(e.channel||'').toLowerCase()===channel).length}));
  const core=['campaign.launch','survey.create','response.collect','report.generate','report.download']; const adopted=core.filter(f=>events.some(e=>e.event_type===f));
  const adoption_score=Math.round((activeUsers/totalUsers)*45+(adopted.length/core.length)*55);
  return {adoption_score:clamp(adoption_score),active_users:activeUsers,total_users:totalUsers,feature_adoption:{adopted:adopted.length,total:core.length,features:core.map(f=>({feature:f,used:adopted.includes(f)}))},channel_usage,total_events:events.length};
}

export function buildAdoptionWorkspace({events=[],users=[]}={}){
  const a=calculateAdoption({events,users});
  return {version:V2109B_VERSION,module:'Usage & Adoption Analytics',...a,health:a.adoption_score>=80?'strong':a.adoption_score>=60?'developing':'at_risk',recommendations:[a.active_users<a.total_users?'Re-engage inactive users':null,a.feature_adoption.adopted<3?'Schedule role-based product training':null,!a.channel_usage.some(x=>x.count>0)?'Launch first multi-channel campaign':null].filter(Boolean)};
}

export function validateCourse(input={}){const req=['title','audience_role','estimated_minutes'];const missing=req.filter(k=>!input[k]);if(missing.length)return{ok:false,error:`Missing required fields: ${missing.join(', ')}`};return{ok:true,course:{...input,status:input.status||'active',modules:Array.isArray(input.modules)?input.modules:[]}}}
export function validateTicket(input={}){const req=['subject','description','priority'];const missing=req.filter(k=>!input[k]);if(missing.length)return{ok:false,error:`Missing required fields: ${missing.join(', ')}`};if(!['critical','high','medium','low'].includes(input.priority))return{ok:false,error:'Invalid priority'};return{ok:true,ticket:{...input,status:input.status||'open'}}}
export function validateUsageEvent(input={}){if(!input.event_type)return{ok:false,error:'event_type is required'};return{ok:true,event:{...input,channel:input.channel||'web'}}}
