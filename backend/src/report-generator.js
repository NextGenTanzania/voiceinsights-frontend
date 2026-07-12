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
  const { results: quoteRows } = await env.DB.prepare(
    `SELECT t.raw_text, r.overall_sentiment, r.started_at, r.channel FROM transcripts t
     JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
     WHERE c.organization_id = ? ${campaignFilter} AND t.raw_text IS NOT NULL AND LENGTH(t.raw_text) > 15
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
    },
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
