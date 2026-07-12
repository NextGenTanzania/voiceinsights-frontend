const REPORTS = [
  { template: 'health_survey', country: 'Tanzania' },
  { template: 'education_assessment', country: 'Kenya' },
  { template: 'agriculture_survey', country: 'Uganda' },
  { template: 'livelihood_assessment', country: 'Tanzania' },
  { template: 'humanitarian_needs', country: 'South Sudan' },
  { template: 'baseline_study', country: 'Malawi' },
  { template: 'endline_evaluation', country: 'Malawi' },
  { template: 'market_research', country: 'Rwanda' },
  { template: 'customer_satisfaction', country: 'Kenya' },
  { template: 'employee_engagement', country: 'Tanzania' },
  { template: 'citizen_feedback', country: 'Tanzania' },
  { template: 'community_scorecard', country: 'Zambia' },
  { template: 'monitoring_report', country: 'Ethiopia' },
  { template: 'quarterly_performance', country: 'Tanzania' },
  { template: 'annual_impact', country: 'Tanzania' },
  { template: 'sdg_progress', country: 'Tanzania' },
];

const BASE_URL = process.argv[2] || 'http://localhost:8799';
const TOKEN = process.argv[3];

async function run() {
  const results = [];
  for (const r of REPORTS) {
    const campaignId = `demo_camp_${r.template}`;
    const res = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: r.template, campaign_id: campaignId }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`FAILED for ${r.template}: HTTP ${res.status}`, data.error);
      continue;
    }
    console.log(`OK ${r.template} -> ${data.report_id} (${data.document_model.kpis.total_responses} responses)`);
    results.push({ template: r.template, report_id: data.report_id, country: r.country });
  }
  console.log('\n--- SQL to mark these as demo reports ---');
  results.forEach(r => {
    console.log(`UPDATE generated_reports SET is_demo = 1, demo_country = '${r.country}', status = 'published' WHERE id = '${r.report_id}';`);
  });
}

run();
