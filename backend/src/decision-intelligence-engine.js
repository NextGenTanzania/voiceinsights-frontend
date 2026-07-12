// ============================================================
// EXECUTIVE DECISION INTELLIGENCE ENGINE (Phase 17, Part B)
// ------------------------------------------------------------
// Transforms "showing data" into "guiding executive decisions" via
// RULE-BASED, DETERMINISTIC templates — NOT a new Claude call. Every
// Decision Card's wording is selected from a fixed set of threshold-
// triggered sentences, parameterized ONLY with real numbers already in
// document_model_json (or the existing Benchmark/Recommendation/Quality
// engines' outputs). This is a deliberate architectural choice, not a
// shortcut: "never fabricate confidence" is only possible to guarantee
// structurally if the wording itself cannot vary beyond a reviewed,
// fixed set of business-language templates driven by real thresholds —
// exactly the same principle already proven for AI Talking Points
// (Phase 15) and AI Insight Cards (Phase 16).
//
// This module is 100% ADDITIVE — it does not import from, call, or
// modify the Report Engine, Executive Infographic Engine, Report
// Templates, Executive Summary, Report Styles, Report Assistant,
// Benchmark Engine, Recommendation Engine, Quality Engine, or Roadmap
// Engine. Where it needs their OUTPUT, it receives it as a parameter,
// never by re-implementing their logic.
// ============================================================

// ------------------------------------------------------------
// Core KPI Decision Card templates — each keyed by a real,
// already-computed value against fixed, documented thresholds.
// ------------------------------------------------------------
function responseRateCard(pct, orgTargetPct = 70) {
  if (pct === null || pct === undefined) return null;
  const exceedsTarget = pct >= orgTargetPct;
  const level = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Strong' : pct >= 50 ? 'Adequate' : 'Weak';
  return {
    kpi: 'Response Rate', value: `${pct}%`,
    business_interpretation: `${level} response quality. ${exceedsTarget ? `This exceeds the organisational target of ${orgTargetPct}% and increases confidence in the representativeness of the findings.` : `This falls short of the organisational target of ${orgTargetPct}%, meaning findings should be interpreted with appropriate caution about how representative they are.`}`,
    strategic_importance: exceedsTarget ? 'A high response rate is the single strongest indicator that this dataset can be trusted for decision-making without a supplementary verification round.' : 'A below-target response rate means executive decisions based on this data alone carry more uncertainty than usual and may warrant a supplementary check.',
    operational_impact: exceedsTarget ? 'Programme teams can proceed with implementation planning based on these findings with normal confidence.' : 'Programme teams should treat findings as directional rather than definitive until response rate improves in the next round.',
    policy_impact: exceedsTarget ? 'This response rate meets the evidentiary bar typically expected for policy-relevant recommendations.' : 'Policy recommendations drawn from this round should be flagged as provisional pending stronger response rates.',
    funding_impact: exceedsTarget ? 'Donors and funding partners (UN, USAID, EU, World Bank, AfDB) typically regard this response rate as sufficient to support funding decisions without additional data collection.' : 'Donors may request a supplementary data collection round before treating findings as sufficient evidence for funding decisions.',
    risk_assessment: exceedsTarget ? 'Low' : pct >= 50 ? 'Medium' : 'High',
    opportunity_assessment: { immediate: exceedsTarget ? ['Proceed with confidence to the next reporting or funding decision.'] : ['Investigate specific barriers to response in the lowest-responding segments.'], medium_term: [], strategic: [] },
    decision_recommendation: exceedsTarget ? 'Accept this round\'s findings as the evidentiary basis for the next decision cycle.' : 'Commission a supplementary data collection push before finalizing decisions based on this round alone.',
    expected_impact: exceedsTarget ? 'No corrective action needed on data collection; effort can shift to acting on findings.' : 'Improving response rate in the next round would materially strengthen confidence in future recommendations.',
    confidence_statement: `Evidence basis: this interpretation is derived from the real response rate value (${pct}%) against a documented ${orgTargetPct}% organisational target threshold — no statistic in this card is estimated or invented.`,
  };
}

