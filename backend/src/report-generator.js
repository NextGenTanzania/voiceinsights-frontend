// ============================================================
// REPORT GENERATOR CORE (Phase 8, Task 8.2)
// ------------------------------------------------------------
// Assembles a complete, structured "document model" from REAL project data.
// This is the single source of truth every export format (PDF/Word/PPTX/
// Excel — Task 8.6) will later render FROM, and what the AI Narrative
// Engine (Task 8.3) reads to write grounded prose — never the reverse.
// Every number in here comes from a real D1 query against real responses;
// nothing here is templated or fabricated.
// ============================================================

import { buildChartSpecs } from './visualization-engine.js';
import { sha256Hex } from './enterprise-identity-access.js';

// Deterministic dataset identity (Customer Report Generation Pilot Hardening
// release, Part 1). The SAME underlying data must always produce the SAME
// dataset_version — never random, never generation-timestamp-only, and
// (this revision) never response-COUNT-only either: two datasets with the
// same count but different content must not collide.
//
// KNOWN SCHEMA LIMITATION (documented per the release spec's own
// allowance): backend/schema.sql's `responses` table has no `updated_at`
// or explicit revision column — only `id, status, fraud_score, started_at,
// completed_at`. This fingerprint uses those as the best available revision
// proxy (COALESCE(completed_at, started_at) as the per-response "last
// touched" signal, `status` as inclusion state, `fraud_score` as quality
// state). It does NOT incorporate consent state (consent_vault_records is
// not currently joined to `responses` in an indexed way) or an
// answer/transcript revision id (no such column exists). If/when those
// columns are added, extend the per-response string below — the hashing
// approach does not need to change.
export async function buildDatasetIdentity({ organizationId, projectId, surveyId, responseRows = [], analysisPlanVersion = null, datasetLockVersion = null }) {
  const scope = projectId || 'org-wide';
  const totalResponses = responseRows.length;
  if (!totalResponses) {
    return {
      state: 'EMPTY',
      organization_id: organizationId,
      project_id: projectId || null,
      survey_id: surveyId || null,
      response_count: 0,
      response_fingerprint: null,
      dataset_version: `empty:${organizationId}:${scope}`,
    };
  }
  // Sorted by response id so query row ORDER never affects the fingerprint
  // ("Reordered query results alone -> unchanged version").
  const perResponse = responseRows
    .map(r => `${r.id}|${r.status || ''}|${r.fraud_score ?? ''}|${r.completed_at || r.started_at || ''}`)
    .sort();
  const responseFingerprint = await sha256Hex(perResponse.join('\n'));
  const identitySeed = `${organizationId}:${scope}:${surveyId || 'no-survey'}:${responseFingerprint}:${analysisPlanVersion || 'no-plan'}:${datasetLockVersion || 'unlocked'}:n${totalResponses}`;
  return {
    state: 'POPULATED',
    organization_id: organizationId,
    project_id: projectId || null,
    survey_id: surveyId || null,
    response_count: totalResponses,
    response_fingerprint: responseFingerprint,
    dataset_version: await sha256Hex(identitySeed),
  };
}

// Phase 11: fetches this report type's permanent editorial guideline, if
// one exists. Returns null if not found -- every AI-writing function that
// accepts this is designed to work identically to before Phase 11 when
// null/undefined is passed, so this is a purely additive lookup.
export async function getEditorialGuideline(env, templateId) {
  const row = await env.DB.prepare('SELECT * FROM report_editorial_guidelines WHERE template_id = ?').bind(templateId).first();
  if (!row) return null;
  return {
    tone_and_voice: row.tone_and_voice,
    section_rules: JSON.parse(row.section_rules_json),
    sector_knowledge: JSON.parse(row.sector_knowledge_json),
    recommendation_categories: JSON.parse(row.recommendation_categories_json),
    forbidden_behaviors: JSON.parse(row.forbidden_behaviors_json),
  };
}

