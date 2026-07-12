// ============================================================
// EXECUTIVE INFOGRAPHIC ENGINE — Data Builder (Phase 16)
// ------------------------------------------------------------
// Every function here is a PURE, DETERMINISTIC transformation of an
// already-existing document_model_json (plus, where explicitly noted,
// a read-only call to the EXISTING, UNMODIFIED Quality Scoring and
// Benchmark engines). No Claude calls. No database writes. No new
// statistics that aren't already present in the source report.
//
// HONESTY RULE FOLLOWED THROUGHOUT: several fields requested in Phase 16
// (Education/Occupation/Income/Disability/Household Size demographics,
// NPS/CSAT as distinct metrics, Enumerator Productivity, Interview
// Duration, literal GIS regional/district maps) are not tracked anywhere
// in this platform's data model. Rather than fabricate placeholder
// numbers for these, every such field is returned with
// available: false and a plain-language reason — a dashboard that
// honestly shows "not collected in this survey" is more trustworthy
// than one that invents a number to fill a slot.
// ============================================================

import { scoreReportQuality } from './quality-scoring-engine.js';
import { buildBenchmark } from './benchmark-engine.js';

// ------------------------------------------------------------
// 1. EXECUTIVE DASHBOARD COVER
// ------------------------------------------------------------
function buildCover(dm) {
  return {
    organization_name: dm.metadata.organization_name,
    country: dm.demo_country || null,
    project: dm.metadata.campaign_name || null,
    survey_title: dm.metadata.survey_title || null,
    respondents: dm.kpis.total_responses,
    completion_rate_pct: dm.kpis.total_responses > 0 ? Math.round((dm.kpis.completed_responses / dm.kpis.total_responses) * 100) : null,
    response_rate_pct: dm.kpis.response_rate_pct,
    survey_period: { available: false, reason: 'Survey start/end date range is not tracked as a distinct field in this data model — see Generated Date instead.' },
    report_type: dm.metadata.template_name,
    generated_date: dm.metadata.generated_at,
    logo_url: dm.branding?.logo_r2_key ? `/api/documents/${encodeURIComponent(dm.branding.logo_r2_key)}` : null,
    is_demo: !!dm.is_demo,
  };
}

// ------------------------------------------------------------
// 2. EXECUTIVE KPI PAGE
// ------------------------------------------------------------
function buildKpiPage(dm) {
  const total = dm.kpis.total_responses || 0;
  const genderMap = Object.fromEntries((dm.demographics?.gender || []).map(g => [g.label.toLowerCase(), g.n]));
  const ageRows = dm.demographics?.age || [];
  const youthRow = ageRows.find(a => a.label === '18-25');
  const positiveEntry = (dm.findings?.sentiment || []).find(s => s.label === 'positive');

  return {
    total_respondents: total,
    female: genderMap.female ?? null,
    male: genderMap.male ?? null,
    youth_18_25: youthRow?.n ?? null,
    average_age: { available: false, reason: 'Age is collected as a bracket (e.g. 18-25), not an exact value, so a numeric average cannot be honestly computed.' },
    completion_rate_pct: total > 0 ? Math.round((dm.kpis.completed_responses / total) * 100) : null,
    nps: { available: false, reason: 'Net Promoter Score requires a dedicated 0-10 recommendation-likelihood question, not collected in this instrument.' },
    csat: { available: false, reason: 'CSAT requires a dedicated 1-5 satisfaction-rating question, not collected in this instrument.' },
    sentiment_positive_pct: total > 0 && positiveEntry ? Math.round((positiveEntry.n / total) * 100) : null,
    confidence: dm.data_quality?.avg_transcription_confidence ?? null,
    response_time: { available: false, reason: 'Per-response completion duration is not tracked in this data model.' },
    data_quality_score: scoreReportQuality(dm).overall_quality_score,
  };
}

