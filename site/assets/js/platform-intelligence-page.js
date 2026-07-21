/* VoiceInsights Africa — Platform Intelligence page controller
   (platform-intelligence.html). Product Experience Evolution Phase 1.
   Depends on config.js, safe-dom.js, app.js, and decision-workspace.js
   having already loaded. */
(function () {
  'use strict';
  if (!requireLogin()) return;

  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const role = storedUser?.role || '';

  if (!DW.roleHasPermission(role, 'action.read')) {
    renderShell({ role: 'client', active: '/app/platform-intelligence.html', title: 'Platform Intelligence' });
    document.getElementById('pi-denied').style.display = 'flex';
    return;
  }

  renderShell({ role: 'client', active: '/app/platform-intelligence.html', eyebrow: 'Program Beta', title: 'Platform Intelligence' });
  document.getElementById('pi-root').style.display = 'block';

  const esc = DW.escapeHtml;
  const SEVERITY_BADGE = { critical: 'badge-danger', high: 'badge-warn', medium: 'badge-neutral', low: 'badge-neutral' };

  // ============================================================
  // Tabs
  // ============================================================
  const TABS = ['recommendations', 'rootcause', 'simulator', 'forecast', 'memory', 'graph', 'narrative'];
  const loadedTabs = new Set();
  function activateTab(tabName) {
    if (!TABS.includes(tabName)) tabName = 'recommendations';
    document.querySelectorAll('#pi-tabs .tab').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('#pi-root .tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));
    ensureTabLoaded(tabName);
  }
  document.querySelectorAll('#pi-tabs .tab').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  function ensureTabLoaded(tabName) {
    if (loadedTabs.has(tabName)) return;
    loadedTabs.add(tabName);
    ({
      recommendations: loadRecommendations, forecast: loadForecast,
      rootcause: populateActionPickers, memory: populateActionPickers, graph: populateActionPickers,
    }[tabName] || (() => {}))();
  }

  // ============================================================
  // Executive Copilot
  // ============================================================
  const SUGGESTED_QUESTIONS = [
    'Why are projects delayed?', 'Compare departments', 'Compare projects', 'Summarize major risks',
    'Explain overdue actions', 'Identify bottlenecks', 'Identify strongest programmes', 'Identify weakest programmes',
    'Show where leadership intervention is required',
  ];
  const suggestionsEl = document.getElementById('pi-suggestions');
  suggestionsEl.innerHTML = SUGGESTED_QUESTIONS.map(q => `<button type="button" class="pi-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  suggestionsEl.querySelectorAll('.pi-chip').forEach(chip => chip.addEventListener('click', () => { askCopilot(chip.dataset.q); }));

  const thread = document.getElementById('pi-copilot-thread');
  document.getElementById('pi-copilot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('pi-copilot-input');
    const q = input.value.trim();
    if (!q) return;
    askCopilot(q);
    input.value = '';
  });

  async function askCopilot(question) {
    const card = document.createElement('div');
    card.className = 'pi-answer-card';
    card.innerHTML = `<div class="pi-question">"${esc(question)}"</div><div class="muted-note">Thinking…</div>`;
    thread.prepend(card);
    let result;
    try {
      result = await DW.Api.askCopilot(question);
    } catch (e) {
      card.querySelector('.muted-note').textContent = `Could not reach the Copilot: ${e.message}`;
      return;
    }
    renderCopilotAnswer(card, result);
  }

  function renderCopilotAnswer(card, result) {
    if (!result.matched) {
      card.innerHTML = `
        <div class="pi-question">"${esc(result.question)}"</div>
        <div class="pi-answer-body pi-answer-unmatched">${esc(result.answer_text)}</div>
        <div class="badge badge-neutral">Confidence: none</div>
      `;
      return;
    }
    card.innerHTML = `
      <div class="pi-question">"${esc(result.question)}"</div>
      <div class="pi-answer-body">${esc(result.answer_text).replace(/\n/g, '<br>')}</div>
      <div class="pi-answer-meta">
        <span class="badge badge-neutral">Confidence: ${esc(result.confidence)}</span>
        <span class="pi-source">Source: ${esc(result.source)}</span>
      </div>
      ${result.affected_projects?.length ? `<div class="pi-answer-tags"><strong>Affected projects:</strong> ${result.affected_projects.map(esc).join(', ')}</div>` : ''}
      ${result.affected_indicators?.length ? `<div class="pi-answer-tags"><strong>Affected indicators:</strong> ${result.affected_indicators.map(esc).join(', ')}</div>` : ''}
      ${result.recommended_actions?.length ? `<div class="pi-answer-recs"><strong>Recommended actions:</strong><ul>${result.recommended_actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <details class="pi-evidence-details"><summary>Evidence (${result.evidence.length})</summary><pre class="pi-evidence-json">${esc(JSON.stringify(result.evidence, null, 2))}</pre></details>
    `;
  }

  // ============================================================
  // Recommendation Engine
  // ============================================================
  async function loadRecommendations() {
    let result;
    try { result = await DW.Api.getRecommendations(); } catch (e) { document.getElementById('pi-rec-loading').textContent = `Failed to load: ${e.message}`; return; }
    document.getElementById('pi-rec-loading').style.display = 'none';
    if (!result.recommendations.length) { document.getElementById('pi-rec-empty').style.display = 'block'; return; }
    const list = document.getElementById('pi-rec-list');
    list.style.display = 'block';
    list.innerHTML = result.recommendations.map(r => `
      <li class="ei-insight-item ei-severity-${esc(r.severity)}">
        <div class="ei-insight-top">
          <span class="badge ${SEVERITY_BADGE[r.severity] || 'badge-neutral'}">${esc(r.priority)}</span>
          <span class="ei-insight-rule">${esc(r.rule_id)} &middot; urgency: ${esc(r.urgency)}</span>
        </div>
        <p class="ei-insight-message">${esc(r.decision_required)}</p>
        <p class="ei-insight-why"><strong>Expected impact of inaction:</strong> ${esc(r.consequence_of_inaction)}</p>
        <p class="ei-insight-why"><strong>Dependencies:</strong> ${esc(r.dependencies)}</p>
        <p class="ei-insight-why"><strong>Evidence:</strong> ${esc(r.supporting_evidence)}</p>
        ${r.link ? `<a class="btn btn-ghost btn-sm" href="${esc(r.link)}">Open</a>` : ''}
      </li>
    `).join('');
  }

  // ============================================================
  // Shared Action picker (Root Cause / Memory / Knowledge Graph)
  // ============================================================
  async function populateActionPickers() {
    let result;
    try { result = await DW.Api.listActions({ limit: 30, sort: 'last_activity', direction: 'desc' }); } catch (e) { return; }
    const options = (result.actions || []).map(a => `<option value="${esc(a.action_id)}">${esc(a.recommendation || a.action_id)} (${esc(a.status)})</option>`).join('');
    ['pi-rootcause-select', 'pi-memory-select', 'pi-graph-select'].forEach(id => {
      const select = document.getElementById(id);
      select.innerHTML = `<option value="">Choose an Action…</option>${options}`;
    });
  }

  // ============================================================
  // Root Cause Intelligence
  // ============================================================
  document.getElementById('pi-rootcause-run').addEventListener('click', async () => {
    const actionId = document.getElementById('pi-rootcause-select').value;
    const out = document.getElementById('pi-rootcause-result');
    if (!actionId) { out.innerHTML = '<p class="muted-note">Choose an Action first.</p>'; return; }
    out.innerHTML = '<p class="muted-note">Diagnosing…</p>';
    const result = await DW.Api.getRootCause(actionId);
    if (!result.ok) { out.innerHTML = `<p class="muted-note">${esc(result.error || 'Not found')}</p>`; return; }
    out.innerHTML = `
      <h3 class="card-title">${esc(result.recommendation)}</h3>
      ${result.likely_causes.length ? `<ul class="ei-insight-list">${result.likely_causes.map(c => `<li class="ei-insight-item"><strong>${esc(c.label)}</strong><p class="ei-insight-why">${esc(c.evidence)}</p></li>`).join('')}</ul>` : '<p class="muted-note">No correlating factor found.</p>'}
      <p class="pi-disclosure">${esc(result.disclosure)}</p>
    `;
  });

  // ============================================================
  // Decision Simulator
  // ============================================================
  const overdueSlider = document.getElementById('pi-sim-overdue');
  overdueSlider.addEventListener('input', () => { document.getElementById('pi-sim-overdue-value').textContent = `${overdueSlider.value}%`; });
  document.getElementById('pi-sim-run').addEventListener('click', async () => {
    const out = document.getElementById('pi-sim-result');
    out.innerHTML = '<p class="muted-note">Running…</p>';
    const result = await DW.Api.simulateScenario({ overdue_reduction_pct: Number(overdueSlider.value) });
    if (!result.available) { out.innerHTML = `<p class="muted-note">${esc(result.reason)}</p>`; return; }
    out.innerHTML = `
      <div class="pi-sim-compare">
        <div><h4>Measured (today)</h4><div class="ei-kpi-tile"><div class="ei-kpi-value">${esc(result.measured.overdue_count)}</div><div class="ei-kpi-label">Overdue Actions</div></div></div>
        <div><h4>Estimated (under hypothesis)</h4><div class="ei-kpi-tile"><div class="ei-kpi-value">${esc(result.estimated.overdue_count)}</div><div class="ei-kpi-label">Overdue Actions</div></div></div>
      </div>
      <p class="ei-insight-why">${esc(result.estimated.escalation_risk_note)}</p>
      <p class="pi-disclosure">${esc(result.disclosure)}</p>
    `;
  });

  // ============================================================
  // Impact Forecasting
  // ============================================================
  async function loadForecast() {
    const result = await DW.Api.getForecast({});
    document.getElementById('pi-forecast-loading').style.display = 'none';
    if (!result.available) { document.getElementById('pi-forecast-unavailable').style.display = 'block'; document.getElementById('pi-forecast-unavailable').textContent = result.reason; return; }
    const out = document.getElementById('pi-forecast-result');
    out.style.display = 'block';
    out.innerHTML = `
      <div class="pi-sim-compare">
        <div><h4>Measured (as of ${esc(result.measured.as_of)})</h4><div class="ei-kpi-tile"><div class="ei-kpi-value">${esc(result.measured.overdue_count)}</div><div class="ei-kpi-label">Overdue Actions</div></div></div>
        <div><h4>Projected (+${esc(result.projected.in_days)} days)</h4><div class="ei-kpi-tile"><div class="ei-kpi-value">${esc(result.projected.overdue_count)}</div><div class="ei-kpi-label">Overdue Actions</div></div></div>
      </div>
      <p class="pi-disclosure">${esc(result.assumptions)}</p>
    `;
  }

  // ============================================================
  // Institutional Memory
  // ============================================================
  document.getElementById('pi-memory-run').addEventListener('click', async () => {
    const actionId = document.getElementById('pi-memory-select').value;
    const out = document.getElementById('pi-memory-result');
    if (!actionId) { out.innerHTML = '<p class="muted-note">Choose an Action first.</p>'; return; }
    out.innerHTML = '<p class="muted-note">Searching…</p>';
    const result = await DW.Api.getSimilarActions(actionId);
    if (!result.ok) { out.innerHTML = `<p class="muted-note">Not found.</p>`; return; }
    out.innerHTML = result.similar_actions.length
      ? `<ul class="ei-insight-list">${result.similar_actions.map(s => `<li class="ei-insight-item"><strong>${esc(s.recommendation)}</strong><p class="ei-insight-why">Matched on: ${s.matched_on.map(esc).join(', ')} &middot; Outcome: ${esc(s.status)}${s.completion_date ? ' on ' + esc(s.completion_date.slice(0, 10)) : ''}</p></li>`).join('')}</ul>`
      : '<p class="muted-note">No similar resolved Action found.</p>';
    out.innerHTML += `<p class="pi-disclosure">${esc(result.disclosure)}</p>`;
  });

  // ============================================================
  // Knowledge Graph — lightweight radial SVG, real nodes/edges only.
  // ============================================================
  const NODE_COLOR = { action: 'var(--accent)', project: 'var(--accent-2)', person: 'var(--success)', strategic_priority: 'var(--warn)', report: 'var(--text-dim)', event: 'var(--border-strong)', evidence: 'var(--danger)' };
  document.getElementById('pi-graph-run').addEventListener('click', async () => {
    const actionId = document.getElementById('pi-graph-select').value;
    const out = document.getElementById('pi-graph-result');
    if (!actionId) { out.innerHTML = '<p class="muted-note">Choose an Action first.</p>'; return; }
    out.innerHTML = '<p class="muted-note">Loading graph…</p>';
    const result = await DW.Api.getKnowledgeGraph(actionId);
    if (!result.ok) { out.innerHTML = '<p class="muted-note">Not found.</p>'; return; }
    out.innerHTML = renderKnowledgeGraphSvg(result);
  });

  function renderKnowledgeGraphSvg(graph) {
    const focusId = graph.nodes[0]?.id;
    const others = graph.nodes.filter(n => n.id !== focusId);
    const cx = 300, cy = 220, radius = 160;
    const positions = { [focusId]: { x: cx, y: cy } };
    others.forEach((n, i) => {
      const angle = (i / Math.max(1, others.length)) * 2 * Math.PI;
      positions[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
    const edgesSvg = graph.edges.map(e => {
      const a = positions[e.from], b = positions[e.to];
      if (!a || !b) return '';
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--border-strong)" stroke-width="1.5" /><text x="${midX}" y="${midY}" font-size="9" fill="var(--text-dim)">${esc(e.label)}</text>`;
    }).join('');
    const nodesSvg = graph.nodes.map(n => {
      const p = positions[n.id]; if (!p) return '';
      const r = n.id === focusId ? 14 : 9;
      return `<g><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${NODE_COLOR[n.type] || 'var(--text-dim)'}" /><text x="${p.x}" y="${p.y + r + 12}" font-size="10" fill="var(--text)" text-anchor="middle">${esc(String(n.label).slice(0, 22))}</text></g>`;
    }).join('');
    const legend = [...new Set(graph.nodes.map(n => n.type))].map(t => `<span class="pi-graph-legend-item"><i style="background:${NODE_COLOR[t] || 'var(--text-dim)'};"></i>${esc(t.replace(/_/g, ' '))}</span>`).join('');
    return `
      <svg viewBox="0 0 600 440" class="pi-graph-svg" role="img" aria-label="Knowledge graph for ${esc(graph.focus_action_id)}">${edgesSvg}${nodesSvg}</svg>
      <div class="pi-graph-legend">${legend}</div>
    `;
  }

  // ============================================================
  // Executive Narrative Generator
  // ============================================================
  document.getElementById('pi-narrative-run').addEventListener('click', async () => {
    const audience = document.getElementById('pi-narrative-audience').value;
    const out = document.getElementById('pi-narrative-result');
    out.innerHTML = '<p class="muted-note">Generating…</p>';
    const result = await DW.Api.getNarrative(audience);
    if (!result.ok) { out.innerHTML = `<p class="muted-note">${esc(result.error)}</p>`; return; }
    if (!result.available) { out.innerHTML = `<p class="muted-note">${esc(result.reason)}</p>`; return; }
    out.innerHTML = `
      <h3 class="card-title">${esc(result.label)}</h3>
      ${result.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
      <p class="pi-disclosure">${esc(result.disclosure)}</p>
    `;
  });

  // Kick off: recommendations tab is active by default.
  ensureTabLoaded('recommendations');
})();
