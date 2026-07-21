/* VoiceInsights Africa — Decision Workspace page controller (decisions.html)
   Program Beta Sprint 2. Depends on config.js, safe-dom.js, app.js, and
   decision-workspace.js having already loaded. */
(function () {
  'use strict';
  if (!requireLogin()) return;

  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const currentUserId = storedUser?.id || null;
  const role = storedUser?.role || '';

  if (!DW.roleHasPermission(role, 'action.read')) {
    renderShell({ role: 'client', active: '/app/decisions.html', title: 'Decision Workspace' });
    document.getElementById('dw-denied').style.display = 'flex';
    return;
  }

  renderShell({ role: 'client', active: '/app/decisions.html', eyebrow: 'Program Beta', title: 'Decision Workspace' });
  document.getElementById('dw-root').style.display = 'block';
  if (!DW.roleHasPermission(role, 'action.create')) document.getElementById('dw-create-link').style.display = 'none';

  // ---------- Freshness strip ----------
  (async () => {
    try {
      const health = await DW.Api.getHealth();
      const summary = health.projections?.['action-summary'] || { status: 'unknown' };
      const el = document.getElementById('dw-freshness');
      el.innerHTML = `<span class="badge ${DW.freshnessBadgeClass(summary.status)}">${DW.escapeHtml(DW.freshnessLabel(summary.status))}</span>` +
        (summary.projected_at ? ` <span>Actions last refreshed ${DW.escapeHtml(DW.formatDateTime(summary.projected_at))}</span>` : '') +
        (health.actions_missing_projection > 0 ? ` <span class="badge badge-warn">${health.actions_missing_projection} Action(s) not yet indexed</span>` : '');
    } catch (e) {
      document.getElementById('dw-freshness').innerHTML = `<span class="badge badge-neutral">Freshness unavailable</span>`;
    }
  })();

  // ---------- Populate the status filter <select> from the real status list ----------
  const statusSelect = document.getElementById('dw-f-status');
  DW.ACTION_STATUSES.forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = DW.statusLabel(s); statusSelect.appendChild(opt); });

  // ============================================================
  // Tab switching with real, stable URL query-parameter state
  // ============================================================
  const TABS = ['overview', 'all', 'mine', 'review', 'verification', 'overdue', 'escalated', 'portfolio', 'owners'];
  const loadedTabs = new Set();
  function currentParams() { return DW.parseQueryString(location.search); }

  function activateTab(tabName, opts) {
    opts = opts || {};
    if (!TABS.includes(tabName)) tabName = 'overview';
    document.querySelectorAll('#dw-tabs .tab').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));
    if (!opts.skipHistory) {
      const params = currentParams();
      params.tab = tabName;
      history.pushState({ tab: tabName }, '', DW.buildQueryString(params) || location.pathname);
    }
    ensureTabLoaded(tabName);
  }
  document.querySelectorAll('#dw-tabs .tab').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  window.addEventListener('popstate', () => activateTab(currentParams().tab || 'overview', { skipHistory: true }));

  function ensureTabLoaded(tabName, force) {
    if (loadedTabs.has(tabName) && !force) return;
    loadedTabs.add(tabName);
    ({
      overview: loadOverview,
      all: () => loadAllActions(1),
      mine: () => loadMine(currentMineQuick, 1),
      review: () => loadReview(currentReviewStatus, 1),
      verification: () => loadVerification(1),
      overdue: () => loadOverdue(1),
      escalated: () => loadEscalated(1),
      portfolio: loadPortfolio,
      owners: loadOwners,
    }[tabName] || function () {})();
  }

  // ============================================================
  // Generic list loader/renderer, shared by All / My / Review / Verification /
  // Overdue / Escalated — each only differs in forced filters, columns, and
  // which DOM ids it targets.
  // ============================================================
  function goToDetail(actionId) { location.href = `/app/decision-detail.html?id=${encodeURIComponent(actionId)}`; }

  function renderRows(tbodyEl, actions, columns) {
    tbodyEl.innerHTML = actions.map(action => {
      const cells = columns.map(c => `<td data-label="${DW.escapeHtml(c.label)}"${c.className ? ` class="${c.className}"` : ''}>${c.render(action)}</td>`).join('');
      return `<tr class="dw-action-row" data-id="${DW.escapeHtml(action.action_id)}" tabindex="0" role="button" aria-label="Open Action ${DW.escapeHtml(action.recommendation || action.action_id)}">${cells}</tr>`;
    }).join('');
    tbodyEl.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => goToDetail(tr.dataset.id));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDetail(tr.dataset.id); } });
    });
  }

  function renderPagination(el, pagination, onPage) {
    const { total, limit, offset } = pagination;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.floor(offset / limit) + 1;
    if (total === 0) { el.innerHTML = ''; return; }
    let html = `<button ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ Prev</button>`;
    html += `<span class="muted-note" style="padding:0 .6rem;">Page ${currentPage} of ${totalPages} (${total} total)</span>`;
    html += `<button ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next ›</button>`;
    el.innerHTML = html;
    el.querySelectorAll('button[data-page]:not([disabled])').forEach(btn => btn.addEventListener('click', () => onPage(Number(btn.dataset.page))));
  }

  const STD_COLUMNS = {
    action: { label: 'Action', className: 'dw-recommendation-cell', render: a => DW.escapeHtml(a.recommendation || a.action_id) },
    status: { label: 'Status', render: a => `<span class="badge ${DW.statusBadgeClass(a.status)}">${DW.escapeHtml(DW.statusLabel(a.status))}</span>` },
    priority: { label: 'Priority', render: a => `<span class="badge ${DW.priorityBadgeClass(a.priority)}">${DW.escapeHtml(a.priority || '—')}</span>` },
    risk: { label: 'Risk', render: a => a.risk_level ? `<span class="badge ${DW.riskBadgeClass(a.risk_level)}">${DW.escapeHtml(a.risk_level)}</span>` : '<span class="muted-note">—</span>' },
    owner: { label: 'Owner', render: a => DW.escapeHtml(DW.ownerDisplay(a)) },
    due: { label: 'Due', render: a => DW.escapeHtml(DW.formatDate(a.due_date)) },
    progress: { label: 'Progress', render: a => `${Number(a.progress_pct || 0)}%` },
    project: { label: 'Project', render: a => DW.escapeHtml(a.project_id || '—') },
    completed: { label: 'Completed', render: a => DW.escapeHtml(DW.formatDate(a.completion_date)) },
    daysOverdue: { label: 'Days Overdue', render: a => { const d = DW.daysSince(a.overdue_since); return d == null ? '—' : `${d} day${d === 1 ? '' : 's'}`; } },
    escalatedSince: { label: 'Escalated Since', render: a => DW.escapeHtml(DW.formatDateTime(a.escalated_since)) },
    since: { label: 'Since', render: a => DW.escapeHtml(DW.formatDateTime(a.last_activity_at)) },
    lastActivity: { label: 'Last Activity', render: a => DW.escapeHtml(DW.formatDateTime(a.last_activity_at)) },
  };

  function setState(prefix, state) {
    document.getElementById(`dw-${prefix}-loading`).style.display = state === 'loading' ? 'block' : 'none';
    document.getElementById(`dw-${prefix}-error`).style.display = state === 'error' ? 'block' : 'none';
    const empty = document.getElementById(`dw-${prefix}-empty`);
    if (empty) empty.style.display = state === 'empty' ? 'block' : 'none';
    const tableWrap = document.getElementById(`dw-${prefix}-table-wrap`);
    if (tableWrap) tableWrap.style.display = state === 'ok' ? 'block' : 'none';
  }

  async function loadList(prefix, filters, columns, page, limit) {
    limit = limit || 20;
    setState(prefix, 'loading');
    try {
      const result = await DW.Api.listActions({ ...filters, limit, offset: (page - 1) * limit });
      if (!result.actions.length) { setState(prefix, 'empty'); document.getElementById(`dw-${prefix}-pagination`).innerHTML = ''; return; }
      renderRows(document.getElementById(`dw-${prefix}-tbody`), result.actions, columns);
      setState(prefix, 'ok');
      renderPagination(document.getElementById(`dw-${prefix}-pagination`), result.pagination, (p) => loadList(prefix, filters, columns, p, limit));
    } catch (e) {
      setState(prefix, 'error');
      document.getElementById(`dw-${prefix}-error`).textContent = `Could not load Actions: ${e.message}`;
    }
  }

  // ---------- All Actions ----------
  function readAllFilters() {
    // The owner filter has no visible <select> (owners are free-form user
    // ids, not a fixed list) — it only ever arrives via a deep link from
    // the Owners tab (?owner=...) and is carried in the URL, not a form field.
    return {
      q: document.getElementById('dw-f-q').value.trim() || undefined,
      status: document.getElementById('dw-f-status').value || undefined,
      priority: document.getElementById('dw-f-priority').value || undefined,
      risk: document.getElementById('dw-f-risk').value || undefined,
      project: document.getElementById('dw-f-project').value.trim() || undefined,
      department: document.getElementById('dw-f-department').value.trim() || undefined,
      owner: currentParams().owner || undefined,
      overdue: document.getElementById('dw-f-overdue').checked ? 'true' : undefined,
      escalated: document.getElementById('dw-f-escalated').checked ? 'true' : undefined,
      sort: document.getElementById('dw-f-sort').value,
      direction: document.getElementById('dw-f-direction').value,
    };
  }
  function renderActiveFilterChips(filters) {
    const container = document.getElementById('dw-active-filters');
    const labels = { status: 'Status', priority: 'Priority', risk: 'Risk', project: 'Project', department: 'Department', owner: 'Owner', overdue: 'Overdue only', escalated: 'Escalated only', q: 'Search' };
    const chips = Object.entries(filters).filter(([k, v]) => labels[k] && v).map(([k, v]) => `<span class="badge badge-accent" data-clear="${k}">${labels[k]}: ${DW.escapeHtml(v)}</span>`);
    container.innerHTML = chips.join('');
    container.querySelectorAll('[data-clear]').forEach(chip => chip.addEventListener('click', () => {
      const key = chip.dataset.clear;
      if (key === 'overdue') document.getElementById('dw-f-overdue').checked = false;
      else if (key === 'escalated') document.getElementById('dw-f-escalated').checked = false;
      else if (key === 'q') document.getElementById('dw-f-q').value = '';
      else if (key === 'owner') { const p = currentParams(); delete p.owner; history.replaceState({ tab: 'all' }, '', DW.buildQueryString(p)); }
      else { const el = document.getElementById(`dw-f-${key}`); if (el) el.value = ''; }
      loadAllActions(1);
    }));
  }
  function loadAllActions(page) {
    const filters = readAllFilters();
    renderActiveFilterChips(filters);
    const params = currentParams(); params.tab = 'all';
    history.replaceState({ tab: 'all' }, '', DW.buildQueryString(params));
    loadList('all', filters, [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.priority, STD_COLUMNS.risk, STD_COLUMNS.owner, STD_COLUMNS.due, STD_COLUMNS.progress], page, 20);
  }
  ['dw-f-status', 'dw-f-priority', 'dw-f-risk', 'dw-f-sort', 'dw-f-direction'].forEach(id => document.getElementById(id).addEventListener('change', () => loadAllActions(1)));
  ['dw-f-overdue', 'dw-f-escalated'].forEach(id => document.getElementById(id).addEventListener('change', () => loadAllActions(1)));
  let searchDebounce = null;
  document.getElementById('dw-f-q').addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(() => loadAllActions(1), 350); });
  document.getElementById('dw-f-project').addEventListener('change', () => loadAllActions(1));
  document.getElementById('dw-f-department').addEventListener('change', () => loadAllActions(1));
  document.getElementById('dw-f-reset').addEventListener('click', () => {
    ['dw-f-q', 'dw-f-project', 'dw-f-department'].forEach(id => document.getElementById(id).value = '');
    ['dw-f-status', 'dw-f-priority', 'dw-f-risk'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('dw-f-overdue').checked = false;
    document.getElementById('dw-f-escalated').checked = false;
    document.getElementById('dw-f-sort').value = 'last_activity';
    document.getElementById('dw-f-direction').value = 'desc';
    loadAllActions(1);
  });

  // ---------- My Actions ----------
  let currentMineQuick = '';
  function quickFilterToParams(quick) {
    if (quick === 'assigned') return {};
    if (quick === 'in_progress') return { status: 'in_progress' };
    if (quick === 'due_soon') return { due_soon_days: 7 };
    if (quick === 'overdue') return { overdue: 'true' };
    if (quick === 'awaiting_verification') return { status: 'completed' };
    return {};
  }
  function loadMine(quick, page) {
    if (!currentUserId) { setState('mine', 'error'); document.getElementById('dw-mine-error').textContent = 'Your account has no resolvable user id.'; return; }
    loadList('mine', { owner: currentUserId, ...quickFilterToParams(quick) }, [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.priority, STD_COLUMNS.due, STD_COLUMNS.progress], page, 20);
  }
  document.querySelectorAll('.dw-quick-filter').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.dw-quick-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMineQuick = btn.dataset.quick;
    loadMine(currentMineQuick, 1);
  }));

  // ---------- Review Queue ----------
  let currentReviewStatus = 'under_review,needs_clarification';
  function loadReview(statusFilter, page) {
    document.getElementById('dw-review-summary').innerHTML = '<div class="muted-note">Loading queue summary…</div>';
    DW.Api.getReviewQueue().then(summary => {
      if (!summary.available) { document.getElementById('dw-review-summary').innerHTML = '<p class="muted-note">No review-queue data yet.</p>'; return; }
      document.getElementById('dw-review-summary').innerHTML = `
        <div class="card"><div class="card-title">Under Review</div><div class="stat-value">${summary.under_review_count}</div></div>
        <div class="card"><div class="card-title">Needs Clarification</div><div class="stat-value">${summary.needs_clarification_count}</div></div>
        <div class="card"><div class="card-title">Oldest Pending Review</div><div class="stat-value" style="font-size:1rem;">${DW.escapeHtml(summary.oldest_pending_review_at ? DW.formatDateTime(summary.oldest_pending_review_at) : 'None pending')}</div></div>`;
    }).catch(() => { document.getElementById('dw-review-summary').innerHTML = '<p class="muted-note" style="color:var(--danger);">Could not load queue summary.</p>'; });

    // The projection list API filters by a single status; a multi-status
    // "all pending review" view fetches each status and merges client-side
    // (bounded — a review queue is not expected to be page after page deep).
    const statuses = statusFilter.split(',');
    setState('review', 'loading');
    Promise.all(statuses.map(s => DW.Api.listActions({ status: s, limit: 50, offset: 0, sort: 'last_activity', direction: 'asc' })))
      .then(results => {
        const merged = results.flatMap(r => r.actions);
        if (!merged.length) { setState('review', 'empty'); document.getElementById('dw-review-pagination').innerHTML = ''; return; }
        renderRows(document.getElementById('dw-review-tbody'), merged, [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.owner, STD_COLUMNS.priority, STD_COLUMNS.risk, STD_COLUMNS.since]);
        setState('review', 'ok');
        document.getElementById('dw-review-pagination').innerHTML = `<span class="muted-note">${merged.length} Action(s) shown (up to 50 per status)</span>`;
      }).catch(e => { setState('review', 'error'); document.getElementById('dw-review-error').textContent = `Could not load review queue: ${e.message}`; });
  }
  document.querySelectorAll('.dw-review-filter').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.dw-review-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentReviewStatus = btn.dataset.status;
    loadReview(currentReviewStatus, 1);
  }));

  // ---------- Verification Queue ----------
  function loadVerification(page) {
    loadList('verification', { status: 'completed', sort: 'last_activity', direction: 'asc' },
      [STD_COLUMNS.action, STD_COLUMNS.project, STD_COLUMNS.owner, STD_COLUMNS.completed, STD_COLUMNS.priority, STD_COLUMNS.risk], page, 20);
  }

  // ---------- Overdue ----------
  function loadOverdue(page) {
    loadList('overdue', { overdue: 'true', sort: 'due_date', direction: 'asc' },
      [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.due, STD_COLUMNS.daysOverdue, STD_COLUMNS.owner, STD_COLUMNS.priority], page, 20);
  }

  // ---------- Escalated ----------
  function loadEscalated(page) {
    loadList('escalated', { escalated: 'true', sort: 'last_activity', direction: 'desc' },
      [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.escalatedSince, STD_COLUMNS.owner, STD_COLUMNS.priority, STD_COLUMNS.risk], page, 20);
  }

  // ---------- Overview ----------
  function tileHtml(label, value, href) {
    return `<a class="card dw-tile" href="${href}"><div class="card-title">${DW.escapeHtml(label)}</div><div class="stat-value">${value}</div></a>`;
  }
  async function loadOverview() {
    document.getElementById('dw-overview-loading').style.display = 'block';
    document.getElementById('dw-overview-error').style.display = 'none';
    document.getElementById('dw-overview-body').style.display = 'none';
    try {
      const portfolio = await DW.Api.getOrganizationPortfolio();
      document.getElementById('dw-overview-loading').style.display = 'none';
      if (!portfolio.available) {
        document.getElementById('dw-overview-error').style.display = 'block';
        document.getElementById('dw-overview-error').textContent = 'No Actions have been projected for your organization yet.';
        return;
      }
      const tiles = [
        tileHtml('Awaiting Review', portfolio.awaiting_review_count, '/app/decisions.html?tab=review'),
        tileHtml('Awaiting Verification', portfolio.awaiting_verification_count, '/app/decisions.html?tab=verification'),
        tileHtml('Overdue', portfolio.overdue_count, '/app/decisions.html?tab=overdue'),
        tileHtml('Escalated', portfolio.escalated_count, '/app/decisions.html?tab=escalated'),
        tileHtml('High Risk', portfolio.high_risk_count, '/app/decisions.html?tab=all&risk=high'),
        tileHtml('Critical Priority', portfolio.critical_priority_count, '/app/decisions.html?tab=all&priority=critical'),
        tileHtml('Total Actions', portfolio.total_actions, '/app/decisions.html?tab=all'),
        currentUserId ? tileHtml('Assigned to Me', '→', '/app/decisions.html?tab=mine') : '',
      ];
      document.getElementById('dw-overview-tiles').innerHTML = tiles.join('');
      document.getElementById('dw-overview-body').style.display = 'block';

      const recent = await DW.Api.listActions({ sort: 'last_activity', direction: 'desc', limit: 8 });
      renderRows(document.getElementById('dw-recent-tbody'), recent.actions, [STD_COLUMNS.action, STD_COLUMNS.status, STD_COLUMNS.owner, STD_COLUMNS.lastActivity]);
    } catch (e) {
      document.getElementById('dw-overview-loading').style.display = 'none';
      document.getElementById('dw-overview-error').style.display = 'block';
      document.getElementById('dw-overview-error').textContent = `Could not load the portfolio overview: ${e.message}`;
    }
  }

  // ---------- Portfolio ----------
  const AGING_BAND_META = [['0_7', 'band-0-7', '0–7 days'], ['8_30', 'band-8-30', '8–30 days'], ['31_90', 'band-31-90', '31–90 days'], ['90_plus', 'band-90-plus', '90+ days']];
  async function loadPortfolio() {
    document.getElementById('dw-portfolio-loading').style.display = 'block';
    document.getElementById('dw-portfolio-error').style.display = 'none';
    document.getElementById('dw-portfolio-body').style.display = 'none';
    try {
      const [portfolio, executive] = await Promise.all([DW.Api.getOrganizationPortfolio(), DW.Api.getExecutive()]);
      document.getElementById('dw-portfolio-loading').style.display = 'none';
      if (!portfolio.available) { document.getElementById('dw-portfolio-error').style.display = 'block'; document.getElementById('dw-portfolio-error').textContent = 'No portfolio data available yet.'; return; }
      document.getElementById('dw-portfolio-tiles').innerHTML = [
        ['Completion Rate', portfolio.completion_rate == null ? 'N/A' : `${Math.round(portfolio.completion_rate * 1000) / 10}%`],
        ['Verification Rate', portfolio.verification_rate == null ? 'N/A' : `${Math.round(portfolio.verification_rate * 1000) / 10}%`],
        ['Verified', portfolio.verified_count],
        ['Cancelled', portfolio.cancelled_count],
      ].map(([label, value]) => `<div class="card"><div class="card-title">${DW.escapeHtml(label)}</div><div class="stat-value" style="font-size:1.6rem;">${value}</div></div>`).join('');

      const totalAging = Object.values(portfolio.aging_bands || {}).reduce((a, b) => a + b, 0) || 1;
      document.getElementById('dw-aging-bar').innerHTML = AGING_BAND_META.map(([key, cls]) => `<span class="${cls}" style="width:${((portfolio.aging_bands[key] || 0) / totalAging) * 100}%"></span>`).join('');
      document.getElementById('dw-aging-legend').innerHTML = AGING_BAND_META.map(([key, cls, label]) => `<span class="${cls}">${label}: ${portfolio.aging_bands[key] || 0}</span>`).join('');

      const trendEl = document.getElementById('dw-trend-body');
      if (!executive.available || !executive.trend?.available) {
        trendEl.textContent = 'Trend not yet available — a prior daily snapshot is required before a comparison can be shown.';
      } else {
        trendEl.innerHTML = `Compared to ${DW.escapeHtml(executive.trend.compared_to_date)}: overdue count changed by <strong>${executive.trend.overdue_count_delta > 0 ? '+' : ''}${executive.trend.overdue_count_delta}</strong>` +
          (executive.trend.verification_rate_delta != null ? `, verification rate changed by <strong>${executive.trend.verification_rate_delta > 0 ? '+' : ''}${Math.round(executive.trend.verification_rate_delta * 1000) / 10}pp</strong>` : '') + '.';
      }
      document.getElementById('dw-portfolio-body').style.display = 'block';
    } catch (e) {
      document.getElementById('dw-portfolio-loading').style.display = 'none';
      document.getElementById('dw-portfolio-error').style.display = 'block';
      document.getElementById('dw-portfolio-error').textContent = `Could not load the portfolio: ${e.message}`;
    }
  }
  document.getElementById('dw-project-lookup-btn').addEventListener('click', async () => {
    const projectId = document.getElementById('dw-project-lookup-input').value.trim();
    const resultEl = document.getElementById('dw-project-lookup-result');
    if (!projectId) { resultEl.textContent = 'Enter a project ID above to see its portfolio.'; return; }
    resultEl.textContent = 'Loading…';
    try {
      const p = await DW.Api.getProjectPortfolio(projectId);
      resultEl.innerHTML = !p.available ? 'No Actions projected yet for this project.' :
        `Total: <strong>${p.total_actions}</strong> · Overdue: <strong>${p.overdue_count}</strong> · Escalated: <strong>${p.escalated_count}</strong> · Awaiting Review: <strong>${p.awaiting_review_count}</strong> · Awaiting Verification: <strong>${p.awaiting_verification_count}</strong> · Verified: <strong>${p.verified_count}</strong>`;
    } catch (e) { resultEl.textContent = `Could not load project portfolio: ${e.message}`; }
  });

  // ---------- Owners ----------
  async function loadOwners() {
    document.getElementById('dw-owners-loading').style.display = 'block';
    document.getElementById('dw-owners-error').style.display = 'none';
    document.getElementById('dw-owners-empty').style.display = 'none';
    document.getElementById('dw-owners-table-wrap').style.display = 'none';
    try {
      const { owners } = await DW.Api.listOwners({ limit: 100 });
      document.getElementById('dw-owners-loading').style.display = 'none';
      if (!owners.length) { document.getElementById('dw-owners-empty').style.display = 'block'; return; }
      const tbody = document.getElementById('dw-owners-tbody');
      tbody.innerHTML = owners.map(o => `
        <tr class="dw-action-row" data-owner="${DW.escapeHtml(o.owner)}" tabindex="0" role="button">
          <td data-label="Owner">${DW.escapeHtml(o.owner_display_name || `${o.owner} (unresolved)`)}</td>
          <td data-label="Assigned">${o.assigned_count}</td>
          <td data-label="In Progress">${o.in_progress_count}</td>
          <td data-label="Overdue">${o.overdue_count}</td>
          <td data-label="Due Soon">${o.due_soon_count}</td>
          <td data-label="Awaiting Verification">${o.awaiting_verification_count}</td>
        </tr>`).join('');
      tbody.querySelectorAll('tr[data-owner]').forEach(tr => {
        const go = () => { location.href = `/app/decisions.html?tab=all&owner=${encodeURIComponent(tr.dataset.owner)}`; };
        tr.addEventListener('click', go);
        tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      document.getElementById('dw-owners-table-wrap').style.display = 'block';
    } catch (e) {
      document.getElementById('dw-owners-loading').style.display = 'none';
      document.getElementById('dw-owners-error').style.display = 'block';
      document.getElementById('dw-owners-error').textContent = `Could not load owner workload: ${e.message}`;
    }
  }

  // Deep-link support (Part 4: stable URL params) — status/priority/risk
  // are applied to their real <select> controls; owner (free-form, no
  // dedicated input) is read directly from the URL inside readAllFilters().
  const initialParams = currentParams();
  if (initialParams.status) statusSelect.value = initialParams.status;
  if (initialParams.priority) document.getElementById('dw-f-priority').value = initialParams.priority;
  if (initialParams.risk) document.getElementById('dw-f-risk').value = initialParams.risk;

  activateTab(initialParams.tab || 'overview', { skipHistory: true });
})();
