// ============================================================
// EXECUTIVE INFOGRAPHIC ENGINE — Reusable Component Library (Phase 16)
// ------------------------------------------------------------
// Every function here takes the SAME infographic-data JSON (from
// GET /api/reports/:id/infographic-data or the public equivalent) and
// returns an HTML string. These functions are used identically by:
//   - app/report-viewer.html (internal, authenticated)
//   - sample-report-viewer.html (public showcase)
// The same markup that renders on the website is what gets printed to
// PDF (browser print) — one component library, not duplicated per output.
//
// ACCESSIBILITY: traffic-light indicators always pair color with a text
// label (never color alone, per WCAG 2.2). Palette follows the
// colorblind-safe Okabe-Ito set. All SVG elements include <title> for
// screen readers. Uses only the existing CSS custom-property design
// tokens (var(--accent) etc.) already confirmed dark-mode-compatible.
// ============================================================
(function() {

const CB_SAFE = { blue: '#0072B2', orange: '#E69F00', green: '#009E73', vermillion: '#D55E00', purple: '#CC79A7', yellow: '#F0E442' };
const TRAFFIC = { red: { color: CB_SAFE.vermillion, label: 'High' }, amber: { color: CB_SAFE.orange, label: 'Medium' }, green: { color: CB_SAFE.green, label: 'Low' } };

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function notAvailableBadge(field) {
  if (!field || field.available !== false) return null;
  return `<span class="ig-unavailable" title="${esc(field.reason)}">Not collected in this survey</span>`;
}

// ---------- 1. COVER ----------
function renderCover(d) {
  const c = d.cover;
  return `
  <section class="ig-page ig-cover" aria-label="Executive Dashboard Cover">
    ${c.is_demo ? '<div class="ig-demo-banner">📋 Demonstration Report — demo data only</div>' : ''}
    <div class="ig-cover-inner">
      ${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="${esc(c.organization_name)} logo" class="ig-logo">` : ''}
      <div class="ig-eyebrow">${esc(c.country || '')}</div>
      <h1 class="ig-title">${esc(c.report_type)}</h1>
      <p class="ig-subtitle">${esc(c.project || '')}</p>
      <div class="ig-cover-stats">
        <div><strong>${c.respondents}</strong><span>Respondents</span></div>
        <div><strong>${c.completion_rate_pct ?? '—'}%</strong><span>Completion Rate</span></div>
        <div><strong>${c.response_rate_pct ?? '—'}%</strong><span>Response Rate</span></div>
      </div>
      <p class="ig-generated">Generated ${new Date(c.generated_date).toLocaleDateString()}</p>
    </div>
  </section>`;
}

// ---------- 2. KPI PAGE ----------
function kpiCard(value, label, unavailable) {
  if (unavailable) return `<div class="ig-kpi-card ig-kpi-na"><span class="ig-kpi-label">${esc(label)}</span>${notAvailableBadge(unavailable)}</div>`;
  return `<div class="ig-kpi-card"><span class="ig-kpi-value">${esc(value)}</span><span class="ig-kpi-label">${esc(label)}</span></div>`;
}
function renderKpiPage(d) {
  const k = d.kpi_page;
  return `
  <section class="ig-page" aria-label="Executive KPI Page">
    <h2 class="ig-section-title">At a Glance</h2>
    <div class="ig-kpi-grid">
      ${kpiCard(k.total_respondents, 'Total Respondents')}
      ${kpiCard(k.female, 'Female')}
      ${kpiCard(k.male, 'Male')}
      ${kpiCard(k.youth_18_25, 'Youth (18-25)')}
      ${kpiCard(null, 'Average Age', k.average_age)}
      ${kpiCard(k.completion_rate_pct + '%', 'Completion Rate')}
      ${kpiCard(null, 'NPS', k.nps)}
      ${kpiCard(null, 'CSAT', k.csat)}
      ${kpiCard(k.sentiment_positive_pct + '%', 'Positive Sentiment')}
      ${kpiCard(k.data_quality_score, 'Data Quality Score')}
    </div>
  </section>`;
}

// ---------- 3. GEOGRAPHIC INTELLIGENCE ----------
function renderGeographic(d) {
  const g = d.geographic_intelligence;
  const max = Math.max(1, ...g.regional_coverage.map(r => r.responses));
  return `
  <section class="ig-page" aria-label="Geographic Intelligence">
    <h2 class="ig-section-title">Geographic Intelligence</h2>
    <p class="ig-disclosure">${esc(g.map_type_disclosure)}</p>
    <div class="ig-bar-list">
      ${g.regional_coverage.map(r => `
        <div class="ig-bar-row">
          <span class="ig-bar-label">${esc(r.region)}</span>
          <div class="ig-bar-track"><div class="ig-bar-fill" style="width:${Math.round((r.responses / max) * 100)}%"></div></div>
          <span class="ig-bar-value">${r.responses} (${r.pct_of_total}%)</span>
        </div>`).join('')}
    </div>
    <div class="ig-two-col">
      <div><h3>Top Performing Areas</h3><ol>${g.top_performing_areas.map(r => `<li>${esc(r.label)} — ${r.n}</li>`).join('')}</ol></div>
      <div><h3>Lowest Coverage Areas</h3><ol>${g.lowest_performing_areas.map(r => `<li>${esc(r.label)} — ${r.n}</li>`).join('')}</ol></div>
    </div>
  </section>`;
}

// ---------- 4. DEMOGRAPHIC INTELLIGENCE ----------
function demoBlock(title, rows) {
  if (rows?.available === false) return `<div class="ig-demo-block"><h3>${esc(title)}</h3>${notAvailableBadge(rows)}</div>`;
  if (!rows?.length) return '';
  const total = rows.reduce((s, r) => s + r.n, 0);
  return `<div class="ig-demo-block"><h3>${esc(title)}</h3><ul class="ig-demo-list">${rows.map(r => `<li>${esc(r.label)}: <strong>${r.n}</strong> (${total ? Math.round((r.n / total) * 100) : 0}%)</li>`).join('')}</ul></div>`;
}
function renderDemographic(d) {
  const dem = d.demographic_intelligence;
  return `
  <section class="ig-page" aria-label="Demographic Intelligence">
    <h2 class="ig-section-title">Respondent Demographics</h2>
    <div class="ig-demo-grid">
      ${demoBlock('Gender', dem.gender)}
      ${demoBlock('Age', dem.age)}
      ${demoBlock('Education', dem.education)}
      ${demoBlock('Occupation', dem.occupation)}
      ${demoBlock('Income', dem.income)}
      ${demoBlock('Disability', dem.disability)}
      ${demoBlock('Household Size', dem.household_size)}
      ${demoBlock('Urban vs Rural', dem.urban_vs_rural)}
    </div>
  </section>`;
}

// ---------- 5. PARTICIPATION ----------
function renderParticipation(d) {
  const p = d.participation;
  return `
  <section class="ig-page" aria-label="Survey Participation">
    <h2 class="ig-section-title">Survey Participation</h2>
    <div class="ig-funnel">
      ${p.response_funnel.map((f, i) => `<div class="ig-funnel-stage" style="width:${100 - i * 20}%"><span>${esc(f.stage)}</span><strong>${f.count}</strong></div>`).join('')}
    </div>
    <p>Completion rate: <strong>${p.completion_rate_pct}%</strong> · Drop-off: <strong>${p.drop_off_count}</strong> (${p.drop_off_pct}%)</p>
    <div class="ig-two-col">
      <div>${notAvailableBadge(p.enumerator_productivity) || ''} <span class="ig-inline-label">Enumerator Productivity</span></div>
      <div>${notAvailableBadge(p.interview_duration) || ''} <span class="ig-inline-label">Interview Duration</span></div>
    </div>
  </section>`;
}

// ---------- 6. EXECUTIVE FINDINGS ----------
function renderFindings(d) {
  const findings = d.executive_findings;
  if (!findings.length) return '';
  return `
  <section class="ig-page" aria-label="Executive Findings">
    <h2 class="ig-section-title">Executive Findings</h2>
    <div class="ig-card-grid">
      ${findings.map(f => `
        <div class="ig-finding-card">
          <div class="ig-finding-icon" aria-hidden="true">${f.icon}</div>
          <p class="ig-finding-headline">${esc(f.headline)}</p>
          ${f.evidence ? `<p class="ig-finding-evidence">Evidence: ${esc(f.evidence)}</p>` : ''}
          ${f.sdg_link ? `<div class="ig-badge-row">${f.sdg_link.map(s => `<span class="ig-badge">${esc(s)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}
    </div>
  </section>`;
}

// ---------- 7. RISK DASHBOARD ----------
function renderRiskDashboard(d) {
  const r = d.risk_dashboard;
  const t = TRAFFIC[r.overall_traffic_light];
  return `
  <section class="ig-page" aria-label="Risk Dashboard">
    <h2 class="ig-section-title">Risk Dashboard</h2>
    <div class="ig-severity-gauge">
      <span class="ig-traffic-dot" style="background:${t.color}" aria-hidden="true"></span>
      <span class="ig-traffic-text">Overall Risk: <strong>${t.label}</strong> (${r.overall_severity_pct}% severity basis)</span>
    </div>
    <p class="ig-disclosure">${esc(r.basis)}</p>
    <div class="ig-risk-matrix">
      ${r.risk_matrix.map(item => {
        const tl = TRAFFIC[item.traffic_light];
        return `<div class="ig-risk-row"><span class="ig-traffic-dot" style="background:${tl.color}" aria-hidden="true"></span><span class="ig-traffic-text-sm">${tl.label} priority</span><p>${esc(item.description)}</p></div>`;
      }).join('')}
    </div>
  </section>`;
}

// ---------- 8. RECOMMENDATION DASHBOARD ----------
function renderRecommendationDashboard(d) {
  const r = d.recommendation_dashboard;
  const tiers = ['Immediate', '30-90 Day', '6-12 Month'];
  return `
  <section class="ig-page" aria-label="Recommendation Dashboard">
    <h2 class="ig-section-title">Recommendation Dashboard</h2>
    <p class="ig-disclosure">${esc(r.note)}</p>
    ${tiers.map(tier => {
      const items = r.items.filter(i => i.tier_label === tier);
      if (!items.length) return '';
      return `<h3 class="ig-tier-heading">${tier}</h3><div class="ig-rec-list">${items.map(i => `
        <div class="ig-rec-card">
          <p>${esc(i.action)}</p>
          <div class="ig-badge-row">
            <span class="ig-badge">Priority: ${esc(i.priority)}</span>
            <span class="ig-badge">Owner: ${esc(i.owner)}</span>
            <span class="ig-badge">Difficulty: ${esc(i.difficulty)}</span>
            ${i.sdg_alignment ? i.sdg_alignment.map(s => `<span class="ig-badge">${esc(s)}</span>`).join('') : ''}
          </div>
        </div>`).join('')}</div>`;
    }).join('')}
  </section>`;
}

// ---------- 9. SDG DASHBOARD ----------
function renderSdgDashboard(d) {
  const s = d.sdg_dashboard;
  return `
  <section class="ig-page" aria-label="SDG Dashboard">
    <h2 class="ig-section-title">SDG Alignment</h2>
    ${s.applicable ? `<div class="ig-badge-row">${s.sdg_tags.map(t => `<span class="ig-badge ig-badge-lg">${esc(t)}</span>`).join('')}</div>` : ''}
    <p class="ig-disclosure">${esc(s.note)}</p>
  </section>`;
}

// ---------- 10. QUALITY DASHBOARD ----------
function renderQualityDashboard(d) {
  const q = d.quality_dashboard;
  const dims = [
    ['Survey Quality', q.survey_quality], ['AI Confidence', q.ai_confidence], ['Evidence Coverage', q.evidence_coverage],
    ['Narrative Coverage', q.narrative_coverage], ['Data Completeness', q.data_completeness],
  ];
  return `
  <section class="ig-page" aria-label="Quality Dashboard">
    <h2 class="ig-section-title">Quality Dashboard</h2>
    <div class="ig-kpi-grid">${dims.map(([label, val]) => kpiCard(val, label)).join('')}</div>
    <p><strong>Representativeness:</strong> ${esc(q.representativeness.value)}</p>
    <p class="ig-disclosure">${esc(q.representativeness.note)}</p>
  </section>`;
}

// ---------- 11. QUOTE INTELLIGENCE ----------
function renderQuoteIntelligence(d) {
  const quotes = d.quote_intelligence;
  if (!quotes.length) return '';
  return `
  <section class="ig-page" aria-label="Quote Intelligence">
    <h2 class="ig-section-title">What Respondents Said</h2>
    <div class="ig-card-grid">
      ${quotes.slice(0, 6).map(q => `
        <blockquote class="ig-quote-card">
          <p>"${esc(q.quote)}"</p>
          <footer>${q.sentiment ? esc(q.sentiment) : ''} ${q.channel ? '· ' + esc(q.channel) : ''}</footer>
        </blockquote>`).join('')}
    </div>
  </section>`;
}

// ---------- 12+13. TREND & BENCHMARK ----------
function renderTrendAndBenchmark(d) {
  const t = d.trend_intelligence, b = d.benchmark_dashboard;
  return `
  <section class="ig-page" aria-label="Trend and Benchmark Intelligence">
    <h2 class="ig-section-title">Trend & Benchmark Intelligence</h2>
    <div class="ig-two-col">
      <div>
        <h3>Trend</h3>
        ${t.available === false ? notAvailableBadge(t) : `<p>Previous campaign: ${t.previous_campaign ? esc(t.previous_campaign.name) + ' — ' + t.previous_campaign.total_responses + ' responses' : 'None yet'}</p><p>Same period last year: ${t.same_period_last_year?.total_responses ?? 0} responses</p>${notAvailableBadge(t.forecast) || ''}`}
      </div>
      <div>
        <h3>Benchmark</h3>
        ${b.available === false ? notAvailableBadge(b) : `<p>Org average: ${b.organization_average?.avg_responses_per_campaign ?? '—'} responses/campaign</p><p>Sector average: ${b.sector_average?.available === false ? esc(b.sector_average.reason) : (b.sector_average?.avg_responses_per_campaign ?? '—')}</p>`}
      </div>
    </div>
  </section>`;
}

// ---------- 14. AI INSIGHT CARDS ----------
function renderAiInsightCards(d) {
  const cards = d.ai_insight_cards;
  if (!cards.length) return '';
  return `
  <section class="ig-page" aria-label="AI Insight Cards">
    <h2 class="ig-section-title">AI Insight Cards</h2>
    <div class="ig-card-grid">
      ${cards.map(c => `<div class="ig-insight-card"><span class="ig-badge">${esc(c.category)}</span><p>${esc(c.insight)}</p></div>`).join('')}
    </div>
  </section>`;
}

// ---------- 15. EXECUTIVE CLOSING PAGE ----------
function renderClosingPage(d) {
  const c = d.closing_page;
  return `
  <section class="ig-page ig-closing" aria-label="Executive Closing Page">
    <h2 class="ig-section-title">Closing Summary</h2>
    <div class="ig-kpi-grid"><div class="ig-kpi-card"><span class="ig-kpi-value">${c.overall_score}</span><span class="ig-kpi-label">Overall Score</span></div></div>
    <div class="ig-two-col">
      <div><h3>Top Achievements</h3><ul>${c.top_achievements.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
      <div><h3>Priority Risks</h3><ul>${c.priority_risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    </div>
    <h3>Next Steps</h3><ul>${c.next_steps.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    ${c.contact ? `<p>Contact: ${esc(c.contact)}</p>` : ''}
    ${c.qr_target_url ? `<div id="ig-qr-container" data-qr-url="${esc(c.qr_target_url)}"></div>` : ''}
  </section>`;
}

// ---------- MASTER RENDER ----------
function renderFullInfographic(d) {
  return [
    renderCover(d), renderKpiPage(d), renderGeographic(d), renderDemographic(d), renderParticipation(d),
    renderFindings(d), renderRiskDashboard(d), renderRecommendationDashboard(d), renderSdgDashboard(d),
    renderQualityDashboard(d), renderQuoteIntelligence(d), renderTrendAndBenchmark(d), renderAiInsightCards(d),
    renderClosingPage(d),
  ].join('\n');
}


window.IgComponents = {
  renderCover, renderKpiPage, renderGeographic, renderDemographic, renderParticipation,
  renderFindings, renderRiskDashboard, renderRecommendationDashboard, renderSdgDashboard,
  renderQualityDashboard, renderQuoteIntelligence, renderTrendAndBenchmark, renderAiInsightCards,
  renderClosingPage, renderFullInfographic,
};
})();