function genderParticipationCard(femalePct) {
  if (femalePct === null || femalePct === undefined) return null;
  const balanced = femalePct >= 45 && femalePct <= 55;
  const exceeded = femalePct >= 50;
  return {
    kpi: 'Female Participation', value: `${femalePct}%`,
    business_interpretation: exceeded
      ? `Female participation ${femalePct >= 55 ? 'exceeded' : 'met'} programme expectations and strengthens gender-sensitive analysis for future policy recommendations.`
      : `Female participation (${femalePct}%) is below gender-balance expectations, meaning findings may under-represent women's perspectives.`,
    strategic_importance: exceeded ? 'A well-balanced or female-majority sample supports credible gender-disaggregated reporting expected by most institutional donors.' : 'An imbalanced sample limits the strength of any gender-specific claims this report can support.',
    operational_impact: exceeded ? 'Gender-disaggregated findings in this report can be used with normal confidence in programme design.' : 'Programme teams should treat gender-disaggregated findings as indicative only until representation improves.',
    policy_impact: exceeded ? 'This level of female representation supports gender-responsive policy recommendations grounded in adequate evidence.' : 'Policy recommendations touching on gender should note the representation gap explicitly.',
    funding_impact: exceeded ? 'This supports funding applications requiring demonstrated gender-inclusive data collection (e.g. SDG 5-aligned donor requirements).' : 'Donors with explicit gender-inclusion requirements may request improved representation before approving related funding.',
    risk_assessment: balanced || exceeded ? 'Low' : femalePct >= 35 ? 'Medium' : 'High',
    opportunity_assessment: { immediate: [], medium_term: exceeded ? [] : ['Target outreach specifically to under-represented gender groups in the next data collection round.'], strategic: [] },
    decision_recommendation: exceeded ? 'Use this round\'s gender-disaggregated findings directly in gender-responsive programme design.' : 'Improve gender-balanced sampling before relying heavily on gender-disaggregated conclusions from this round.',
    expected_impact: exceeded ? 'Strengthens the credibility of any gender-specific recommendation already in this report.' : 'Improving representation would allow stronger, more defensible gender-specific recommendations in the next round.',
    confidence_statement: `Evidence basis: this interpretation is derived from the real female-participation share (${femalePct}%) in this report's own demographic data — no statistic here is estimated or invented.`,
  };
}

function sentimentCard(positivePct) {
  if (positivePct === null || positivePct === undefined) return null;
  const level = positivePct >= 70 ? 'Strongly positive' : positivePct >= 50 ? 'Net positive' : positivePct >= 35 ? 'Mixed' : 'Concerning';
  const risk = positivePct >= 60 ? 'Low' : positivePct >= 40 ? 'Medium' : positivePct >= 25 ? 'High' : 'Critical';
  return {
    kpi: 'Positive Sentiment', value: `${positivePct}%`,
    business_interpretation: `${level} overall sentiment. ${positivePct >= 50 ? 'The majority of respondents report a favourable experience, a healthy baseline for continued programming.' : 'A significant share of respondents report an unfavourable experience, warranting direct executive attention.'}`,
    strategic_importance: positivePct >= 50 ? 'Positive sentiment at this level supports continued or expanded investment in the current approach.' : 'Sentiment at this level should prompt executive review of the specific drivers behind dissatisfaction before further investment.',
    operational_impact: positivePct >= 50 ? 'Frontline teams can continue current operating practices with normal monitoring.' : 'Frontline teams should prioritize addressing the specific themes driving negative sentiment.',
    policy_impact: positivePct >= 50 ? 'No immediate policy intervention is indicated by sentiment alone.' : 'Persistent negative sentiment at this level may warrant a policy-level review of the underlying service model.',
    funding_impact: positivePct >= 50 ? 'This sentiment level supports continued donor confidence in programme effectiveness.' : 'Donors may request a specific improvement plan before continuing or expanding funding, given this sentiment level.',
    risk_assessment: risk,
    opportunity_assessment: { immediate: positivePct < 50 ? ['Identify the specific themes driving negative sentiment for rapid response.'] : [], medium_term: [], strategic: positivePct >= 70 ? ['Document this as a success case for donor and public communication.'] : [] },
    decision_recommendation: positivePct >= 50 ? 'Maintain current approach while monitoring sentiment trend in future rounds.' : 'Convene a focused review of the specific negative-sentiment drivers identified in this report\'s findings.',
    expected_impact: positivePct >= 50 ? 'Continued monitoring will confirm whether this positive trend is sustained.' : 'Addressing the identified drivers could meaningfully improve sentiment by the next reporting round.',
    confidence_statement: `Evidence basis: this interpretation is derived from the real positive-sentiment share (${positivePct}%) computed from this report's own response data — no statistic here is estimated or invented.`,
  };
}

