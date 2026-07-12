// Fixes a real gap found during verification: the v2 seed generator's
// ai_insights.content_json omitted the `topics` array that
// report-generator.js's buildDocumentModel() reads to populate
// findings.topics (Theme/Topic Analysis) — it only had {sentiment, summary}.
// This regenerates the content_json for the existing 240 rows (15 per
// report x 16 reports) with report-specific topic labels, rather than
// re-seeding all 16,000 responses from scratch.

const TOPICS_BY_TEMPLATE = {
  health_survey: ['facility access', 'medicine availability', 'waiting time', 'maternal health', 'child immunization', 'affordability', 'referral challenges', 'health worker attitude', 'digital health awareness'],
  education_assessment: ['classroom overcrowding', 'teacher availability', 'learning materials', 'attendance', 'girls participation', 'digital learning', 'parental engagement', 'school feeding'],
  agriculture_survey: ['improved seeds', 'fertilizer access', 'market prices', 'extension services', 'climate shocks', 'irrigation', 'post-harvest loss', 'mobile money'],
  livelihood_assessment: ['income stability', 'youth employment', 'small business growth', 'vocational skills', 'savings groups', 'financial inclusion', 'economic shocks', 'women-led enterprises'],
  humanitarian_needs: ['food security', 'shelter', 'WASH', 'protection', 'health access', 'education disruption', 'safety', 'assistance timeliness'],
  baseline_study: ['antenatal care', 'facility delivery', 'nutrition', 'child immunization', 'health knowledge', 'community health workers', 'barriers to care'],
  endline_evaluation: ['antenatal care', 'facility delivery', 'nutrition', 'child immunization', 'health knowledge', 'community health workers', 'barriers to care'],
  market_research: ['awareness', 'willingness to pay', 'trust', 'digital access', 'competitor comparison', 'pricing sensitivity', 'customer segments'],
  customer_satisfaction: ['speed of service', 'customer support', 'fees', 'mobile app reliability', 'complaints handling', 'branch experience', 'trust', 'recommendation intent'],
  employee_engagement: ['job satisfaction', 'leadership trust', 'workload', 'communication', 'career growth', 'recognition', 'wellbeing', 'retention risk'],
  citizen_feedback: ['waste management', 'roads', 'water supply', 'permits', 'communication', 'complaints handling', 'trust in local government'],
  community_scorecard: ['service availability', 'staff attitude', 'infrastructure', 'community participation', 'accountability', 'action plan follow-through'],
  monitoring_report: ['activity delivery', 'beneficiary reach', 'training completion', 'grant disbursement', 'market linkage', 'management response'],
  quarterly_performance: ['quarterly targets', 'budget absorption', 'regional performance', 'risks', 'management decisions'],
  annual_impact: ['reach', 'employment outcomes', 'entrepreneurship', 'skills training', 'gender inclusion', 'partnerships', 'sustainability'],
  sdg_progress: ['service delivery trend', 'water access', 'gender representation', 'climate shocks', 'health access', 'poverty reduction', 'education access', 'transparency'],
};

let seed = 77;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

const lines = [];
for (const [template, topics] of Object.entries(TOPICS_BY_TEMPLATE)) {
  for (let i = 0; i < 15; i++) {
    const id = `demo_ai2_${template}_${i}`;
    const topicPick = [pick(topics)];
    if (rand() > 0.5) topicPick.push(pick(topics));
    const contentJson = JSON.stringify({ topics: topicPick }).replace(/'/g, "''");
    lines.push(`UPDATE ai_insights SET content_json = json_patch(content_json, '${contentJson}') WHERE id = '${id}';`);
  }
}
console.log(lines.join('\n'));
