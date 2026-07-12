// ============================================================
// INTERACTIVE REPORT DASHBOARD (Phase 9, Task 9.3)
// ------------------------------------------------------------
// Drill-down and comparison queries — reuses the EXACT same query
// patterns already proven in report-generator.js (Task 8.2), just with
// additional WHERE filters. Does not modify buildDocumentModel() at all;
// this is a parallel, read-only capability layered on the same tables.
// ============================================================

// Filtered KPI + sentiment + findings, scoped to one campaign PLUS whatever
// region/gender/age filters the user applied in the viewer. Used for
// "drill-down" — e.g. "show me only Dodoma region, female respondents".
export async function buildDrilldown(env, { organizationId, campaignId, region, gender, ageBracket }) {
  const conditions = ['c.organization_id = ?'];
  const binds = [organizationId];
  if (campaignId) { conditions.push('c.id = ?'); binds.push(campaignId); }
  if (region) { conditions.push('resp.region = ?'); binds.push(region); }

  const needsDemJoin = !!(gender || ageBracket);
  let demJoin = '';
  if (needsDemJoin) {
    demJoin = 'LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id';
    if (gender) { conditions.push('dem.gender = ?'); binds.push(gender); }
    if (ageBracket) { conditions.push('dem.age_bracket = ?'); binds.push(ageBracket); }
  }

  const whereClause = conditions.join(' AND ');

  const totalResponses = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id ${demJoin} WHERE ${whereClause}`
  ).bind(...binds).first();

  const { results: sentimentRows } = await env.DB.prepare(
    `SELECT COALESCE(r.overall_sentiment, 'Not yet analyzed') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id ${demJoin}
     WHERE ${whereClause} GROUP BY label`
  ).bind(...binds).all();

  const { results: regionRows } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Not provided') as label, COUNT(*) as n
     FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id ${demJoin}
     WHERE ${whereClause} GROUP BY label ORDER BY n DESC LIMIT 15`
  ).bind(...binds).all();

  return {
    filters_applied: { region: region || null, gender: gender || null, age_bracket: ageBracket || null },
    total_responses: totalResponses.n,
    sentiment: sentimentRows,
    regions: regionRows,
  };
}

// Side-by-side comparison of multiple reports' KPIs — supports "compare
// time periods" (different versions of the same series), "compare
// campaigns" (different campaign_id), and "compare organizations"
// (different organization_id, Super Admin only — enforced by the caller).
export async function buildComparison(env, reportRows) {
  return reportRows.map(row => {
    const dm = JSON.parse(row.document_model_json);
    return {
      report_id: row.id,
      organization_name: dm.metadata.organization_name,
      campaign_name: dm.metadata.campaign_name,
      generated_at: dm.metadata.generated_at,
      kpis: dm.kpis,
      sentiment: dm.findings.sentiment,
    };
  });
}
