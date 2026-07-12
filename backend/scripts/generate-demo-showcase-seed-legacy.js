// Generates tests/demo-showcase-seed-legacy.sql — a fictional-but-internally-
// consistent dataset for the 16 Enterprise Report Showcase demonstration
// reports (Task 8.10). Every respondent/response row is clearly fictional
// (demo organization, demo phone number prefix), but flows through the
// REAL schema exactly like real data would — so the real Report Engine
// (buildDocumentModel) can generate real document_model_json from it.
//
// Run: node scripts/generate-demo-showcase-seed-legacy.js > tests/demo-showcase-seed-legacy.sql

const REPORTS = [
  { template: 'health_survey', name: 'National Health Access Survey — Demo', country: 'Tanzania', n: 420, sector: 'health' },
  { template: 'education_assessment', name: 'Primary Education Outcomes Assessment — Demo', country: 'Kenya', n: 380, sector: 'education' },
  { template: 'agriculture_survey', name: 'Smallholder Farmer Survey — Demo', country: 'Uganda', n: 320, sector: 'agriculture' },
  { template: 'livelihood_assessment', name: 'Rural Livelihoods Assessment — Demo', country: 'Tanzania', n: 280, sector: 'economic_development' },
  { template: 'humanitarian_needs', name: 'Rapid Humanitarian Needs Assessment — Demo', country: 'South Sudan', n: 500, sector: 'humanitarian' },
  { template: 'baseline_study', name: 'Maternal Health Program Baseline — Demo', country: 'Malawi', n: 400, sector: 'monitoring_evaluation' },
  { template: 'endline_evaluation', name: 'Maternal Health Program Endline — Demo', country: 'Malawi', n: 400, sector: 'monitoring_evaluation' },
  { template: 'market_research', name: 'Mobile Banking Market Study — Demo', country: 'Rwanda', n: 250, sector: 'private_sector' },
  { template: 'customer_satisfaction', name: 'Retail Banking Satisfaction Survey — Demo', country: 'Kenya', n: 200, sector: 'private_sector' },
  { template: 'employee_engagement', name: 'Staff Engagement Survey — Demo', country: 'Tanzania', n: 150, sector: 'private_sector' },
  { template: 'citizen_feedback', name: 'Municipal Services Feedback — Demo', country: 'Tanzania', n: 300, sector: 'governance' },
  { template: 'community_scorecard', name: 'Health Facility Community Scorecard — Demo', country: 'Zambia', n: 180, sector: 'governance' },
  { template: 'monitoring_report', name: 'WASH Program Monitoring — Demo', country: 'Ethiopia', n: 150, sector: 'monitoring_evaluation' },
  { template: 'quarterly_performance', name: 'Q3 Program Performance Review — Demo', country: 'Tanzania', n: 120, sector: 'monitoring_evaluation' },
  { template: 'annual_impact', name: 'Annual Impact Report FY2025 — Demo', country: 'Tanzania', n: 450, sector: 'monitoring_evaluation' },
  { template: 'sdg_progress', name: 'SDG National Progress Tracking — Demo', country: 'Tanzania', n: 350, sector: 'monitoring_evaluation' },
];

const REGIONS_BY_COUNTRY = {
  Tanzania: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Mbeya', 'Iringa'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
  Uganda: ['Kampala', 'Gulu', 'Mbarara', 'Jinja'],
  'South Sudan': ['Juba', 'Malakal', 'Wau', 'Yei'],
  Malawi: ['Lilongwe', 'Blantyre', 'Mzuzu'],
  Rwanda: ['Kigali', 'Huye', 'Musanze'],
  Zambia: ['Lusaka', 'Ndola', 'Kitwe'],
  Ethiopia: ['Addis Ababa', 'Dire Dawa', 'Bahir Dar'],
};

const GENDERS = ['Male', 'Female'];
const AGE_BRACKETS = ['18-25', '26-35', '36-45', '46-60', '60+'];
const SENTIMENTS = ['positive', 'neutral', 'negative'];
const CHANNELS = ['sms', 'whatsapp', 'app', 'web_link'];

// Deterministic pseudo-random (no external deps, no real Math.random
// non-determinism needed) — same seed always produces the same fictional
// dataset, so re-running this generator is reproducible.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function weightedSentiment() {
  const r = rand();
  return r < 0.55 ? 'positive' : r < 0.85 ? 'neutral' : 'negative'; // realistic skew, not uniform
}

const lines = [];
lines.push('-- Task 8.10: Enterprise Report Showcase demonstration dataset.');
lines.push('-- Fictional data only, clearly namespaced (demo_org, demo_ phone prefix).');
lines.push("INSERT INTO organizations (id, name, type, country) VALUES ('demo_org_showcase', 'VoiceInsights Demo Organization', 'ingo', 'Tanzania');");
lines.push("INSERT INTO surveys (id, organization_id, title, status) VALUES ('demo_survey_showcase', 'demo_org_showcase', 'Demonstration Survey', 'active');");
lines.push("INSERT INTO questions (id, survey_id, order_index, question_text, question_type) VALUES ('demo_q1', 'demo_survey_showcase', 0, 'How would you describe your experience?', 'open_voice');");

