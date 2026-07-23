(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const array=value=>Array.isArray(value)?value:[];
  const number=value=>Number.isFinite(Number(value))?Number(value):null;
  const display=value=>number(value)===null?'Unavailable':new Intl.NumberFormat().format(number(value));
  const status=value=>String(value||'unknown').toLowerCase();

  function eventEnvelope(input,index=0){
    return {
      event_id:input.event_id||input.id||`visible-event-${index}`,
      timestamp:input.timestamp||input.created_at||input.updated_at||null,
      actor:input.actor||input.actor_name||'Authorized platform service',
      organization:input.organization||input.organization_id||'Current scope',
      project:input.project||input.project_id||null,
      role:input.role||input.actor_role||null,
      module:input.module||input.type||'Workspace',
      status:input.status||input.workflow_state||'recorded',
      severity:input.severity||'information',
      related_object:input.related_object||input.object_id||input.product_id||null,
      timeline_reference:input.timeline_reference||input.correlation_id||null,
      audit_reference:input.audit_reference||input.audit_id||null,
      title:input.title||input.event_type||input.message||'Enterprise activity recorded'
    };
  }

  function timelineFrom(data){
    const authoritative=array(data.timeline?.events||data.timeline?.timeline||data.timeline);
    if(authoritative.length)return authoritative.map(eventEnvelope);
    const notifications=array(data.notifications).map((item,index)=>eventEnvelope(item,index));
    const products=array(data.products).map((item,index)=>eventEnvelope({
      ...item,
      event_id:`product-${item.product_id||index}`,
      title:`${item.title||'Intelligence product'} · ${item.workflow_state||item.approval_state||'visible'}`,
      module:'Intelligence Products',
      related_object:item.product_id,
      severity:/withdrawn|failed/i.test(item.workflow_state||'')?'warning':'information'
    },index));
    return [...notifications,...products].sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||''))).slice(0,30);
  }

  const metricCard=(label,value,detail,tone='neutral')=>`<article class="ew-enterprise-card ew-metric-card" data-tone="${esc(tone)}" tabindex="0"><span>${esc(label)}</span><strong>${esc(display(value))}</strong><small>${esc(detail)}</small></article>`;
  const statusCard=(label,value,detail)=>`<article class="ew-enterprise-card ew-status-card" data-health="${esc(status(value))}" tabindex="0"><span class="ew-status-dot" aria-hidden="true"></span><div><h3>${esc(label)}</h3><p>${esc(value||'Unavailable')} · ${esc(detail)}</p></div></article>`;
  const activityCard=event=>`<article class="ew-enterprise-card ew-activity-card"><time datetime="${esc(event.timestamp||'')}">${esc(event.timestamp?new Date(event.timestamp).toLocaleString():'Time unavailable')}</time><h3>${esc(event.title)}</h3><p>${esc(event.module)} · ${esc(event.organization)}${event.project?` · ${esc(event.project)}`:''}</p><div><span>${esc(event.status)}</span><span>${esc(event.severity)}</span>${event.related_object?`<span>${esc(event.related_object)}</span>`:''}</div></article>`;
  const riskCard=(title,detail,severity='information')=>`<article class="ew-enterprise-card ew-risk-card" data-severity="${esc(severity)}"><span>${esc(severity)}</span><h3>${esc(title)}</h3><p>${esc(detail)}</p></article>`;

  function healthEntries(data){
    const source=data.health?.health_center||data.health||data.systemHealth||{};
    const candidates=[
      ['API Health',source.api||source.api_health],
      ['Queue Health',source.queue||source.queue_health||source.ai_retry_queue],
      ['Worker Health',source.worker||source.worker_health],
      ['Database Health',source.database||source.database_health],
      ['Storage Health',source.storage||source.storage_health],
      ['Rendering Health',source.rendering||source.rendering_health],
      ['AI Health',source.ai||source.ai_health],
      ['Synchronization Health',source.synchronization||source.sync],
      ['Notification Health',source.notifications||source.notification_health],
      ['Export Health',source.exports||source.export_health]
    ];
    return candidates.map(([label,value])=>{
      if(typeof value==='string')return {label,state:value,detail:'Authoritative service status'};
      if(value&&typeof value==='object')return {label,state:value.status||value.state||'available',detail:value.checked_at||value.generated_at||'Operational contract'};
      return {label,state:'unavailable',detail:'No authorized health signal returned'};
    });
  }

  function metrics(data){
    const dashboard=data.operations?.operational_dashboard||data.operations||{};
    const products=array(data.products);
    const notifications=array(data.notifications);
    return [
      ['Organizations',dashboard.organizations_active??dashboard.organizations,'Active organizational contexts'],
      ['Projects',dashboard.projects_running??dashboard.projects,'Visible operational portfolio'],
      ['Active surveys',dashboard.active_surveys,'Live evidence collection'],
      ['Interviews today',dashboard.interviews_today,'Current field activity'],
      ['Reports generated',dashboard.reports_generated??products.filter(p=>p.product_type==='professional_report').length,'Governed report products'],
      ['Knowledge publications',dashboard.knowledge_publications??products.filter(p=>/publication|knowledge/.test(p.product_type||'')).length,'Published knowledge'],
      ['Pending approvals',dashboard.pending_approvals??products.filter(p=>/review|pending/i.test(`${p.workflow_state} ${p.approval_state}`)).length,'Authority action required'],
      ['Critical alerts',dashboard.critical_alerts??notifications.filter(n=>/critical|urgent/i.test(`${n.severity} ${n.title} ${n.message}`)).length,'Visible high-priority signals']
    ];
  }

  function render(profile,data){
    const events=timelineFrom(data);
    const metricCards=metrics(data).map(([label,value,detail])=>metricCard(label,value,detail,label.includes('Critical')?'risk':'neutral')).join('');
    const healthCards=healthEntries(data).map(item=>statusCard(item.label,item.state,item.detail)).join('');
    const risks=array(data.alerts?.alerts||data.alerts).slice(0,6);
    const riskCards=(risks.length?risks.map(item=>riskCard(item.title||item.rule||'Operational signal',item.message||item.detail||'Review the authoritative service signal.',item.severity)):[
      riskCard('No authoritative alert feed available','Mission Control does not infer incidents when the protected operations service returns no signal.','information')
    ]).join('');
    return `<section class="ew-mission-control" aria-labelledby="mission-control-title">
      <header class="ew-mc-header"><div><p class="ew-eyebrow">VoiceInsights Mission Control™</p><h2 id="mission-control-title">${esc(profile.label)}</h2><p>${esc(profile.mission)}</p></div><div class="ew-mc-state"><span class="ew-status-dot"></span>Live operational context <small>${navigator.onLine?'Connected':'Offline-aware'}</small></div></header>
      <section aria-labelledby="platform-overview-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Thirty-second orientation</p><h2 id="platform-overview-title">Platform overview</h2></div><button type="button" data-command-open>Search enterprise</button></div><div class="ew-enterprise-grid ew-metric-grid">${metricCards}</div></section>
      <section class="ew-mc-split"><div><div class="ew-section-heading"><h2>Live operations feed</h2><span>${events.length} visible events</span></div><div class="ew-timeline" role="feed" aria-label="Enterprise intelligence timeline">${events.map(activityCard).join('')||'<div class="ew-empty">No authorized timeline event is currently visible.</div>'}</div></div><aside><div class="ew-section-heading"><h2>Risk summary</h2></div><div class="ew-risk-list">${riskCards}</div></aside></section>
      <section aria-labelledby="health-center-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Service assurance</p><h2 id="health-center-title">Platform Health Center</h2></div><span>Unavailable never means healthy</span></div><div class="ew-enterprise-grid ew-health-grid">${healthCards}</div></section>
      <section class="ew-mc-actions" aria-label="Executive quick actions"><h2>Executive quick actions</h2><div><button data-go="executive">Open executive analytics</button><button data-go="approvals">Review pending approvals</button><button data-go="notifications">Open critical alerts</button><button data-command-open>Global search</button></div><p>AI Executive Brief remains evidence-bound, reviewable and separate from institutional authority.</p></section>
    </section>`;
  }

  function search(q,data){
    const needle=String(q||'').trim().toLowerCase();
    if(!needle)return [];
    const productResults=array(data.products).filter(item=>JSON.stringify(item).toLowerCase().includes(needle)).map(item=>({kind:item.product_type||'Intelligence Product',title:item.title||item.name||'Untitled product',id:item.product_id,href:null}));
    const eventResults=timelineFrom(data).filter(item=>JSON.stringify(item).toLowerCase().includes(needle)).map(item=>({kind:item.module,title:item.title,id:item.related_object,href:null}));
    return [...productResults,...eventResults].slice(0,20);
  }

  global.VIAMissionControl=Object.freeze({eventEnvelope,timelineFrom,healthEntries,metrics,render,search,components:Object.freeze({metricCard,statusCard,activityCard,riskCard})});
  if(typeof module!=='undefined')module.exports=global.VIAMissionControl;
})(typeof window!=='undefined'?window:globalThis);