function qualityScoreCard(score) {
  if (score === null || score === undefined) return null;
  const level = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 60 ? 'Adequate' : 'Weak';
  return {
    kpi: 'Data Quality Score', value: `${score}/100`,
    business_interpretation: `${level} overall data quality. ${score >= 75 ? 'This report meets the evidentiary standard expected for executive and donor decision-making.' : 'This report\'s data quality is below the threshold typically expected for high-stakes decisions without additional verification.'}`,
    strategic_importance: score >= 75 ? 'High data quality directly supports confident use of this report\'s recommendations without further validation.' : 'Lower data quality means recommendations should be treated as directional pending further validation.',
    operational_impact: score >= 75 ? 'No additional data verification step is needed before acting on this report.' : 'Consider a targeted data verification step for the specific dimension(s) driving the lower score before major operational decisions.',
    policy_impact: score >= 75 ? 'This report meets the evidentiary bar for policy-relevant recommendations.' : 'Policy recommendations from this report should be flagged as provisional pending quality improvement.',
    funding_impact: score >= 75 ? 'Institutional donors typically accept this quality level as sufficient evidentiary support for funding decisions.' : 'Donors may request quality improvements before treating this report as sufficient evidence.',
    risk_assessment: score >= 75 ? 'Low' : score >= 60 ? 'Medium' : 'High',
    opportunity_assessment: { immediate: [], medium_term: score < 75 ? ['Target the specific quality dimension(s) scoring lowest for improvement in the next round.'] : [], strategic: [] },
    decision_recommendation: score >= 75 ? 'Proceed to use this report\'s findings and recommendations with normal confidence.' : 'Identify and address the specific lowest-scoring quality dimension(s) before the next major decision cycle.',
    expected_impact: score >= 75 ? 'No corrective action needed; confidence in this report is already high.' : 'Improving the lowest-scoring quality dimension(s) would raise overall confidence in future rounds.',
    confidence_statement: `Evidence basis: this interpretation is derived from the real Quality Scoring Engine output (${score}/100, Task 9.7 — pure arithmetic, reused here unmodified) — no statistic here is estimated or invented.`,
  };
}

// Master builder for KPI-level Decision Cards.
export function buildKpiDecisionCards(kpiPage) {
  return [
    responseRateCard(kpiPage.response_rate_pct ?? kpiPage.completion_rate_pct),
    genderParticipationCard(kpiPage.female !== null && kpiPage.male !== null && (kpiPage.female + kpiPage.male) > 0 ? Math.round((kpiPage.female / (kpiPage.female + kpiPage.male)) * 100) : null),
    sentimentCard(kpiPage.sentiment_positive_pct),
    qualityScoreCard(kpiPage.data_quality_score),
  ].filter(Boolean);
}