const SAMPLE_QUOTES_BY_SECTOR = {
  health: ['The clinic staff were helpful but we waited over three hours.', 'Medicine was available this time, which was not the case last year.', 'The nearest health facility is still too far for elderly patients.'],
  education: ['My children now have textbooks for the first time this term.', 'Class sizes are still too large for the teacher to help everyone.', 'The school lacks clean water, which affects attendance during dry season.'],
  agriculture: ['The new seed variety produced a better yield than last season.', 'We still struggle to get a fair price at the local market.', 'Access to affordable fertilizer remains our biggest challenge.'],
  economic_development: ['A small loan helped me expand my business this year.', 'Transport costs eat into most of what we earn from selling produce.', 'More young people in our village are finding casual work than before.'],
  humanitarian: ['We received food assistance but not enough for the whole family.', 'Clean water access has improved since the new borehole was built.', 'Shelter materials arrived late in the rainy season.'],
  monitoring_evaluation: ['Compared to last year, service delivery has clearly improved.', 'Some of the promised infrastructure has still not been completed.', 'Staff are more responsive than during the baseline period.'],
  private_sector: ['Customer service has improved since the new branch opened.', 'The mobile app is convenient but sometimes fails during transactions.', 'I would recommend this service to others in my community.'],
  governance: ['Local leaders are more responsive to complaints than before.', 'We still do not see budget information shared publicly.', 'The new complaints desk at the ward office is a welcome change.'],
};

REPORTS.forEach((r, idx) => {
  const campaignId = `demo_camp_${r.template}`;
  const regions = REGIONS_BY_COUNTRY[r.country];
  lines.push(`INSERT INTO campaigns (id, survey_id, organization_id, name, channel, target_respondents, status, created_at) VALUES ('${campaignId}', 'demo_survey_showcase', 'demo_org_showcase', '${r.name.replace(/'/g, "''")}', 'sms', ${r.n}, 'active', datetime('now', '-45 days'));`);
  const quotes = SAMPLE_QUOTES_BY_SECTOR[r.sector] || SAMPLE_QUOTES_BY_SECTOR.monitoring_evaluation;

  for (let i = 0; i < r.n; i++) {
    const respId = `demo_resp_${r.template}_${i}`;
    const region = pick(regions);
    const gender = pick(GENDERS);
    const age = pick(AGE_BRACKETS);
    const sentiment = weightedSentiment();
    const phone = `+demo${String(1000000 + idx * 1000 + i)}`;
    const daysAgo = Math.floor(rand() * 40) + 1;

    lines.push(`INSERT INTO respondents (id, organization_id, phone_number, region, consent_given) VALUES ('${respId}', 'demo_org_showcase', '${phone}', '${region}', 1);`);
    lines.push(`INSERT INTO respondent_demographics (respondent_id, organization_id, gender, age_bracket, region) VALUES ('${respId}', 'demo_org_showcase', '${gender}', '${age}', '${region}');`);
    const responseId = `demo_response_${r.template}_${i}`;
    lines.push(`INSERT INTO responses (id, campaign_id, respondent_id, channel, status, overall_sentiment, fraud_score, started_at, completed_at) VALUES ('${responseId}', '${campaignId}', '${respId}', '${pick(CHANNELS)}', 'completed', '${sentiment}', ${(rand() * 0.15).toFixed(2)}, datetime('now', '-${daysAgo} days'), datetime('now', '-${daysAgo} days'));`);

    // Only the first ~15 responses per campaign get a full
    // answer+transcript+ai_insight — these are what the "representative
    // quotes" and "emerging themes" sections actually display (capped at
    // 12/10 respectively in report-generator.js), so generating more than
    // this would be wasted rows with no visible effect.
    if (i < 15) {
      const answerId = `demo_answer_${r.template}_${i}`;
      const quoteText = quotes[i % quotes.length];
      lines.push(`INSERT INTO answers (id, response_id, question_id, answer_text) VALUES ('${answerId}', '${responseId}', 'demo_q1', '${quoteText.replace(/'/g, "''")}');`);
      lines.push(`INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES ('demo_tr_${r.template}_${i}', '${answerId}', '${quoteText.replace(/'/g, "''")}', 'en', 'demo_seed');`);
      const topics = r.sector === 'health' ? ['facility access', 'medicine availability', 'wait times']
        : r.sector === 'education' ? ['learning materials', 'infrastructure', 'attendance']
        : r.sector === 'agriculture' ? ['input access', 'market prices', 'yield']
        : ['service quality', 'access', 'affordability'];
      lines.push(`INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES ('demo_ai_${r.template}_${i}', '${responseId}', 'summary', '${JSON.stringify({ sentiment, topics: [pick(topics)], summary: quoteText }).replace(/'/g, "''")}', 'claude-sonnet-5-demo-seed');`);
    }
  }
});


console.log(lines.join('\n'));