// ------------------------------------------------------------
// 3. GEOGRAPHIC INTELLIGENCE
// ------------------------------------------------------------
// HONEST DISCLOSURE: this platform has no GIS/lat-long boundary data —
// "map" here means a heat-ranked list/bar visualization of real regional
// response data, not a literal cartographic map. The frontend component
// built from this data will be labeled accordingly, never claiming to be
// a geographic map it is not.
function buildGeographicIntelligence(dm) {
  const regions = [...(dm.demographics?.regions || [])].sort((a, b) => b.n - a.n);
  const total = regions.reduce((s, r) => s + r.n, 0);
  return {
    map_type_disclosure: 'Regional coverage intensity (heat-ranked list), not a literal GIS map — this platform does not store geographic boundary/coordinate data.',
    regional_coverage: regions.map(r => ({ region: r.label, responses: r.n, pct_of_total: total > 0 ? Math.round((r.n / total) * 1000) / 10 : null })),
    district_map: { available: false, reason: 'District-level geography is not separately tracked from region in this data model.' },
    top_performing_areas: regions.slice(0, 3),
    lowest_performing_areas: regions.slice(-3).reverse(),
    population_distribution: { available: false, reason: 'Regional population totals are not tracked in this platform — only respondent counts are available, shown above as coverage.' },
  };
}

// ------------------------------------------------------------
// 4. DEMOGRAPHIC INTELLIGENCE
// ------------------------------------------------------------
function buildDemographicIntelligence(dm) {
  const notCollected = (field) => ({ available: false, reason: `${field} is not a field collected by this survey instrument.` });
  return {
    gender: dm.demographics?.gender || [],
    age: dm.demographics?.age || [],
    education: notCollected('Education level'),
    occupation: notCollected('Occupation'),
    income: notCollected('Income'),
    disability: notCollected('Disability status'),
    household_size: notCollected('Household size'),
    urban_vs_rural: notCollected('Urban/rural classification'),
  };
}

// ------------------------------------------------------------
// 5. SURVEY PARTICIPATION
// ------------------------------------------------------------
function buildParticipation(dm) {
  const total = dm.kpis.total_responses || 0;
  const completed = dm.kpis.completed_responses || 0;
  return {
    response_funnel: [
      { stage: 'Contacted / Started', count: total },
      { stage: 'Completed', count: completed },
    ],
    completion_rate_pct: total > 0 ? Math.round((completed / total) * 100) : null,
    drop_off_count: total - completed,
    drop_off_pct: total > 0 ? Math.round(((total - completed) / total) * 100) : null,
    enumerator_productivity: { available: false, reason: 'Per-enumerator response counts are tracked internally for enumerator management, not embedded in this report data model.' },
    interview_duration: { available: false, reason: 'Per-response interview duration is not tracked in this data model.' },
  };
}

// ------------------------------------------------------------
// 6. EXECUTIVE FINDINGS (visual cards)
// ------------------------------------------------------------
// Icons are a fixed, deterministic mapping by keyword match against the
// finding text itself — never an AI classification call. SDG link reuses
// only the standards ALREADY declared on this report's metadata.
const ICON_KEYWORDS = [
  [/afford|cost|price|fee/i, '💰'], [/access|distance|reach/i, '📍'], [/health|medical|clinic/i, '🏥'],
  [/education|school|learn|teach/i, '📚'], [/water|wash|sanitation/i, '💧'], [/gender|women|girl/i, '⚖️'],
  [/trust|transparen|govern/i, '🏛️'], [/employ|job|income|business/i, '💼'], [/risk|concern|gap/i, '⚠️'],
  [/improve|positive|success/i, '✅'],
];
function iconFor(text) {
  const match = ICON_KEYWORDS.find(([re]) => re.test(text));
  return match ? match[1] : '🔎';
}

function buildExecutiveFindings(dm) {
  const findings = dm.narrative?.key_findings || [];
  const sdgStandards = (dm.metadata.standards || []).filter(s => s === 'SDG' || s.startsWith('SDG'));
  return findings.map((headline, i) => ({
    icon: iconFor(headline),
    headline,
    evidence: dm.findings?.topics?.[i] ? `${dm.findings.topics[i].topic}: ${dm.findings.topics[i].count} mentions` : null,
    supporting_chart_ref: dm.charts?.[0]?.section || null,
    confidence: dm.data_quality?.avg_transcription_confidence ?? null,
    sdg_link: sdgStandards.length ? sdgStandards : null,
  }));
}