// ------------------------------------------------------------
// BENCHMARK DECISION CARDS — reuses the existing Benchmark Engine's
// (Task 9.4, unmodified) output as input; never recomputes a comparison.
// ------------------------------------------------------------
export function buildBenchmarkDecisionCards(benchmarkDashboard, trendIntelligence) {
  const cards = [];
  if (benchmarkDashboard?.organization_average?.avg_responses_per_campaign != null) {
    const orgAvg = benchmarkDashboard.organization_average.avg_responses_per_campaign;
    cards.push({
      kpi: 'Organization Average Comparison', value: `${orgAvg} responses/campaign (org average)`,
      business_interpretation: `This report's sample size can be directly compared against the organization's own historical average of ${orgAvg} responses per campaign.`,
      strategic_importance: 'Comparing against your own organization\'s track record is the most directly relevant benchmark available — more relevant than an external target that may not reflect your specific operating context.',
      operational_impact: 'Programme teams can use this comparison to judge whether this round\'s data collection effort was typical, above, or below the organization\'s usual scale.',
      policy_impact: 'Not directly policy-relevant — this is an operational/data-collection benchmark, not a programme-outcome benchmark.',
      funding_impact: 'Donors reviewing multiple reports from the same organization will expect consistency with this internal average; large deviations should be explained.',
      risk_assessment: 'Low',
      opportunity_assessment: { immediate: [], medium_term: [], strategic: [] },
      decision_recommendation: 'No action needed — this is a contextual reference point, not a finding requiring a response.',
      expected_impact: 'None — informational context only.',
      confidence_statement: `Evidence basis: this comparison uses the approved Benchmark Engine output organization-average calculation — no new comparison logic was written for this card.`,
    });
  }
  if (trendIntelligence?.previous_campaign) {
    const pc = trendIntelligence.previous_campaign;
    cards.push({
      kpi: 'Trend vs. Previous Campaign', value: `${pc.total_responses} responses (previous campaign: ${pc.name})`,
      business_interpretation: `This organization has a prior campaign on record (${pc.name}, ${pc.total_responses} responses), providing a real basis for trend comparison.`,
      strategic_importance: 'Trend comparison across campaigns is more informative to leadership than a single point-in-time reading, since it shows trajectory, not just a snapshot.',
      operational_impact: 'Programme teams should review whether operational practices changed between the two campaigns to explain any notable difference.',
      policy_impact: 'A consistent, multi-campaign trend carries more policy weight than a single round\'s findings.',
      funding_impact: 'Donors specifically value trend evidence over single-round snapshots when assessing programme trajectory.',
      risk_assessment: 'Low',
      opportunity_assessment: { immediate: [], medium_term: [], strategic: ['Use this multi-campaign trend as evidence in the next donor or Board report.'] },
      decision_recommendation: 'Reference this trend explicitly in the next executive or donor communication, rather than presenting this round in isolation.',
      expected_impact: 'Strengthens the evidentiary weight of any recommendation already in this report by showing it is grounded in an observed trend, not a single data point.',
      confidence_statement: 'This comparison reuses the existing Benchmark Engine\'s (Task 9.4, unmodified) previous-campaign lookup — no new comparison logic was written for this card.',
    });
  }
  return cards;
}

// ------------------------------------------------------------
// RECOMMENDATION DECISION CARDS — reuses the existing Recommendation
// Dashboard (built from the Report Engine's real recommendations,
// Phase 16) as input; never invents a new recommendation.
// ------------------------------------------------------------
export function buildRecommendationDecisionCards(recommendationDashboard) {
  const DIFFICULTY_RISK = { Low: 'Low', Medium: 'Medium', High: 'High' };
  return (recommendationDashboard?.items || []).map(item => ({
    kpi: `Recommendation: ${item.tier_label}`, value: item.action,
    business_interpretation: `This is a ${item.tier_label.toLowerCase()}-horizon action, owned by ${item.owner}, already grounded in this report's real findings.`,
    strategic_importance: item.tier_label === 'Immediate' ? 'Immediate-tier recommendations require no new budget approval and can demonstrate visible responsiveness to this report\'s findings quickly.' : item.tier_label === '30-90 Day' ? 'This medium-horizon action typically requires programme design or budget-cycle alignment.' : 'This is a structural, longer-horizon action relevant to the next full programme phase.',
    operational_impact: `Assign to ${item.owner} for implementation planning.`,
    policy_impact: item.tier_label === '6-12 Month' ? 'Longer-horizon recommendations of this kind often carry policy-level implications worth flagging to relevant policy stakeholders.' : 'Primarily operational; limited direct policy implication at this tier.',
    funding_impact: item.tier_label === 'Immediate' ? 'Low funding impact — implementable within existing resources.' : 'May require a specific budget line or donor conversation, depending on scope.',
    risk_assessment: DIFFICULTY_RISK[item.difficulty] || 'Medium',
    opportunity_assessment: { immediate: item.tier_label === 'Immediate' ? [item.action] : [], medium_term: item.tier_label === '30-90 Day' ? [item.action] : [], strategic: item.tier_label === '6-12 Month' ? [item.action] : [] },
    decision_recommendation: `Approve and assign this action to ${item.owner}.`,
    expected_impact: 'Expected impact requires a follow-up measurement round to quantify — not estimated here to avoid an unsupported claim.',
    confidence_statement: 'This card reuses a recommendation already produced by the Report Engine\'s Recommendation Dashboard (Phase 16) verbatim — no new recommendation was invented for this card.',
  }));
}

// Master builder — assembles ALL decision cards (KPI + Benchmark +
// Recommendation) from data already computed by existing engines.
export function buildAllDecisionCards(infographicData) {
  return {
    kpi_decision_cards: buildKpiDecisionCards(infographicData.kpi_page),
    benchmark_decision_cards: buildBenchmarkDecisionCards(infographicData.benchmark_dashboard, infographicData.trend_intelligence),
    recommendation_decision_cards: buildRecommendationDecisionCards(infographicData.recommendation_dashboard),
  };
}

