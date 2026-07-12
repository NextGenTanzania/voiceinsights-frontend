const BASE_URL = process.argv[2];
const TOKEN = process.argv[3];
if (!BASE_URL || !TOKEN) {
  console.error('Usage: node scripts/enrich-demo-reports-legacy-archive.js <API_BASE_URL> <VI_TOKEN>');
  process.exit(1);
}

async function main() {
  const listRes = await fetch(`${BASE_URL}/api/public/demo-reports`);
  const list = await listRes.json();
  if (!list.reports?.length) throw new Error('No public demo reports found.');
  let ok = 0;
  for (const r of list.reports) {
    const res = await fetch(`${BASE_URL}/api/reports/${r.id}/intelligence-os`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`FAILED ${r.template_name} (${r.id}): HTTP ${res.status} ${data.error || ''}`);
      continue;
    }
    ok += 1;
    console.log(`OK ${r.template_name} (${r.id}) — quality=${data.quality_gate?.overall_score}, citations=${data.evidence_citations}, formats=${data.report_formats}`);
  }
  console.log(`\nIntelligence OS v7 enriched ${ok}/${list.reports.length} demo reports.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