// ------------------------------------------------------------
// 7. RISK DASHBOARD
// ------------------------------------------------------------
// Severity/probability are DETERMINISTIC, derived only from the report's
// own negative-sentiment and fraud-flag rates — the exact same
// transparent formula already used by buildExecutiveSummaryFormat's
// risk_rating in Phase 15 (kept consistent, not reinvented here).
function buildRiskDashboard(dm) {
  const total = dm.kpis.total_responses || 0;
  const negativeEntry = (dm.findings?.sentiment || []).find(s => s.label === 'negative');
  const negativePct = total > 0 && negativeEntry ? Math.round((negativeEntry.n / total) * 100) : 0;
  const flaggedPct = total > 0 ? Math.round(((dm.data_quality?.flagged_response_count || 0) / total) * 100) : 0;

  const risks = (dm.narrative?.risks || []).map((description, i) => {
    // Probability/impact are positioned on a fixed 1-3 scale using the
    // SAME report-wide negative-sentiment signal for every risk (a
    // per-risk probability would require data this platform doesn't
    // collect) — consistent and transparent rather than an invented
    // per-item distinction.
    const probability = negativePct >= 25 ? 3 : negativePct >= 10 ? 2 : 1;
    const impact = i === 0 ? 3 : i === 1 ? 2 : 1; // first-listed risk treated as highest-impact, per narrative ordering
    const priority = probability * impact;
    return {
      description, probability, impact, priority,
      traffic_light: priority >= 6 ? 'red' : priority >= 3 ? 'amber' : 'green',
    };
  });

  return {
    overall_severity_pct: Math.max(negativePct, flaggedPct),
    overall_traffic_light: (negativePct >= 25 || flaggedPct >= 10) ? 'red' : (negativePct >= 10 || flaggedPct >= 3) ? 'amber' : 'green',
    risk_matrix: risks,
    basis: `${negativePct}% negative sentiment, ${flaggedPct}% flagged responses — the same transparent basis used platform-wide for risk rating.`,
  };
}

// ------------------------------------------------------------
// 8. RECOMMENDATION DASHBOARD
// ------------------------------------------------------------
// 30-Day/90-Day/6-Month/12-Month tiers are DERIVED from the existing
// immediate/medium_term/long_term tiers already produced by the Report
// Engine — mapped, not re-generated, since this platform's
// recommendation structure genuinely only has 3 tiers, not 5. Presenting
// a false 5-tier breakdown would misrepresent the underlying data.
function buildRecommendationDashboard(dm) {
  const recs = dm.recommendations || {};
  const TIER_MAP = { immediate: 'Immediate', medium_term: '30-90 Day', long_term: '6-12 Month' };
  const OWNER_BY_TIER = { immediate: 'Field/Operations Team', medium_term: 'Programme Management', long_term: 'Country Leadership / Donor Liaison' };
  const DIFFICULTY_BY_TIER = { immediate: 'Low', medium_term: 'Medium', long_term: 'High' };
  const sdgStandards = (dm.metadata.standards || []).filter(s => s === 'SDG' || s.startsWith('SDG'));

  const items = [];
  for (const tier of ['immediate', 'medium_term', 'long_term']) {
    (recs[tier] || []).forEach((action, i) => {
      items.push({
        action, tier_label: TIER_MAP[tier], owner: OWNER_BY_TIER[tier], difficulty: DIFFICULTY_BY_TIER[tier],
        priority: i === 0 ? 'High' : 'Medium', // first-listed per tier treated as highest priority, per narrative ordering
        expected_impact: { available: false, reason: 'Quantified expected impact requires a follow-up measurement round, not available at the point of recommendation.' },
        estimated_cost: { available: false, reason: 'Cost estimation requires programme budget data not tracked in this survey platform.' },
        sdg_alignment: sdgStandards.length ? sdgStandards : null,
      });
    });
  }
  return { note: 'This platform\'s Report Engine produces 3 recommendation tiers (Immediate, Medium-Term, Long-Term) — mapped to the closest matching Phase 16 tier labels rather than fabricating a 5-tier breakdown the underlying data does not support.', items };
}