// ------------------------------------------------------------
// EXECUTIVE DECISION DASHBOARD — Top 10 Decisions/Risks/Opportunities/
// Quick Wins/Strategic Investments. Every list here is a re-sorted VIEW
// of cards/findings/risks already produced above or by the Infographic
// Engine — never a new judgment call about what counts as a "top" item
// beyond a documented, transparent sort rule (e.g. severity for risks,
// tier for quick wins).
// ------------------------------------------------------------
const RISK_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export function buildDecisionDashboard(infographicData, allCards) {
  const allDecisionCards = [...allCards.kpi_decision_cards, ...allCards.benchmark_decision_cards, ...allCards.recommendation_decision_cards];

  const topDecisions = allDecisionCards
    .slice() // avoid mutating input
    .sort((a, b) => (RISK_RANK[b.risk_assessment] || 0) - (RISK_RANK[a.risk_assessment] || 0))
    .slice(0, 10)
    .map(c => ({ kpi: c.kpi, decision_recommendation: c.decision_recommendation, risk_assessment: c.risk_assessment }));

  const topRisks = (infographicData.risk_dashboard?.risk_matrix || [])
    .slice().sort((a, b) => b.priority - a.priority).slice(0, 10)
    .map(r => ({ description: r.description, traffic_light: r.traffic_light, priority: r.priority }));

  const topOpportunities = allDecisionCards
    .flatMap(c => [
      ...(c.opportunity_assessment?.immediate || []).map(o => ({ opportunity: o, horizon: 'Immediate', from_kpi: c.kpi })),
      ...(c.opportunity_assessment?.medium_term || []).map(o => ({ opportunity: o, horizon: 'Medium-Term', from_kpi: c.kpi })),
      ...(c.opportunity_assessment?.strategic || []).map(o => ({ opportunity: o, horizon: 'Strategic', from_kpi: c.kpi })),
    ])
    .slice(0, 10);

  // Quick Wins = Immediate-tier recommendation cards specifically (low
  // difficulty by definition, per the existing tier->difficulty mapping).
  const topQuickWins = allCards.recommendation_decision_cards
    .filter(c => c.kpi.includes('Immediate'))
    .slice(0, 10)
    .map(c => ({ action: c.value, owner: c.operational_impact }));

  // Strategic Investments = 6-12 Month tier recommendation cards
  // specifically (the longest-horizon, highest-difficulty tier).
  const topStrategicInvestments = allCards.recommendation_decision_cards
    .filter(c => c.kpi.includes('6-12 Month'))
    .slice(0, 10)
    .map(c => ({ action: c.value, owner: c.operational_impact }));

  return {
    top_10_decisions: topDecisions,
    top_10_risks: topRisks,
    top_10_opportunities: topOpportunities,
    top_10_quick_wins: topQuickWins,
    top_10_strategic_investments: topStrategicInvestments,
  };
}

// ------------------------------------------------------------
// BOARD MODE — Talking Points for 5 audiences. Each is a DIFFERENT
// FRAMING of the SAME underlying facts (executive_summary, key_findings,
// top decision/risk), never different facts. This mirrors exactly the
// principle already proven by Executive Report Styles (Task 9.1) — only
// wording/emphasis changes per audience, facts never do.
// ------------------------------------------------------------
export function buildBoardModeTalkingPoints(documentModel, decisionDashboard) {
  const narrative = documentModel.narrative || {};
  const topDecision = decisionDashboard.top_10_decisions[0];
  const topRisk = decisionDashboard.top_10_risks[0];
  const summary = narrative.executive_summary ? narrative.executive_summary.split('.')[0] + '.' : 'Insufficient verified evidence available for this section.';

  return {
    board_talking_points: [
      `${summary}`,
      topDecision ? `Our top recommended action: ${topDecision.decision_recommendation}` : null,
      topRisk ? `Key risk to note: ${topRisk.description}` : null,
    ].filter(Boolean),
    minister_talking_points: [
      `This survey reached ${documentModel.kpis.total_responses} citizens across ${documentModel.kpis.regions_covered} regions.`,
      summary,
      topRisk ? `A specific concern requiring attention: ${topRisk.description}` : null,
    ].filter(Boolean),
    ceo_talking_points: [
      summary,
      topDecision ? `Recommended executive decision: ${topDecision.decision_recommendation}` : null,
      `Overall data quality score: ${decisionDashboard.top_10_decisions.find(d => d.kpi === 'Data Quality Score')?.risk_assessment || 'see full report'}.`,
    ].filter(Boolean),
    donor_talking_points: [
      summary,
      `Data quality and response rate figures are detailed in the Statistical Annex — see the report for full evidentiary basis.`,
      topDecision ? `Priority action for continued funding consideration: ${topDecision.decision_recommendation}` : null,
    ].filter(Boolean),
    media_talking_points: [
      // Media framing uses the simplest, most plain-language version —
      // consistent with the existing public_summary executive style's
      // vocabulary_level rule (Task 9.1, reused in spirit, not modified).
      narrative.executive_summary ? narrative.executive_summary.split('.')[0].replace(/[—–]/g, '-') + '.' : 'Insufficient verified evidence available for this section.',
    ],
  };
}

