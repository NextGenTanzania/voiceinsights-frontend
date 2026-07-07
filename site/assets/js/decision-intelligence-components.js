// ============================================================
// EXECUTIVE DECISION INTELLIGENCE — Reusable Component Library (Phase 17)
// ------------------------------------------------------------
// Additive to, never a replacement of, infographic-components.js
// (Phase 16). Renders the Decision Cards, Decision Dashboard (Top 10s),
// Board Mode, Meeting Mode, and Action Matrix data from the Phase 17
// backend endpoints. Same design-token CSS, same accessibility
// discipline (color+text for risk levels, ARIA labels) as Phase 16.
// ============================================================

(function() {

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const RISK_COLOR = { Critical: '#D55E00', High: '#E69F00', Medium: '#F0E442', Low: '#009E73' };

function renderDecisionCard(c) {
  const riskColor = RISK_COLOR[c.risk_assessment] || '#888';
  const opp = c.opportunity_assessment || {};
  return `
  <div class="dc-card">
    <div class="dc-card-header">
      <span class="dc-kpi-name">${esc(c.kpi)}</span>
      <span class="dc-risk-badge" style="background:${riskColor}">${esc(c.risk_assessment)}</span>
    </div>
    <p class="dc-value">${esc(c.value)}</p>
    <div class="dc-field"><strong>Business Interpretation:</strong> ${esc(c.business_interpretation)}</div>
    <div class="dc-field"><strong>Strategic Importance:</strong> ${esc(c.strategic_importance)}</div>
    <div class="dc-field"><strong>Operational Impact:</strong> ${esc(c.operational_impact)}</div>
    <div class="dc-field"><strong>Policy Impact:</strong> ${esc(c.policy_impact)}</div>
    <div class="dc-field"><strong>Funding Impact:</strong> ${esc(c.funding_impact)}</div>
    ${(opp.immediate?.length || opp.medium_term?.length || opp.strategic?.length) ? `
    <div class="dc-field"><strong>Opportunities:</strong>
      ${opp.immediate?.map(o => `<span class="dc-opp-tag">Immediate: ${esc(o)}</span>`).join('') || ''}
      ${opp.medium_term?.map(o => `<span class="dc-opp-tag">Medium-Term: ${esc(o)}</span>`).join('') || ''}
      ${opp.strategic?.map(o => `<span class="dc-opp-tag">Strategic: ${esc(o)}</span>`).join('') || ''}
    </div>` : ''}
    <div class="dc-field dc-recommendation"><strong>Decision Recommendation:</strong> ${esc(c.decision_recommendation)}</div>
    <div class="dc-field"><strong>Expected Impact:</strong> ${esc(c.expected_impact)}</div>
    <p class="dc-confidence">${esc(c.confidence_statement)}</p>
  </div>`;
}

function renderDecisionCardsSection(allCards) {
  const all = [...(allCards.kpi_decision_cards || []), ...(allCards.benchmark_decision_cards || []), ...(allCards.recommendation_decision_cards || [])];
  if (!all.length) return '';
  return `
  <section class="ig-page dc-page" aria-label="Executive Decision Cards">
    <h2 class="ig-section-title">Executive Decision Cards</h2>
    <p class="ig-disclosure">Every card below is generated from a fixed, rule-based template driven only by this report's real data — never a new AI judgment call.</p>
    <div class="dc-card-list">${all.map(renderDecisionCard).join('')}</div>
  </section>`;
}

function renderDecisionDashboard(dash) {
  function list(title, items, renderItem) {
    if (!items?.length) return '';
    return `<div class="dc-top10-block"><h3>${esc(title)}</h3><ol>${items.map(renderItem).join('')}</ol></div>`;
  }
  return `
  <section class="ig-page" aria-label="Executive Decision Dashboard">
    <h2 class="ig-section-title">Executive Decision Dashboard</h2>
    <div class="dc-dashboard-grid">
      ${list('Top Decisions', dash.top_10_decisions, d => `<li>${esc(d.decision_recommendation)} <span class="dc-risk-inline">(${esc(d.risk_assessment)})</span></li>`)}
      ${list('Top Risks', dash.top_10_risks, r => `<li>${esc(r.description)}</li>`)}
      ${list('Top Opportunities', dash.top_10_opportunities, o => `<li>[${esc(o.horizon)}] ${esc(o.opportunity)}</li>`)}
      ${list('Top Quick Wins', dash.top_10_quick_wins, q => `<li>${esc(q.action)}</li>`)}
      ${list('Top Strategic Investments', dash.top_10_strategic_investments, s => `<li>${esc(s.action)}</li>`)}
    </div>
  </section>`;
}

function renderBoardMeetingModes(data) {
  const bm = data.board_mode, mm = data.meeting_mode;
  function talkList(title, points) {
    if (!points?.length) return '';
    return `<div class="dc-talking-block"><h3>${esc(title)}</h3><ul>${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  }
  return `
  <section class="ig-page" aria-label="Board Mode and Meeting Mode">
    <h2 class="ig-section-title">Board Mode — Audience Talking Points</h2>
    <div class="dc-dashboard-grid">
      ${talkList('Board', bm.board_talking_points)}
      ${talkList('Minister', bm.minister_talking_points)}
      ${talkList('CEO', bm.ceo_talking_points)}
      ${talkList('Donor', bm.donor_talking_points)}
      ${talkList('Media', bm.media_talking_points)}
    </div>
    <h2 class="ig-section-title" style="margin-top:1.5rem;">Meeting Mode — Briefing Lengths</h2>
    <div class="dc-dashboard-grid">
      ${talkList('10-Minute Briefing', mm.briefing_10_minute)}
      ${talkList('5-Minute Briefing', mm.briefing_5_minute)}
      ${talkList('2-Minute Briefing', mm.briefing_2_minute)}
      <div class="dc-talking-block"><h3>30-Second Elevator Summary</h3><p>${esc(mm.elevator_summary_30_second)}</p></div>
    </div>
  </section>`;
}

function renderActionMatrix(am) {
  const tiers = ['Immediate', '30 Days', '90 Days', '6 Months', '12 Months'];
  return `
  <section class="ig-page" aria-label="Action Matrix">
    <h2 class="ig-section-title">Action Matrix</h2>
    <p class="ig-disclosure">${esc(am.note)}</p>
    <div class="dc-matrix-grid">
      ${tiers.map(t => `<div class="dc-matrix-col"><h3>${esc(t)}</h3>${(am.matrix[t] || []).map(a => `<div class="dc-matrix-item">${esc(a.action)}<span class="dc-matrix-owner">${esc(a.owner)}</span></div>`).join('') || '<p class="ig-unavailable">None</p>'}</div>`).join('')}
    </div>
  </section>`;
}

// Master render — Executive Decision Pages, meant to be inserted
// immediately after the Executive Infographic per Phase 17's success
// criteria.
function renderExecutiveDecisionPages({ allCards, decisionDashboard, boardMeeting, actionMatrix }) {
  return [
    renderDecisionCardsSection(allCards),
    renderDecisionDashboard(decisionDashboard),
    renderBoardMeetingModes(boardMeeting),
    renderActionMatrix(actionMatrix),
  ].join('\n');
}

window.DecisionComponents = { renderExecutiveDecisionPages };
})();
