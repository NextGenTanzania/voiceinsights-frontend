// Phase 20 enrichment runner — calls the internal Phase 19 enrich endpoint first,
// then the read-only Phase 20 package is available automatically through backend routes.
// This script does not create data, change numbers, or rebuild reports.

const BASE_URL = process.argv[2];
const TOKEN = process.argv[3];

if (!BASE_URL || !TOKEN) {
  console.error('Usage: node scripts/enrich-demo-reports.js <BASE_URL> <VI_TOKEN>');
  process.exit(1);
}

async function getDemoReports() {
  const res = await fetch(`${BASE_URL}/api/public/demo-reports`);
  if (!res.ok) throw new Error(`Could not list demo reports: HTTP ${res.status}`);
  const data = await res.json();
  return data.reports || [];
}

async function enrich(report) {
  const res = await fetch(`${BASE_URL}/api/reports/${report.id}/trust/enrich`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || text}`);

  const v20 = await fetch(`${BASE_URL}/api/public/demo-reports/${report.id}/experience`);
  const v20data = await v20.json();
  if (!v20.ok) throw new Error(`Phase 20 read failed for ${report.id}: ${v20data.error || v20.status}`);
  const brief = v20data.one_page_executive_brief || {};
  const ig = v20data.publication_infographic || {};
  const ev = v20data.evidence_traceability || [];
  return {
    id: report.id,
    title: report.template_name,
    quality: v20data.report_quality_gate?.overall_score,
    findings: brief.five_key_findings?.length || 0,
    decisions: brief.three_recommended_decisions?.length || 0,
    infographic_pages: ig.pages?.length || 0,
    evidence_items: ev.length,
  };
}

async function main() {
  const reports = await getDemoReports();
  let ok = 0;
  for (const r of reports) {
    try {
      const out = await enrich(r);
      ok += 1;
      console.log(`OK ${out.title} (${out.id}) — quality=${out.quality}, findings=${out.findings}, decisions=${out.decisions}, infographic_pages=${out.infographic_pages}, evidence=${out.evidence_items}`);
    } catch (e) {
      console.error(`FAILED ${r.template_name} (${r.id}): ${e.message}`);
    }
  }
  console.log(`\nPhase 20 verified ${ok}/${reports.length} demo reports.`);
  if (ok !== reports.length) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
