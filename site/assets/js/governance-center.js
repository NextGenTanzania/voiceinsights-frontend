(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list=value=>Array.isArray(value)?value:[];
  const empty=message=>`<div class="ew-empty">${esc(message)}</div>`;
  const stateBadge=value=>`<span class="ew-chip" data-state="${esc(value)}">${esc(value||'Unknown')}</span>`;

  async function load(api,profile){
    if(!profile.views.some(view=>['governance','investigations','risk','compliance','replay'].includes(view)))return {};
    const calls=[
      profile.views.includes('governance')?api('/api/governance/policies'):null,
      profile.views.includes('approvals')?api('/api/governance/approvals'):null,
      profile.views.includes('investigations')?api('/api/governance/investigations'):null,
      profile.views.includes('investigations')?api('/api/governance/fraud/alerts'):null,
      profile.views.includes('risk')?api('/api/governance/risks'):null,
      profile.views.includes('compliance')?api('/api/governance/compliance'):null
    ];
    const [policies,approvals,investigations,fraud,risks,compliance]=await Promise.all(calls.map(call=>call||Promise.resolve(null)));
    return {policies:policies?.policies||[],approvals:approvals?.approval_requests||[],investigations:investigations?.investigations||[],fraud:fraud?.fraud_alerts||[],risks:risks?.risks||[],compliance:compliance||null};
  }

  function approvals(data){
    const rows=list(data.approvals);
    const counts={pending:rows.filter(item=>item.status==='PENDING').length,urgent:rows.filter(item=>item.priority==='URGENT').length,escalated:rows.filter(item=>item.status==='ESCALATED').length,expired:rows.filter(item=>item.status==='EXPIRED').length,rejected:rows.filter(item=>item.status==='REJECTED').length};
    return `<section aria-labelledby="approval-center-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Executive governance</p><h2 id="approval-center-title">Approval Center</h2></div><span>Policy-resolved authority</span></div>
      <div class="ew-enterprise-grid ew-metric-grid">${Object.entries(counts).map(([label,value])=>`<article class="ew-enterprise-card ew-metric-card"><span>${esc(label)}</span><strong>${value}</strong><small>Approval requests</small></article>`).join('')}</div>
      <div class="ew-governance-queue">${rows.map(item=>`<article class="ew-enterprise-card ew-approval-card"><div><p class="ew-eyebrow">${esc(item.action)}</p><h3>${esc(item.object_type)} ${esc(item.object_id||'')}</h3><p>${esc(item.reason)}</p><div>${stateBadge(item.status)} ${stateBadge(item.priority)} <span class="ew-chip">Level ${esc(item.current_level)}</span></div></div><div class="ew-approval-actions"><button data-approval-command="approve" data-approval-id="${esc(item.id)}">Approve</button><button data-approval-command="reject" data-approval-id="${esc(item.id)}">Reject</button><button data-approval-command="request-revision" data-approval-id="${esc(item.id)}">Request revision</button><button data-approval-command="delegate" data-approval-id="${esc(item.id)}">Delegate</button><button data-approval-command="comment" data-approval-id="${esc(item.id)}">Comment</button></div></article>`).join('')||empty('No governed approval request is visible to this role.')}</div></section>`;
  }

  function governance(data){
    const policies=list(data.policies);
    return `<section aria-labelledby="governance-engine-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Policy-controlled operations</p><h2 id="governance-engine-title">Governance Engine</h2></div><span>${policies.length} visible policy versions</span></div>
      <div class="ew-enterprise-grid">${policies.map(policy=>`<article class="ew-enterprise-card ew-policy-card"><div>${stateBadge(policy.status)} <span class="ew-chip">v${esc(policy.version)}</span></div><h3>${esc(policy.policy_key)}</h3><p>${esc(policy.policy_type)} policy · Review ${esc(policy.review_at||'not scheduled')}</p><small>Configuration is versioned; released policy history is not overwritten.</small></article>`).join('')||empty('No enabled policy is configured. High-impact actions fail closed.')}</div></section>`;
  }

  function investigations(data){
    const cases=list(data.investigations),alerts=list(data.fraud);
    return `<section aria-labelledby="investigation-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Evidence-preserving inquiry</p><h2 id="investigation-title">Investigation Center</h2></div><span>${cases.length} visible cases · ${alerts.length} fraud alerts</span></div>
      <div class="ew-mc-split"><div><h3>Cases</h3>${cases.map(item=>`<article class="ew-enterprise-card ew-investigation-card"><div>${stateBadge(item.status)} ${stateBadge(item.severity)}</div><h3>${esc(item.title)}</h3><p>${esc(item.allegation_type)} · Assigned ${esc(item.assigned_to||'not assigned')}</p><small>Opened ${esc(item.opened_at)}</small></article>`).join('')||empty('No investigation case is visible.')}</div><aside><h3>Fraud intelligence</h3>${alerts.map(item=>`<article class="ew-enterprise-card ew-risk-card"><span>Risk ${esc(item.risk_score)} · Confidence ${esc(item.confidence_score)}</span><h3>${esc(item.signal_type)}</h3><p>${esc(item.recommended_action)}</p>${stateBadge(item.status)}</article>`).join('')||empty('No governed fraud alert is visible.')}</aside></div></section>`;
  }

  function risk(data){
    const rows=list(data.risks);
    return `<section aria-labelledby="risk-center-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Enterprise risk intelligence</p><h2 id="risk-center-title">Risk Center</h2></div><span>Likelihood × consequence</span></div><div class="ew-enterprise-grid">${rows.map(item=>`<article class="ew-enterprise-card ew-risk-card" data-severity="${esc(item.risk_score>=20?'critical':item.risk_score>=12?'high':item.risk_score>=6?'medium':'low')}"><span>${esc(item.category)} · Score ${esc(item.risk_score)}</span><h3>${esc(item.title)}</h3><p>${esc(item.trend)} · ${esc(item.status)}</p></article>`).join('')||empty('No enterprise risk record is visible.')}</div></section>`;
  }

  function compliance(data){
    const result=data.compliance;
    if(!result)return empty('Compliance evidence is unavailable to this role.');
    return `<section aria-labelledby="compliance-center-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Readiness, not certification</p><h2 id="compliance-center-title">Compliance Center</h2></div><span>${esc(result.readiness?.percentage||0)}% controls implemented or verified</span></div><p class="ew-ai-note">Readiness monitoring never represents certification or legal advice.</p><div class="ew-enterprise-grid">${list(result.frameworks).map(name=>`<article class="ew-enterprise-card"><h3>${esc(name)}</h3><p>Control status and supporting evidence remain independently inspectable.</p></article>`).join('')}</div></section>`;
  }

  function replay(){
    return `<section aria-labelledby="replay-title"><div class="ew-section-heading"><div><p class="ew-eyebrow">Historical reconstruction</p><h2 id="replay-title">Executive Replay</h2></div><span>Maximum 1,000 ordered events per request</span></div><form class="ew-replay-form" data-replay-form><label>Object type <select name="object_type"><option value="">Any governed object</option><option>organization</option><option>project</option><option>survey</option><option>interview</option><option>approval</option><option>investigation</option></select></label><label>Object identity <input name="object_id" autocomplete="off"></label><button type="submit">Reconstruct history</button></form><div data-replay-results>${empty('Choose an authorized scope to reconstruct what happened, in order.')}</div></section>`;
  }

  function bind(root,api,refresh,status){
    root.querySelectorAll('[data-approval-command]').forEach(button=>button.onclick=async()=>{
      const command=button.dataset.approvalCommand;
      const comment=global.prompt?.(command==='delegate'?'Delegate to user identity':'Decision comment or rationale');
      if(comment===null)return;
      const body=command==='delegate'?{delegate_to:comment,comment:'Delegated by authorized executive'}:{comment};
      try{await api(`/api/governance/approvals/${encodeURIComponent(button.dataset.approvalId)}/${command}`,{method:'POST',body:JSON.stringify(body)});status('Governance decision recorded');await refresh()}catch(error){status(`Governance decision failed: ${error.message}`)}
    });
    root.querySelector('[data-replay-form]')?.addEventListener('submit',async event=>{
      event.preventDefault();const params=new URLSearchParams(new FormData(event.currentTarget));for(const [key,value] of [...params])if(!value)params.delete(key);
      const target=root.querySelector('[data-replay-results]');target.setAttribute('aria-busy','true');
      try{const response=await api(`/api/governance/replay?${params}`);target.innerHTML=list(response.replay).map(item=>`<article class="ew-enterprise-card ew-activity-card"><time>${esc(item.created_at)}</time><h3>${esc(item.action)}</h3><p>${esc(item.actor_role)} · ${esc(item.object_type)} ${esc(item.object_id||'')}</p><small>${esc(item.reason)}</small></article>`).join('')||empty('No matching historical event is visible.')}catch(error){target.innerHTML=empty(error.message)}finally{target.setAttribute('aria-busy','false')}
    });
  }

  global.VIAGovernanceCenter=Object.freeze({load,approvals,governance,investigations,risk,compliance,replay,bind});
  if(typeof module!=='undefined')module.exports=global.VIAGovernanceCenter;
})(typeof window!=='undefined'?window:globalThis);