// ------------------------------------------------------------
// 9. SDG DASHBOARD
// ------------------------------------------------------------
function buildSdgDashboard(dm) {
  const standards = dm.metadata.standards || [];
  const sdgTags = standards.filter(s => s === 'SDG' || s.startsWith('SDG'));
  return {
    applicable: sdgTags.length > 0,
    sdg_tags: sdgTags,
    note: sdgTags.length > 0
      ? 'This report declares alignment with the SDG framework generally; specific numbered-goal-level contribution percentages are not computed automatically, since doing so would require a goal-to-finding mapping not part of this data model.'
      : 'No SDG alignment applies to this report type (e.g. private-sector market research) — none is forced here, consistent with this platform\'s standards-library rule.',
    progress_bars: { available: false, reason: 'SDG target progress percentages require externally-defined national/global targets not stored in this platform.' },
  };
}

// ------------------------------------------------------------
// 10. QUALITY DASHBOARD — reuses scoreReportQuality() (Task 9.7) exactly
// as-is, never re-implemented. "Representativeness" is honestly derived
// from whether all demographic categories are populated (not a fresh
// statistical test this platform cannot run).
// ------------------------------------------------------------
function buildQualityDashboard(dm) {
  const scores = scoreReportQuality(dm);
  const hasFullDemographics = (dm.demographics?.gender?.length > 0) && (dm.demographics?.age?.length > 0) && (dm.demographics?.regions?.length > 0);
  return {
    survey_quality: scores.overall_quality_score,
    ai_confidence: scores.ai_confidence,
    evidence_coverage: scores.recommendation_quality, // recommendations are this platform's evidence-linked output; reused rather than inventing a separate metric
    narrative_coverage: scores.narrative_coverage,
    data_completeness: scores.data_completeness,
    representativeness: {
      value: hasFullDemographics ? 'Full demographic coverage (gender, age, region all populated)' : 'Partial demographic coverage',
      note: 'This is a completeness check, not a statistical representativeness test against a known population — this platform does not have census/population benchmark data to test against.',
    },
    all_dimensions: scores,
  };
}

// ------------------------------------------------------------
// 11. QUOTE INTELLIGENCE — beautiful quote cards, built ONLY from real,
// already-transcribed respondent quotes already selected by the Report
// Engine (never a new quote, never edited wording).
// ------------------------------------------------------------
function buildQuoteIntelligence(dm) {
  return (dm.findings?.representative_quotes || []).map(q => ({
    quote: q.raw_text,
    sentiment: q.overall_sentiment || null,
    channel: q.channel || null,
    theme: iconFor(q.raw_text || ''),
  }));
}

// ------------------------------------------------------------
// 12. TREND INTELLIGENCE + 13. BENCHMARK DASHBOARD
// ------------------------------------------------------------
// Both reuse the EXISTING, UNMODIFIED Benchmark Engine (Task 9.4) --
// Trend Intelligence is the time-based slice of that same data
// (previous campaign / same period last year), Benchmark Dashboard is
// the comparative slice (org average / sector average / targets). No
// new comparison logic is written here; this is purely a different
// presentational grouping of the same real, already-computed numbers.
async function buildTrendAndBenchmark(env, { organizationId, campaignId, templateId, currentKpis }) {
  let benchmark;
  try {
    benchmark = await buildBenchmark(env, { organizationId, campaignId, templateId, currentKpis });
  } catch (e) {
    return {
      trend_intelligence: { available: false, reason: `Benchmark data could not be computed: ${e.message}` },
      benchmark_dashboard: { available: false, reason: `Benchmark data could not be computed: ${e.message}` },
    };
  }
  return {
    trend_intelligence: {
      previous_campaign: benchmark.previous_campaign,
      same_period_last_year: benchmark.same_period_last_year,
      forecast: { available: false, reason: 'Forecasting requires at least 3 historical data points; this platform tracks at most 2 (previous campaign, same period last year).' },
    },
    benchmark_dashboard: {
      organization_average: benchmark.organization_average,
      sector_average: benchmark.sector_average,
      national_target: { available: false, reason: 'National targets are not stored in this platform — see SDG-aligned targets below instead.' },
      sdg_target: benchmark.targets,
    },
  };
}