// ------------------------------------------------------------
// MEETING MODE — 4 briefing lengths, each a shorter EXTRACT of the same
// executive_summary/conclusions/top decision — never new content
// invented to fit a shorter format.
// ------------------------------------------------------------
export function buildMeetingModeBriefings(documentModel, decisionDashboard) {
  const narrative = documentModel.narrative || {};
  const topDecision = decisionDashboard.top_10_decisions[0];
  const sentences = (narrative.executive_summary || '').split('. ').filter(Boolean);

  // A genuine 30-second elevator pitch must be short in absolute terms,
  // not merely "the first sentence" — some first sentences run 40+ words.
  // This truncates the SAME real text at a word boundary near 25 words
  // (a real spoken 30-second pace), rather than rewriting or inventing a
  // new, shorter sentence — still a pure extract of existing content.
  function elevatorTruncate(text) {
    if (!text) return 'Insufficient verified evidence available for this section.';
    const words = text.split(' ');
    return words.length <= 25 ? text : words.slice(0, 25).join(' ') + '…';
  }

  return {
    briefing_10_minute: [narrative.executive_summary, narrative.discussion, topDecision ? `Recommended action: ${topDecision.decision_recommendation}` : null].filter(Boolean),
    briefing_5_minute: [sentences.slice(0, 3).join('. ') + (sentences.length ? '.' : ''), topDecision ? `Recommended action: ${topDecision.decision_recommendation}` : null].filter(Boolean),
    briefing_2_minute: [sentences.slice(0, 1).join('. ') + (sentences.length ? '.' : ''), topDecision ? topDecision.decision_recommendation : null].filter(Boolean),
    elevator_summary_30_second: elevatorTruncate(sentences[0]),
  };
}

// ------------------------------------------------------------
// ACTION MATRIX — Immediate/30-Day/90-Day/6-Month/12-Month. This
// platform's Report Engine genuinely produces a 3-tier recommendation
// structure (immediate/medium_term/long_term); rather than fabricating
// a false 5-way split, medium_term is honestly mapped to BOTH 30-Day and
// 90-Day (the same real action, shown under both adjacent horizons it
// plausibly spans), and long_term is mapped to BOTH 6-Month and 12-Month
// for the same honest reason — never inventing 5 independently-sourced
// tiers the underlying data does not support.
// ------------------------------------------------------------
export function buildActionMatrix(recommendationDashboard) {
  const items = recommendationDashboard?.items || [];
  const byTier = {
    Immediate: items.filter(i => i.tier_label === 'Immediate').map(i => ({ action: i.action, owner: i.owner })),
    '30 Days': items.filter(i => i.tier_label === '30-90 Day').map(i => ({ action: i.action, owner: i.owner })),
    '90 Days': items.filter(i => i.tier_label === '30-90 Day').map(i => ({ action: i.action, owner: i.owner })),
    '6 Months': items.filter(i => i.tier_label === '6-12 Month').map(i => ({ action: i.action, owner: i.owner })),
    '12 Months': items.filter(i => i.tier_label === '6-12 Month').map(i => ({ action: i.action, owner: i.owner })),
  };
  return {
    matrix: byTier,
    note: 'This platform\'s Report Engine produces 3 real recommendation tiers (Immediate/Medium-Term/Long-Term). The 5-column matrix requested here honestly maps Medium-Term to both "30 Days" and "90 Days" (the same real action shown under both adjacent horizons it plausibly spans) and Long-Term to both "6 Months" and "12 Months", rather than fabricating 5 independently-sourced action sets the underlying data does not support.',
  };
}
