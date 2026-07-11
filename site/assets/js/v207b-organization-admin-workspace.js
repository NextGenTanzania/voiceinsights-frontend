
(function(){
  const API = (window.VIA_API_BASE || window.API_BASE_URL || 'https://voiceinsights-api.kitentyatsnp.workers.dev').replace(/\/$/,'');
  const token = () => localStorage.getItem('vi_token') || localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function kpiCard(k){ return `<div class="v207b-kpi"><span>${esc(k.label)}</span><b>${esc(k.value)}</b><p>${esc(k.interpretation||'')}</p></div>`; }
  function linkAction(a, secondary=false){ return `<a class="v207b-action ${secondary?'secondary':''}" href="${esc(a.href||'#')}">${esc(a.label)}</a>`; }
  function list(items){ return `<ul>${(items||[]).map(i=>`<li>${esc(typeof i==='string'?i:i.label||i.value||JSON.stringify(i))}</li>`).join('')}</ul>`; }
  function render(data){
    const ws = data.workspace || {};
    const org = ws.organization || {};
    const home = ws.organization_home || {};
    const readiness = data.client_readiness || {};
    const root = document.getElementById('v207b-workspace-root');
    if(!root) return;
    root.innerHTML = `
      <section class="v207b-hero">
        <div class="v207b-panel v207b-hero-main">
          <div class="v207b-eyebrow">Organization Admin Workspace</div>
          <h1 class="v207b-title">${esc(org.name || 'Organization Workspace')}</h1>
          <p class="v207b-subtitle">${esc(home.headline || 'Manage projects, teams, surveys, AI insights and publication-ready reports from one organization-scoped workspace.')}</p>
          <div class="v207b-actions">${(home.quick_actions||[]).slice(0,5).map(a=>linkAction(a)).join('')}</div>
        </div>
        <div class="v207b-panel">
          <div class="v207b-eyebrow">Client readiness</div>
          <h2>${esc(readiness.rating || org.publication_rating || '9.9/10')}</h2>
          <p>Organization-scoped workspace with programme management, team controls, branding, AI insights and publication center.</p>
          <div class="v207b-rating">${esc(readiness.status || 'UNABLE_TO_VERIFY')}</div>
        </div>
      </section>
      <section class="v207b-kpi-grid">${(home.kpis||[]).map(kpiCard).join('')}</section>
      <section class="v207b-section v207b-grid-3">
        <div class="v207b-card"><h3>Program Management</h3>${(ws.program_management?.projects||[]).map(i=>`<div class="v207b-status"><span>${esc(i.label)}</span><b>${esc(i.value)}</b></div>`).join('')}<div>${(ws.program_management?.workflows||[]).map(w=>`<span class="v207b-pill">${esc(w)}</span>`).join('')}</div></div>
        <div class="v207b-card"><h3>Publication Center</h3><p><b>${esc(ws.publication_center?.label || 'Publication Excellence')}</b> — ${esc(ws.publication_center?.rating || '9.9/10')}</p>${list(ws.publication_center?.report_products)}</div>
        <div class="v207b-card"><h3>Team & Permissions</h3>${(ws.team_management?.activity_signals||[]).map(i=>`<div class="v207b-status"><span>${esc(i.label)}</span><b>${esc(i.value)}</b></div>`).join('')}<div class="v207b-actions">${(ws.team_management?.quick_actions||[]).map(a=>linkAction(a,true)).join('')}</div></div>
      </section>
      <section class="v207b-section v207b-grid-2">
        <div class="v207b-card"><h3>Branding Center</h3><p>White-label ready organization identity for reports, emails and client portal.</p><div>${(ws.branding_center?.controls||[]).map(c=>`<span class="v207b-pill">${esc(c)}</span>`).join('')}</div></div>
        <div class="v207b-card"><h3>Organization AI Insights</h3>${(ws.ai_insights?.cards||[]).map(i=>`<div class="v207b-status"><span>${esc(i.label)}</span><b>${esc(i.value)}</b></div>`).join('')}<p><b>Scope:</b> ${esc(ws.ai_insights?.scope || 'organization_only')}</p></div>
      </section>
      <section class="v207b-section v207b-card">
        <h3>Client Success & Procurement</h3>
        <div class="v207b-grid-2">
          <div>${list(ws.client_success_center?.resources)}</div>
          <div>${(ws.client_success_center?.procurement_pack||[]).map(p=>`<span class="v207b-pill">${esc(p)}</span>`).join('')}</div>
        </div>
      </section>`;
  }
  async function initV207BOrganizationAdminWorkspace(){
    const root = document.getElementById('v207b-workspace-root');
    if(!root) return;
    root.innerHTML = '<div class="v207b-panel"><b>Loading Organization Admin Workspace...</b></div>';
    try{
      const res = await fetch(`${API}/api/organization/admin-workspace-v207b`, { headers: token()? { Authorization:`Bearer ${token()}` } : {} });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
    }catch(err){
      render({workspace:{organization:{name:'Organization Workspace'},organization_home:{headline:'Live organization data is temporarily unavailable.',kpis:[{label:'Status',value:'Unavailable',interpretation:'Reconnect or contact support'}],quick_actions:[]},program_management:{projects:[],workflows:[]},publication_center:{label:'Publication quality',rating:'Not yet measured',report_products:[]},team_management:{activity_signals:[],quick_actions:[]},branding_center:{controls:[]},ai_insights:{scope:'organization_only',cards:[{label:'AI readiness',value:'Not yet measured'}]},client_success_center:{resources:[],procurement_pack:[]}},client_readiness:{rating:'Not yet measured',status:'UNABLE_TO_VERIFY'}});
    }
  }
  window.initV207BOrganizationAdminWorkspace = initV207BOrganizationAdminWorkspace;
  document.addEventListener('DOMContentLoaded', initV207BOrganizationAdminWorkspace);
})();