// ------------------------------------------------------------
// 14. AI INSIGHT CARDS
// ------------------------------------------------------------
// Despite the "AI" label, these are DETERMINISTICALLY assembled from
// content the AI Narrative Engine already wrote (risks/opportunities/
// discussion) — the same principle as Phase 15's AI Talking Points: NO
// new Claude call here, so this can never introduce an insight not
// already grounded in the report's real evidence.
function buildAiInsightCards(dm) {
  const narrative = dm.narrative || {};
  const cards = [];
  (narrative.risks || []).forEach(r => cards.push({ category: 'Emerging Risk', insight: r }));
  (narrative.opportunities || []).forEach(o => cards.push({ category: 'Hidden Opportunity', insight: o }));
  // "Behaviour Patterns" reuses the topic-frequency ranking already
  // computed by the Report Engine — the single most-cited theme IS the
  // clearest behavioural pattern already evidenced in this data.
  const topTopic = (dm.findings?.topics || [])[0];
  if (topTopic) cards.push({ category: 'Behaviour Pattern', insight: `"${topTopic.topic}" is the most consistently raised theme (${topTopic.count} mentions), indicating a genuinely widespread, not isolated, pattern.` });
  // "Unexpected Findings" reuses the lessons_learned field, which the
  // Narrative Engine already writes specifically to reflect on what the
  // open-ended data format revealed beyond what was expected.
  if (narrative.lessons_learned) cards.push({ category: 'Unexpected Finding', insight: narrative.lessons_learned });
  return cards;
}

// ------------------------------------------------------------
// 15. EXECUTIVE CLOSING PAGE
// ------------------------------------------------------------
function buildClosingPage(dm, reportId) {
  const scores = scoreReportQuality(dm);
  const recs = dm.recommendations || {};
  return {
    overall_score: scores.overall_quality_score,
    top_achievements: (dm.narrative?.opportunities || []).slice(0, 3),
    priority_risks: (dm.narrative?.risks || []).slice(0, 3),
    next_steps: (recs.immediate || []).slice(0, 3),
    contact: dm.branding?.contact_details || null,
    // A real QR code requires a QR-generation library (rendered
    // client-side, per Phase 15's precedent of using CDN libraries for
    // PptxGenJS/SheetJS) — the backend provides the exact URL to encode,
    // never a fabricated placeholder image.
    qr_target_url: (dm.is_demo && reportId) ? `https://voiceinsightsafrica.com/sample-report-viewer.html?report_id=${reportId}` : null,
  };
}

// Master builder — assembles every section. Each section is independent;
// a gap in one (e.g. no benchmark data) never blocks the others. Now
// async because Trend/Benchmark sections reuse the existing, database-
// backed Benchmark Engine (Task 9.4) rather than duplicating its logic.
export async function buildInfographicData(documentModel, env, { organizationId, campaignId, templateId, reportId } = {}) {
  const dm = documentModel;
  const base = {
    cover: buildCover(dm),
    kpi_page: buildKpiPage(dm),
    geographic_intelligence: buildGeographicIntelligence(dm),
    demographic_intelligence: buildDemographicIntelligence(dm),
    participation: buildParticipation(dm),
    executive_findings: buildExecutiveFindings(dm),
    risk_dashboard: buildRiskDashboard(dm),
    recommendation_dashboard: buildRecommendationDashboard(dm),
    sdg_dashboard: buildSdgDashboard(dm),
    quality_dashboard: buildQualityDashboard(dm),
    quote_intelligence: buildQuoteIntelligence(dm),
    ai_insight_cards: buildAiInsightCards(dm),
    closing_page: buildClosingPage(dm, reportId),
  };
  if (env && organizationId && campaignId) {
    const { trend_intelligence, benchmark_dashboard } = await buildTrendAndBenchmark(env, { organizationId, campaignId, templateId, currentKpis: dm.kpis });
    base.trend_intelligence = trend_intelligence;
    base.benchmark_dashboard = benchmark_dashboard;
  } else {
    base.trend_intelligence = { available: false, reason: 'Campaign context not provided.' };
    base.benchmark_dashboard = { available: false, reason: 'Campaign context not provided.' };
  }
  return base;
}
