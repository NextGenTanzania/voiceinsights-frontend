// Enrich all public showcase reports with Phase 19 trust metadata.
// Usage:
// node scripts/enrich-demo-reports-legacy.js https://voiceinsights-api... "VI_TOKEN"

const BASE_URL = process.argv[2] || 'http://localhost:8787';
const TOKEN = process.argv[3];

if (!TOKEN) {
  console.error('Missing token. Usage: node scripts/enrich-demo-reports-legacy.js <BASE_URL> "VI_TOKEN"');
  process.exit(1);
}

async function main() {
  const listRes = await fetch(`${BASE_URL}/api/public/demo-reports`);
  const list = await listRes.json();
  if (!listRes.ok) throw new Error(list.error || 'Could not list demo reports');
  let ok = 0;
  for (const r of list.reports || []) {
    const res = await fetch(`${BASE_URL}/api/reports/${r.id}/trust/enrich`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`FAILED ${r.template_name} (${r.id}): HTTP ${res.status}`, data.error || data);
      continue;
    }
    ok++;
    console.log(`OK ${r.template_name} (${r.id}) — gate=${data.quality_gate.status}, score=${data.quality_gate.overall_score}, verification=${data.ai_verification.status}`);
  }
  console.log(`\nPhase 19 enriched ${ok}/${(list.reports || []).length} demo reports.`);
}

main().catch(e => { console.error(e); process.exit(1); });
