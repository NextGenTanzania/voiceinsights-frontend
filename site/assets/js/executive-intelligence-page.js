/* VoiceInsights Africa — Executive Intelligence page controller
   (executive-intelligence.html). Program Beta Sprint 3. Depends on
   config.js, safe-dom.js, app.js, and decision-workspace.js having
   already loaded. */
(function () {
  'use strict';
  if (!requireLogin()) return;

  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const role = storedUser?.role || '';

  if (!DW.roleHasPermission(role, 'action.read')) {
    renderShell({ role: 'client', active: '/app/executive-intelligence.html', title: 'Executive Intelligence' });
    document.getElementById('ei-denied').style.display = 'flex';
    return;
  }

  renderShell({ role: 'client', active: '/app/executive-intelligence.html', eyebrow: 'Program Beta', title: 'Executive Intelligence' });
  document.getElementById('ei-root').style.display = 'block';

  const esc = DW.escapeHtml;
  const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const SEVERITY_BADGE = { critical: 'badge-danger', high: 'badge-warn', medium: 'badge-neutral', low: 'badge-neutral' };

  // Cache of the last successful load, reused by Briefing Mode so entering
  // it never triggers a second fetch of the same data (Part 14).
  let lastLoad = null;

  async function loadAll() {
    setLoadingStates();
    let commandCenter, brief, decisionsRequired, timeline;
    try {
      [commandCenter, brief, decisionsRequired, timeline] = await Promise.all([
        DW.Api.getExecutiveCommandCenter(),
        DW.Api.getExecutiveAttentionBrief(),
        DW.Api.getExecutiveDecisionsRequired(),
        DW.Api.getExecutiveTimeline({ limit: 20 }),
      ]);
    } catch (e) {
      renderFatalError(e);
      return;
    }
    lastLoad = { commandCenter, brief, decisionsRequired, timeline };
    renderSituationHeader(commandCenter);
    renderAttentionBrief(brief);
    renderDecisionsRequired(decisionsRequired);
    renderHealthSummary(commandCenter);
    renderStrategicPriorities(commandCenter.strategic_priorities);
    renderPortfolioPerformance(commandCenter.project_portfolios);
    renderRiskIntelligence(commandCenter);
    renderWorkload(commandCenter.owner_workload);
    renderPipeline(commandCenter);
    renderEvidence(commandCenter.evidence);
    renderTrend(commandCenter.trend);
    renderTimeline(timeline);
  }

  function setLoadingStates() {
    ['ei-brief', 'ei-decisions', 'ei-health', 'ei-strategic', 'ei-portfolio', 'ei-risk', 'ei-workload', 'ei-pipeline', 'ei-evidence', 'ei-trend', 'ei-timeline'].forEach(prefix => {
      const loading = document.getElementById(`${prefix}-loading`);
      if (loading) loading.style.display = 'block';
    });
  }

  function renderFatalError(e) {
    document.getElementById('ei-situation-meta').textContent = 'Unable to load executive data.';
    const el = document.getElementById('ei-brief-error');
    if (el) { el.style.display = 'block'; el.textContent = `Executive Intelligence failed to load: ${e.message || 'unknown error'}`; }
    document.getElementById('ei-brief-loading').style.display = 'none';
  }

  // ---------- A. Situation Header ----------
  function renderSituationHeader(cc) {
    document.getElementById('ei-org-name').textContent = cc.organization_id || '—';
    const scopeLabel = { executive: 'Executive view', operational: 'Operational leadership view', assurance: 'Evidence & assurance view' }[cc.scope] || cc.scope;
    document.getElementById('ei-scope-badge').textContent = scopeLabel;
    const health = cc.health;
    const asp = health?.projections?.['action-summary'];
    const freshnessText = asp?.projected_at ? `Data refreshed ${DW.formatDateTime(asp.projected_at)}` : 'Refresh time unavailable';
    document.getElementById('ei-situation-meta').innerHTML =
      `${esc(freshnessText)} &middot; Signed in as <strong>${esc(storedUser?.full_name || storedUser?.email || role)}</strong> (${esc(role.replace(/_/g, ' '))})`;

    const staleWarning = document.getElementById('ei-stale-warning');
    if (asp && asp.status === 'lagging') {
      staleWarning.style.display = 'block';
      staleWarning.textContent = `Projection data is running behind (last refreshed ${DW.formatDateTime(asp.projected_at)}). Treat every insight below as unconfirmed until it catches up.`;
    } else {
      staleWarning.style.display = 'none';
    }
  }

  // ---------- B. Leadership Attention Brief ----------
  function renderAttentionBrief(brief) {
    document.getElementById('ei-brief-loading').style.display = 'none';
    if (!brief.ok) { document.getElementById('ei-brief-error').style.display = 'block'; document.getElementById('ei-brief-error').textContent = 'Unable to evaluate insight rules.'; return; }
    const list = document.getElementById('ei-brief-list');
    if (!brief.insights.length) { document.getElementById('ei-brief-empty').style.display = 'block'; return; }
    list.style.display = 'block';
    list.innerHTML = brief.insights.map(i => `
      <li class="ei-insight-item ei-severity-${esc(i.severity)}">
        <div class="ei-insight-top">
          <span class="badge ${SEVERITY_BADGE[i.severity] || 'badge-neutral'}">${esc(SEVERITY_LABEL[i.severity] || i.severity)}</span>
          <span class="ei-insight-rule">${esc(i.rule_id)}</span>
        </div>
        <p class="ei-insight-message">${esc(i.message)}</p>
        <p class="ei-insight-why"><strong>Why it matters:</strong> ${esc(i.why_it_matters)}</p>
        <div class="ei-insight-meta">
          ${i.responsible_owner ? `<span>Owner: ${esc(i.responsible_owner)}</span>` : ''}
          ${i.age_days != null ? `<span>Age: ${esc(i.age_days)} day(s)</span>` : ''}
        </div>
        <p class="ei-insight-next"><strong>Recommended next step:</strong> ${esc(i.recommended_next_step)}</p>
        ${i.link ? `<a class="btn btn-ghost btn-sm" href="${DW.safeHref(new URL(i.link, location.origin).href) || '#'}">Open</a>` : ''}
      </li>
    `).join('');
  }

  // ---------- Decisions Required ----------
  function renderDecisionsRequired(dr) {
    document.getElementById('ei-decisions-loading').style.display = 'none';
    if (dr.available === false) {
      document.getElementById('ei-decisions-unavailable').style.display = 'block';
      document.getElementById('ei-decisions-unavailable').textContent = dr.reason || 'Not available for this role.';
      return;
    }
    if (!dr.decisions.length) { document.getElementById('ei-decisions-empty').style.display = 'block'; return; }
    document.getElementById('ei-decisions-table-wrap').style.display = 'block';
    document.getElementById('ei-decisions-tbody').innerHTML = dr.decisions.map(d => `
      <tr>
        <td>${esc(d.decision_required)}</td>
        <td>${esc(d.decision_deadline)}</td>
        <td>${esc(d.consequence_of_inaction)}</td>
        <td>${esc(d.responsible_authority)}</td>
        <td>${d.link ? `<a href="${DW.safeHref(new URL(d.link, location.origin).href) || '#'}">Open</a>` : ''}</td>
      </tr>
    `).join('');
  }

  // ---------- C. Institutional Health Summary ----------
  function tile(label, value, sub) {
    return `<div class="ei-kpi-tile"><div class="ei-kpi-value">${esc(value)}</div><div class="ei-kpi-label">${esc(label)}</div>${sub ? `<div class="ei-kpi-sub">${esc(sub)}</div>` : ''}</div>`;
  }
  function pct(v) { return v == null ? '—' : `${Math.round(v * 100)}%`; }

  function renderHealthSummary(cc) {
    document.getElementById('ei-health-loading').style.display = 'none';
    const p = cc.portfolio;
    if (!p.available) { document.getElementById('ei-health-error').style.display = 'block'; document.getElementById('ei-health-error').textContent = p.reason || 'No projection data yet.'; return; }
    const grid = document.getElementById('ei-health-tiles');
    grid.style.display = 'grid';
    grid.innerHTML = [
      tile('Total governed Actions', p.total_actions),
      tile('Completion rate', pct(p.completion_rate), 'completed + verified / total (excl. cancelled)'),
      tile('Verification rate', pct(p.verification_rate), 'verified / (completed + verified)'),
      tile('Overdue exposure', p.overdue_count),
      tile('Escalation exposure', p.escalated_count),
      tile('Critical-priority exposure', p.critical_priority_count),
      tile('Review backlog', p.awaiting_review_count),
      tile('Verification backlog', p.awaiting_verification_count),
    ].join('');
  }

  // ---------- D. Strategic Priority Performance ----------
  function renderStrategicPriorities(sp) {
    document.getElementById('ei-strategic-loading').style.display = 'none';
    if (!sp || sp.available === false) {
      document.getElementById('ei-strategic-unavailable').style.display = 'block';
      document.getElementById('ei-strategic-unavailable').textContent = sp?.reason || 'Not available for this role.';
      return;
    }
    if (!sp.strategic_priorities.length) { document.getElementById('ei-strategic-empty').style.display = 'block'; return; }
    document.getElementById('ei-strategic-table-wrap').style.display = 'block';
    document.getElementById('ei-strategic-tbody').innerHTML = sp.strategic_priorities.map(row => `
      <tr>
        <td><a href="/app/decisions.html?tab=all&strategic_priority=${encodeURIComponent(row.strategic_priority)}">${esc(row.strategic_priority)}</a></td>
        <td>${esc(row.total_commitments)}</td>
        <td>${esc(row.completed_count)}</td>
        <td>${esc(row.verified_count)}</td>
        <td>${esc(row.overdue_count)}</td>
        <td>${pct(row.overdue_rate)}</td>
        <td>${row.average_progress_pct != null ? row.average_progress_pct + '%' : '—'}</td>
      </tr>
    `).join('');
  }

  // ---------- E. Portfolio Performance ----------
  function renderPortfolioPerformance(pp) {
    document.getElementById('ei-portfolio-loading').style.display = 'none';
    if (!pp || pp.available === false) {
      document.getElementById('ei-portfolio-unavailable').style.display = 'block';
      document.getElementById('ei-portfolio-unavailable').textContent = pp?.reason || 'Not available for this role.';
      return;
    }
    if (!pp.projects.length) { document.getElementById('ei-portfolio-empty').style.display = 'block'; return; }
    document.getElementById('ei-portfolio-table-wrap').style.display = 'block';
    document.getElementById('ei-portfolio-tbody').innerHTML = pp.projects.map(row => `
      <tr>
        <td><a href="/app/decisions.html?tab=all&project=${encodeURIComponent(row.project_id)}">${esc(row.project_id)}</a></td>
        <td>${esc(row.total_actions)}</td>
        <td>${esc(row.overdue_count)}</td>
        <td>${esc(row.escalated_count)}</td>
        <td>${esc(row.high_risk_count)}</td>
        <td>${pct(row.completion_rate)}</td>
        <td>${pct(row.verification_rate)}</td>
      </tr>
    `).join('');
  }

  // ---------- F. Risk and Escalation Intelligence ----------
  function renderRiskIntelligence(cc) {
    document.getElementById('ei-risk-loading').style.display = 'none';
    const kpi = cc.executive_kpi;
    const grid = document.getElementById('ei-risk-tiles');
    grid.style.display = 'grid';
    if (!kpi.available) { grid.innerHTML = `<p class="muted-note">${esc(kpi.reason || 'No data yet.')}</p>`; return; }
    const riskConc = kpi.risk_concentration || {};
    grid.innerHTML = [
      tile('High risk', riskConc.high || 0),
      tile('Critical risk', riskConc.critical || 0),
      tile('Escalated (unresolved)', kpi.escalated_count || 0),
      tile('Overdue', `${kpi.overdue.count} (${kpi.overdue.percentage != null ? kpi.overdue.percentage + '%' : '—'})`),
    ].join('');
  }

  // ---------- G. Accountability and Workload ----------
  function renderWorkload(ow) {
    document.getElementById('ei-workload-loading').style.display = 'none';
    if (!ow) return;
    if (ow.available_detail === false) {
      document.getElementById('ei-workload-unavailable').style.display = 'block';
      document.getElementById('ei-workload-unavailable').textContent = `${ow.reason} (${ow.owner_count} owner(s) with assigned work.)`;
      return;
    }
    const owners = ow.owners || [];
    document.getElementById('ei-workload-table-wrap').style.display = 'block';
    document.getElementById('ei-workload-tbody').innerHTML = owners.map(o => `
      <tr>
        <td><a href="/app/decisions.html?tab=all&owner=${encodeURIComponent(o.owner)}">${esc(o.owner_display_name || o.owner)}</a></td>
        <td>${esc(o.assigned_count)}</td>
        <td>${esc(o.in_progress_count)}</td>
        <td>${esc(o.overdue_count)}</td>
        <td>${esc(o.due_soon_count)}</td>
        <td>${esc(o.awaiting_verification_count)}</td>
      </tr>
    `).join('');
  }

  // ---------- H. Decision and Review Pipeline ----------
  const PIPELINE_STAGES = ['draft', 'under_review', 'needs_clarification', 'approved', 'assigned', 'in_progress', 'completed', 'verified', 'rejected', 'cancelled'];
  const STAGE_COLOR = { draft: '#8A9B94', under_review: '#E4A23A', needs_clarification: '#E4C23A', approved: '#4FA490', assigned: '#4FA490', in_progress: '#4FA490', completed: '#6FBF8B', verified: '#6FBF8B', rejected: '#D9634A', cancelled: '#8A9B94' };
  function renderPipeline(cc) {
    document.getElementById('ei-pipeline-loading').style.display = 'none';
    const backlog = cc.portfolio?.backlog_by_status || {};
    const total = Object.values(backlog).reduce((s, n) => s + n, 0);
    const bar = document.getElementById('ei-pipeline-bar');
    const legend = document.getElementById('ei-pipeline-legend');
    if (!total) { legend.innerHTML = '<p class="muted-note">No Actions yet.</p>'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = PIPELINE_STAGES.filter(s => backlog[s]).map(s => `<span style="width:${(backlog[s] / total) * 100}%; background:${STAGE_COLOR[s]};" title="${esc(DW.statusLabel(s))}: ${backlog[s]}"></span>`).join('');
    legend.innerHTML = PIPELINE_STAGES.filter(s => backlog[s]).map(s => `<span class="ei-pipeline-legend-item"><i style="background:${STAGE_COLOR[s]};"></i>${esc(DW.statusLabel(s))}: ${backlog[s]}</span>`).join('');
  }

  // ---------- I. Evidence and Assurance ----------
  function renderEvidence(ev) {
    document.getElementById('ei-evidence-loading').style.display = 'none';
    const grid = document.getElementById('ei-evidence-tiles');
    grid.style.display = 'grid';
    grid.innerHTML = [
      tile('Evidence coverage', pct(ev.evidence_coverage_rate)),
      tile('Verified', ev.verified_count),
      tile('Completed without evidence', ev.completed_without_evidence_count),
      tile('High-risk without evidence', ev.high_risk_without_evidence_count),
      tile('Evidence added (7 days)', ev.evidence_added_last_7_days),
    ].join('');
    document.getElementById('ei-evidence-note').textContent = ev.note;
  }

  // ---------- Trend and Movement ----------
  function renderTrend(trend) {
    document.getElementById('ei-trend-loading').style.display = 'none';
    if (!trend.available) {
      document.getElementById('ei-trend-unavailable').style.display = 'block';
      document.getElementById('ei-trend-unavailable').textContent = trend.reason;
      return;
    }
    const chart = document.getElementById('ei-trend-chart');
    chart.style.display = 'flex';
    const maxOverdue = Math.max(1, ...trend.points.map(p => p.overdue_count));
    chart.innerHTML = trend.points.map(p => `
      <div class="ei-trend-bar-col">
        <div class="ei-trend-bar" style="height:${(p.overdue_count / maxOverdue) * 100}%;" title="${esc(p.date)}: ${p.overdue_count} overdue"></div>
        <div class="ei-trend-bar-label">${esc(p.date.slice(5))}</div>
      </div>
    `).join('');
  }

  // ---------- J. Executive Timeline ----------
  const HISTORY_TYPE_ICON = { status: '🔁', assignment: '👤', evidence: '📎', verification: '✅' };
  function renderTimeline(tl) {
    document.getElementById('ei-timeline-loading').style.display = 'none';
    const list = document.getElementById('ei-timeline-list');
    if (!tl.events.length) { document.getElementById('ei-timeline-empty').style.display = 'block'; list.style.display = 'none'; return; }
    document.getElementById('ei-timeline-empty').style.display = 'none';
    list.style.display = 'block';
    list.innerHTML = tl.events.map(e => `
      <li class="ei-timeline-item">
        <span class="ei-timeline-icon">${HISTORY_TYPE_ICON[e.history_type] || '•'}</span>
        <div>
          <div class="ei-timeline-headline"><a href="/app/decision-detail.html?id=${encodeURIComponent(e.action_id)}">${esc(e.recommendation || e.action_id)}</a></div>
          <div class="ei-timeline-detail">${esc(e.history_type)}: ${esc(e.from_value || '—')} → ${esc(e.to_value || '—')} ${e.actor_role ? `by ${esc(e.actor_role)}` : ''}</div>
          <div class="ei-timeline-time">${esc(DW.formatDateTime(e.created_at))}</div>
        </div>
      </li>
    `).join('');
  }

  async function applyTimelineFilters() {
    document.getElementById('ei-timeline-loading').style.display = 'block';
    document.getElementById('ei-timeline-empty').style.display = 'none';
    document.getElementById('ei-timeline-list').style.display = 'none';
    const project = document.getElementById('ei-timeline-project').value.trim();
    const eventType = document.getElementById('ei-timeline-type').value;
    const tl = await DW.Api.getExecutiveTimeline({ project: project || undefined, event_type: eventType || undefined, limit: 20 });
    lastLoad.timeline = tl;
    renderTimeline(tl);
  }
  document.getElementById('ei-timeline-apply').addEventListener('click', applyTimelineFilters);
  document.getElementById('ei-timeline-reset').addEventListener('click', () => {
    document.getElementById('ei-timeline-project').value = '';
    document.getElementById('ei-timeline-type').value = '';
    applyTimelineFilters();
  });

  document.getElementById('ei-refresh-btn').addEventListener('click', loadAll);

  // ============================================================
  // Part 4 — Briefing Mode. Reuses lastLoad — never a second fetch.
  // Clean, presentation-grade re-flow: headline, health, priority
  // concerns, strategic performance, risks, evidence, decisions required,
  // data limitations/freshness — matching the brief's 10-point structure.
  // ============================================================
  function enterBriefingMode() {
    if (!lastLoad) return;
    const { commandCenter, brief, decisionsRequired } = lastLoad;
    const p = commandCenter.portfolio;
    const topInsights = brief.insights.slice(0, 5);
    const asp = commandCenter.health?.projections?.['action-summary'];
    document.getElementById('ei-briefing-body').innerHTML = `
      <section class="ei-brief-slide">
        <div class="ei-eyebrow">VoiceInsights Africa &middot; Executive Briefing</div>
        <h1>${esc(commandCenter.organization_id)}</h1>
        <p class="ei-briefing-lede">Institutional decision performance, evidence-based, drawn directly from governed Action records.</p>
      </section>
      <section class="ei-brief-slide">
        <h2>Institutional Health</h2>
        <div class="ei-kpi-grid">${p.available ? [
          tile('Total Actions', p.total_actions), tile('Completion rate', pct(p.completion_rate)),
          tile('Verification rate', pct(p.verification_rate)), tile('Overdue', p.overdue_count), tile('Escalated', p.escalated_count),
        ].join('') : `<p>${esc(p.reason || 'No data yet.')}</p>`}</div>
      </section>
      <section class="ei-brief-slide">
        <h2>Priority Concerns</h2>
        ${topInsights.length ? `<ul>${topInsights.map(i => `<li><strong>${esc(SEVERITY_LABEL[i.severity])}:</strong> ${esc(i.message)}</li>`).join('')}</ul>` : '<p>No urgent issues detected.</p>'}
      </section>
      <section class="ei-brief-slide">
        <h2>Strategic Performance</h2>
        ${commandCenter.strategic_priorities?.available ? `<ul>${commandCenter.strategic_priorities.strategic_priorities.slice(0, 6).map(sp => `<li>${esc(sp.strategic_priority)}: ${sp.overdue_count}/${sp.total_commitments} overdue (${pct(sp.overdue_rate)})</li>`).join('')}</ul>` : `<p>${esc(commandCenter.strategic_priorities?.reason || 'Not available.')}</p>`}
      </section>
      <section class="ei-brief-slide">
        <h2>Major Risks</h2>
        <div class="ei-kpi-grid">${[
          tile('High risk', commandCenter.executive_kpi.risk_concentration?.high || 0),
          tile('Critical risk', commandCenter.executive_kpi.risk_concentration?.critical || 0),
          tile('Escalated', commandCenter.executive_kpi.escalated_count || 0),
        ].join('')}</div>
      </section>
      <section class="ei-brief-slide">
        <h2>Evidence and Assurance</h2>
        <div class="ei-kpi-grid">${[
          tile('Evidence coverage', pct(commandCenter.evidence.evidence_coverage_rate)),
          tile('High-risk without evidence', commandCenter.evidence.high_risk_without_evidence_count),
        ].join('')}</div>
      </section>
      <section class="ei-brief-slide">
        <h2>Decisions Required</h2>
        ${decisionsRequired.available === false ? `<p>${esc(decisionsRequired.reason)}</p>` : decisionsRequired.decisions.length ? `<ul>${decisionsRequired.decisions.slice(0, 6).map(d => `<li>${esc(d.decision_required)} — deadline ${esc(d.decision_deadline)}</li>`).join('')}</ul>` : '<p>No decisions currently require leadership intervention.</p>'}
      </section>
      <section class="ei-brief-slide">
        <h2>Data Limitations and Freshness</h2>
        <p>Data last refreshed ${asp?.projected_at ? esc(DW.formatDateTime(asp.projected_at)) : 'unknown'}. ${commandCenter.trend.available ? '' : esc(commandCenter.trend.reason)}</p>
        <p class="ei-fine-print">This briefing reflects governed Action records only. No figure on this page was generated by AI — every number traces to a real, evidence-linked record.</p>
      </section>
    `;
    document.getElementById('ei-briefing').style.display = 'block';
    document.body.classList.add('ei-briefing-active');
    history.replaceState(null, '', '?mode=briefing');
  }
  function exitBriefingMode() {
    document.getElementById('ei-briefing').style.display = 'none';
    document.body.classList.remove('ei-briefing-active');
    history.replaceState(null, '', location.pathname);
  }
  document.getElementById('ei-briefing-btn').addEventListener('click', enterBriefingMode);
  document.getElementById('ei-briefing-exit').addEventListener('click', exitBriefingMode);
  document.getElementById('ei-briefing-print').addEventListener('click', () => window.print());

  loadAll().then(() => {
    if (new URLSearchParams(location.search).get('mode') === 'briefing') enterBriefingMode();
  });
})();
