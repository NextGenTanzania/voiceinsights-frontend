// ============================================================
// BENCHMARK ENGINE (Phase 9, Task 9.4)
// ------------------------------------------------------------
// Compares one report's KPIs against: the same organization's previous
// campaign, the same period a year/quarter ago, this organization's own
// average, a sector-wide average, and configured SDG/donor targets.
//
// TENANT ISOLATION: sector_average is an AGGREGATE across organizations
// sharing report_templates.sector — it NEVER exposes which other
// organization contributed what, and is only returned at all when at
// least 3 DISTINCT other organizations have data, so a "sector average"
// can never be used to reverse-engineer a single competitor's performance
// from a comparison of 1.
// ============================================================

export async function buildBenchmark(env, { organizationId, campaignId, templateId, currentKpis }) {
  const benchmark = {};

  // ---- Previous campaign (same org, an earlier campaign) ----
  const previousCampaign = await env.DB.prepare(
    `SELECT c.id, c.name,
            (SELECT COUNT(*) FROM responses WHERE campaign_id = c.id) as total_responses,
            (SELECT COUNT(*) FROM responses WHERE campaign_id = c.id AND status = 'completed') as completed_responses
     FROM campaigns c WHERE c.organization_id = ? AND c.id != ? ORDER BY c.created_at DESC LIMIT 1`
  ).bind(organizationId, campaignId || '').first();
  benchmark.previous_campaign = previousCampaign ? {
    name: previousCampaign.name,
    total_responses: previousCampaign.total_responses,
    response_rate_pct: previousCampaign.total_responses ? Math.round((previousCampaign.completed_responses / previousCampaign.total_responses) * 100) : null,
  } : null;

  // ---- Same period, one year ago (same organization) ----
  const yearAgo = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
     WHERE c.organization_id = ? AND r.started_at BETWEEN datetime('now', '-13 months') AND datetime('now', '-11 months')`
  ).bind(organizationId).first();
  benchmark.same_period_last_year = { total_responses: yearAgo.n };

  // ---- This organization's own average across all its campaigns ----
  const orgAverage = await env.DB.prepare(
    `SELECT AVG(cnt) as avg_responses FROM (
       SELECT COUNT(*) as cnt FROM responses r JOIN campaigns c ON r.campaign_id = c.id
       WHERE c.organization_id = ? GROUP BY c.id
     )`
  ).bind(organizationId).first();
  benchmark.organization_average = { avg_responses_per_campaign: orgAverage.avg_responses != null ? Math.round(orgAverage.avg_responses) : null };

  // ---- Sector average — anonymized, minimum-3-other-orgs threshold ----
  if (templateId) {
    const sectorRow = await env.DB.prepare('SELECT sector FROM report_templates WHERE id = ?').bind(templateId).first();
    if (sectorRow?.sector) {
      const { results: sectorOrgs } = await env.DB.prepare(
        `SELECT DISTINCT c.organization_id, AVG(sub.cnt) as avg_responses FROM (
           SELECT c2.organization_id as org_id, c2.id as campaign_id, COUNT(r2.id) as cnt
           FROM campaigns c2 LEFT JOIN responses r2 ON r2.campaign_id = c2.id
           JOIN generated_reports gr ON gr.campaign_id = c2.id
           JOIN report_templates rt ON gr.template_id = rt.id AND rt.sector = ?
           WHERE c2.organization_id != ?
           GROUP BY c2.id
         ) sub
         JOIN campaigns c ON c.id = sub.campaign_id
         GROUP BY c.organization_id`
      ).bind(sectorRow.sector, organizationId).all();

      if (sectorOrgs.length >= 3) {
        const overallAvg = sectorOrgs.reduce((sum, o) => sum + o.avg_responses, 0) / sectorOrgs.length;
        benchmark.sector_average = { avg_responses_per_campaign: Math.round(overallAvg), contributing_organizations: sectorOrgs.length };
      } else {
        benchmark.sector_average = { available: false, reason: 'Not enough other organizations in this sector yet to show an anonymized average (minimum 3 required).' };
      }
    }
  }

  // ---- Configured targets (SDG defaults + this org's donor KPIs) ----
  const { results: targets } = await env.DB.prepare(
    `SELECT metric_name, target_value, target_type, label FROM benchmark_targets WHERE organization_id IS NULL OR organization_id = ?`
  ).bind(organizationId).all();
  benchmark.targets = targets.map(t => ({
    ...t,
    current_value: currentKpis[t.metric_name] ?? null,
    met: currentKpis[t.metric_name] != null ? currentKpis[t.metric_name] >= t.target_value : null,
  }));

  return benchmark;
}

// AI commentary explaining the benchmark differences — grounded ONLY in
// the benchmark object above (which is itself grounded only in real
// queries). Same reliability discipline as the rest of Phase 8/9: zero
// comparison data never calls Claude; a non-2xx response throws.
export async function writeBenchmarkCommentary(env, { benchmark, metadata, currentKpis }) {
  const hasAnyComparison = benchmark.previous_campaign || benchmark.sector_average?.avg_responses_per_campaign || benchmark.targets?.length;
  if (!hasAnyComparison) {
    return { commentary: 'Not enough historical or comparative data exists yet to generate a meaningful benchmark commentary.' };
  }

  const prompt = `You are writing a short benchmark commentary for a research report. Explain what the comparisons below mean in practical terms — do not invent numbers not shown here.

CURRENT REPORT KPIs: ${JSON.stringify(currentKpis)}
BENCHMARK DATA: ${JSON.stringify(benchmark)}
ORGANIZATION: ${metadata.organization_name}

Respond with 2-3 sentences of plain commentary — no JSON, just the text.`;

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!claudeResp.ok) {
    throw new Error(`Claude API returned HTTP ${claudeResp.status} (${claudeResp.statusText || 'error'})`);
  }
  const data = await claudeResp.json();
  const commentary = (data.content || []).map(c => c.text || '').join('').trim();
  if (!commentary) throw new Error('Claude returned an empty response');
  return { commentary };
}