export async function buildDocumentModel(env, { templateId, organizationId, campaignId }) {
  const template = await env.DB.prepare(
    `SELECT id, name, sector, sections_json, standards_json, target_page_band, chart_defaults_json FROM report_templates WHERE id = ? AND is_active = 1`
  ).bind(templateId).first();
  if (!template) throw new Error(`Report template "${templateId}" not found or inactive`);

  const sections = JSON.parse(template.sections_json);
  const standards = template.standards_json ? JSON.parse(template.standards_json) : [];
  // Parsed but not yet consumed directly — reserved as a future per-template
  // author HINT the Visualization Engine could weigh alongside real data
  // shape. Today the engine (buildChartSpecs, Task 8.5) decides purely from
  // actual data shape, which is deliberately the stronger signal.
  const chartDefaults = template.chart_defaults_json ? JSON.parse(template.chart_defaults_json) : {};

  const org = await env.DB.prepare('SELECT id, name FROM organizations WHERE id = ?').bind(organizationId).first();
  if (!org) throw new Error('Organization not found');

  const branding = await env.DB.prepare('SELECT * FROM organization_branding WHERE organization_id = ?').bind(organizationId).first();

  const campaign = campaignId
    ? await env.DB.prepare(
        `SELECT c.id, c.name, c.channel, c.target_respondents, c.created_at, s.title as survey_title, s.id as survey_id
         FROM campaigns c LEFT JOIN surveys s ON c.survey_id = s.id WHERE c.id = ? AND c.organization_id = ?`
      ).bind(campaignId, organizationId).first()
    : null;
  // Part 3 (scope ownership validation): a campaign_id was explicitly
  // requested but did not resolve for this organization — either it does
  // not exist, or it belongs to a different organization. Either way this
  // must be rejected explicitly, not silently downgraded to an
  // organization-wide report as if no campaign had been requested at all.
  if (campaignId && !campaign) throw new Error('Campaign not found for this organization');

  const campaignFilter = campaignId ? 'AND c.id = ?' : '';
  const bindArgs = campaignId ? [organizationId, campaignId] : [organizationId];

  // ---------- KPIs (real counts) ----------
  const totalResponses = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campaignFilter}`
  ).bind(...bindArgs).first();
  const completedResponses = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campaignFilter} AND r.status = 'completed'`
  ).bind(...bindArgs).first();
  const responseRate = totalResponses.n ? Math.round((completedResponses.n / totalResponses.n) * 100) : null;
  // Raw response identity rows for the dataset content fingerprint (Part 1,
  // Enterprise Report Studio UI Pilot release) — id/status/fraud_score/
  // completed_at only, never answer text or any respondent-identifying
  // field, so the fingerprint itself carries no personal information.
  const { results: responseIdentityRows } = await env.DB.prepare(
    `SELECT r.id, r.status, r.fraud_score, r.completed_at, r.started_at FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campaignFilter}`
  ).bind(...bindArgs).all();

  // ---------- Demographics (real, with the Task 1.2.5 "Not provided" fallback pattern) ----------
  const { results: genderRows } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(TRIM(dem.gender), ''), 'Not provided') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
     LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
     WHERE c.organization_id = ? ${campaignFilter} GROUP BY label ORDER BY n DESC`
  ).bind(...bindArgs).all();
  const { results: ageRows } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(TRIM(dem.age_bracket), ''), 'Not provided') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
     LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
     WHERE c.organization_id = ? ${campaignFilter} GROUP BY label ORDER BY label ASC`
  ).bind(...bindArgs).all();
  const { results: regionRows } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Not provided') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
     WHERE c.organization_id = ? ${campaignFilter} GROUP BY label ORDER BY n DESC LIMIT 15`
  ).bind(...bindArgs).all();

  // ---------- Sentiment + Topics (from real ai_insights, same pattern as /api/analytics/summary) ----------
  const { results: sentimentRows } = await env.DB.prepare(
    `SELECT COALESCE(r.overall_sentiment, 'Not yet analyzed') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campaignFilter} GROUP BY label`
  ).bind(...bindArgs).all();
  const { results: insightRows } = await env.DB.prepare(
    `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
     WHERE c.organization_id = ? ${campaignFilter} AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 300`
  ).bind(...bindArgs).all();
  const topicCounts = {};
  const allTopicSummaries = [];
  for (const row of insightRows) {
    try {
      const parsed = JSON.parse(row.content_json);
      for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1;
      if (parsed.summary) allTopicSummaries.push(parsed.summary);
    } catch (_) { /* skip malformed rows — never let one bad record break the whole report */ }
  }
  const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => ({ topic, count }));

  // ---------- Representative quotes (real transcripts, capped — never the whole dataset) ----------
  // Quote Evidence Traceability (Canonical Publication Gate release): every
  // quote now carries transcript_id/response_id — real, existing primary
  // keys from this exact join, never fabricated — so the canonical gate can
  // verify a quote's source instead of treating every customer report as
  // unsourced. Filtered to consenting, non-withdrawn respondents at the
  // source: a withdrawn response or a respondent who never consented must
  // never surface as a "representative quote" in the first place, so this
  // is a selection filter, not a downstream label. KNOWN LIMITATION (see
  // buildDatasetIdentity's own note above): there is no deleted/anonymized
  // flag on responses or respondents in this schema today, so "source has
  // not been deleted or anonymized" cannot be independently verified here —
  // only "not withdrawn" and "consent given" are checked, because those are
  // the only two states this schema actually tracks.
  const { results: quoteRows } = await env.DB.prepare(
    `SELECT t.raw_text, r.overall_sentiment, r.started_at, r.channel,
            t.id as transcript_id, r.id as response_id, resp.consent_given as consent_given
     FROM transcripts t
     JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
     JOIN respondents resp ON r.respondent_id = resp.id
     WHERE c.organization_id = ? ${campaignFilter} AND t.raw_text IS NOT NULL AND LENGTH(t.raw_text) > 15
       AND r.status != 'withdrawn' AND resp.consent_given = 1
     ORDER BY r.started_at DESC LIMIT 12`
  ).bind(...bindArgs).all();

  // ---------- Data Quality / Fraud (real, from the Fraud Engine already built) ----------
  const fraudStats = await env.DB.prepare(
    `SELECT AVG(fraud_score) as avg_score, SUM(CASE WHEN fraud_score >= 0.5 THEN 1 ELSE 0 END) as flagged_count
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campaignFilter} AND fraud_score IS NOT NULL`
  ).bind(...bindArgs).first();
  const transcriptionQuality = await env.DB.prepare(
    `SELECT AVG(CAST(json_extract(ai.content_json, '$.confidence') AS REAL)) as avg_confidence
     FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
     WHERE c.organization_id = ? ${campaignFilter} AND ai.insight_type = 'transcription_quality'`
  ).bind(...bindArgs).first();

  // ---------- Annexes: real questionnaire ----------
  const { results: questions } = campaign?.survey_id
    ? await env.DB.prepare('SELECT order_index, question_text, question_type FROM questions WHERE survey_id = ? ORDER BY order_index ASC').bind(campaign.survey_id).all()
    : { results: [] };

  const datasetIdentity = await buildDatasetIdentity({
    organizationId, projectId: campaignId || null, surveyId: campaign?.survey_id || null,
    responseRows: responseIdentityRows,
  });

  // ---------- Assemble the document model ----------
  return {
    metadata: {
      template_id: template.id,
      template_name: template.name,
      sector: template.sector,
      standards,
      target_page_band: template.target_page_band,
      template_chart_hints: chartDefaults, // the template author's original intent — the engine may override per-section based on actual data shape (Task 8.5)
      organization_name: org.name,
      campaign_name: campaign?.name || null,
      survey_title: campaign?.survey_title || null,
      generated_at: new Date().toISOString(),
      // Part 3 (Customer Report Generation Pilot Hardening): explicit scope,
      // never inferred solely from a nullable campaign_id. CAMPAIGN scope is
      // only asserted once ownership has already been validated above (the
      // "WHERE c.id = ? AND c.organization_id = ?" join returns null, not
      // another org's campaign, if ownership does not hold).
      scope_type: campaignId ? 'CAMPAIGN' : 'ORGANIZATION',
    },
    dataset_identity: datasetIdentity,
    branding: branding ? {
      logo_r2_key: branding.logo_r2_key, primary_color: branding.primary_color, secondary_color: branding.secondary_color,
      font_family: branding.font_family, header_text: branding.header_text, footer_text: branding.footer_text,
      disclaimer_text: branding.disclaimer_text, confidentiality_text: branding.confidentiality_text, contact_details: branding.contact_details,
    } : {
      // Platform default branding — used whenever an org hasn't configured
      // their own yet, so every report is always fully branded, never blank.
      primary_color: '#E4A23A', secondary_color: '#1E2620', font_family: 'Inter',
      header_text: 'VoiceInsights Africa', footer_text: 'Generated by VoiceInsights Africa — voiceinsightsafrica.com',
      disclaimer_text: 'This report was generated using AI-assisted analysis of real survey data. Findings should be reviewed by a qualified analyst before use in decision-making.',
      confidentiality_text: null, contact_details: 'partnerships@voiceinsightsafrica.com',
    },
    kpis: {
      total_responses: totalResponses.n,
      completed_responses: completedResponses.n,
      response_rate_pct: responseRate,
      regions_covered: regionRows.length,
    },
    demographics: { gender: genderRows, age: ageRows, regions: regionRows },
    findings: {
      sentiment: sentimentRows,
      topics,
      representative_quotes: quoteRows,
    },
    charts: buildChartSpecs({
      demographics: { gender: genderRows, age: ageRows, regions: regionRows },
      findings: { sentiment: sentimentRows, topics },
      dataQuality: { avg_fraud_score: fraudStats.avg_score, flagged_count: fraudStats.flagged_count },
    }),
    data_quality: {
      avg_fraud_score: fraudStats.avg_score != null ? Number(fraudStats.avg_score.toFixed(2)) : null,
      flagged_response_count: fraudStats.flagged_count || 0,
      avg_transcription_confidence: transcriptionQuality.avg_confidence != null ? Number(transcriptionQuality.avg_confidence.toFixed(2)) : null,
    },
    // Consolidated, AI-ready package (Task 8.3 reads THIS, never raw tables
    // directly) — keeps the AI Narrative Engine decoupled from schema details.
    ai_ready_package: {
      total_responses: totalResponses.n,
      response_rate_pct: responseRate,
      top_topics: topics,
      sentiment_breakdown: sentimentRows,
      sample_quotes: quoteRows.slice(0, 8).map(q => q.raw_text),
      demographics_summary: { gender: genderRows, age: ageRows, top_regions: regionRows.slice(0, 5) },
      data_quality_flags: fraudStats.flagged_count || 0,
    },
    recommendations: null, // filled by the AI Narrative Engine (Task 8.3) — never fabricated here
    annexes: {
      questionnaire: questions,
      statistical_tables: { gender: genderRows, age: ageRows, regions: regionRows, sentiment: sentimentRows },
    },
  };
}

// ------------------------------------------------------------
// Canonical Publication Quality Gate input adapter (Customer Report
// Generation Route Canonical Gate Pilot, Part 2).
//
// Converts a real customer documentModel (above) into the input shape
// evaluatePublicationGate() (quality-scoring-engine.js) expects. Lives here,
// not inside the canonical engine, so the canonical engine never has to
// know anything customer-specific — this is deliberately the one place
// that field-guesses for this one caller.
//
// Honesty constraint: the current customer documentModel has no evidence
// registry, no methodology record, no claims/quotation-provenance layer,
// and no dataset-versioning concept. This adapter does not invent any of
// those — it maps only what genuinely exists. That means a real customer
// report will typically come back BLOCKED / evidence_traceability=0 from
// the canonical gate today: that is an accurate reflection of a real,
// separate platform gap (no evidence-registry layer for customer reports
// yet), not a bug in this adapter. See the pilot release notes.
// ------------------------------------------------------------
export function buildCustomerPublicationGateInput({
  documentModel, organizationId, projectId, reportId, reportVersion, datasetVersion,
  requestedBy, route, reportType, publicationVisibility, requestedFormat,
} = {}) {
  const dm = documentModel || {};
  const totalResponses = dm.kpis?.total_responses || 0;
  const topics = Array.isArray(dm.findings?.topics) ? dm.findings.topics : [];
  const quotes = Array.isArray(dm.findings?.representative_quotes) ? dm.findings.representative_quotes : [];
  const charts = Array.isArray(dm.charts) ? dm.charts : [];
  const standards = Array.isArray(dm.metadata?.standards) ? dm.metadata.standards : [];

  return {
    dataset_version: datasetVersion || dm.dataset_identity?.dataset_version || null,
    dataset_state: dm.dataset_identity?.state || (totalResponses > 0 ? 'POPULATED' : 'EMPTY'),
    scope_type: dm.metadata?.scope_type || (projectId ? 'CAMPAIGN' : 'ORGANIZATION'),
    organization_id: organizationId || null,
    project_id: projectId || null,
    // There is no separate "requested org" concept at this call site — the
    // org the request is scoped to (via getEffectiveOrgId) IS the resource
    // org, so this is always equal unless a future caller passes otherwise.
    requested_by_org_id: organizationId || null,
    is_demo: false, // Part 2: a customer report is never inferred as synthetic
    report_type: reportType || (totalResponses > 0 ? 'standard' : 'insufficient_evidence'),
    // Topic tallies are real, DB-backed counts (report-generator.js above) —
    // restating them as findings text is not fabrication, but they carry no
    // evidence_ids because the customer pipeline has no evidence registry yet.
    findings: topics.map(t => ({ text: `${t.topic} (${t.count} mentions)`, evidence_ids: [] })),
    evidence: [],
    decisions: [], // recommendations are filled later by the AI Narrative Engine, not at generation time
    methodology: null,
    statistics: [],
    claims: [],
    // source_id/evidence_id are real transcripts/responses primary keys
    // (see the query above) — never generated here, never a raw-text hash.
    // organization_id lets the canonical engine's cross-tenant check
    // confirm a quote's source actually belongs to the report's own org,
    // even though today's query already guarantees this structurally (the
    // WHERE c.organization_id = ? above) — defense in depth for any future
    // caller of this adapter that might not have the same guarantee.
    quotes: quotes.map(q => ({
      text: q.raw_text,
      source_id: q.response_id || null,
      evidence_id: q.transcript_id || null,
      organization_id: organizationId || null,
    })),
    approvals: { required: [], completed: [] },
    exports: {},
    accessibility: {},
    sdgs: standards.filter(s => /^SDG/i.test(s)),
    editorial: {},
    // buildChartSpecs always emits at least one structural placeholder (a
    // "data quality" KPI card) even with zero responses — that is chrome,
    // not a data visualization making a claim, so it must not make the
    // canonical gate's visualization_quality domain "applicable" (and then
    // fail it) for a report that has nothing to visualize yet.
    visualizations: totalResponses > 0 ? charts.map((c, i) => ({ id: c.id || `chart-${i + 1}`, evidence_ids: [] })) : [],
    // Passed through untouched for the caller's own context object, not
    // consumed by evaluatePublicationGate itself.
    _context: { reportId, reportVersion, requestedBy, route, publicationVisibility, requestedFormat },
  };
}
