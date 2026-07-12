// v2 — regenerates the Enterprise Report Showcase demo dataset per the
// FINAL TASK spec: exactly 1,000 fictional respondents per report type
// (16 x 1,000 = 16,000), specific countries/regions/focus-areas per
// report as prescribed, feeding the REAL Report Engine (buildDocumentModel)
// — no fake static HTML, no placeholder data.
//
// Run: node scripts/generate-demo-showcase-seed-legacy.js > tests/demo-showcase-seed-legacy.sql

const REPORTS = [
  { template: 'health_survey', name: 'National Health Access Survey — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Morogoro', 'Mbeya'], n: 1000, sector: 'health' },
  { template: 'education_assessment', name: 'Primary Education Quality Assessment — Demo', country: 'Kenya',
    regions: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Garissa'], n: 1000, sector: 'education' },
  { template: 'agriculture_survey', name: 'Smallholder Productivity & Climate Resilience Survey — Demo', country: 'Uganda',
    regions: ['Kampala', 'Gulu', 'Mbale', 'Mbarara', 'Lira', 'Masaka'], n: 1000, sector: 'agriculture' },
  { template: 'livelihood_assessment', name: 'Youth & Household Livelihood Resilience Assessment — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Tanga', 'Kigoma', 'Tabora', 'Dodoma', 'Pwani'], n: 1000, sector: 'economic_development' },
  { template: 'humanitarian_needs', name: 'Multi-Sector Needs Assessment — Displaced Households — Demo', country: 'South Sudan',
    regions: ['Juba', 'Bentiu', 'Malakal', 'Wau', 'Bor', 'Renk'], n: 1000, sector: 'humanitarian' },
  { template: 'baseline_study', name: 'Maternal & Child Health Program Baseline — Demo', country: 'Malawi',
    regions: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 'Kasungu'], n: 1000, sector: 'monitoring_evaluation' },
  { template: 'endline_evaluation', name: 'Maternal & Child Health Program Endline — Demo', country: 'Malawi',
    regions: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 'Kasungu'], n: 1000, sector: 'monitoring_evaluation' },
  { template: 'market_research', name: 'Digital Financial Services Adoption Study — Demo', country: 'Rwanda',
    regions: ['Kigali', 'Musanze', 'Huye', 'Rubavu', 'Rwamagana', 'Nyagatare'], n: 1000, sector: 'private_sector' },
  { template: 'customer_satisfaction', name: 'Banking & Mobile Financial Services Satisfaction Survey — Demo', country: 'Kenya',
    regions: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Kisii'], n: 1000, sector: 'private_sector' },
  { template: 'employee_engagement', name: 'Employee Engagement & Culture Survey — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Mbeya', 'Zanzibar'], n: 1000, sector: 'private_sector' },
  { template: 'citizen_feedback', name: 'Municipal Public Services Feedback — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Tanga', 'Morogoro'], n: 1000, sector: 'governance' },
  { template: 'community_scorecard', name: 'Community Scorecard — Health & Education Services — Demo', country: 'Zambia',
    regions: ['Lusaka', 'Copperbelt', 'Eastern', 'Southern', 'Central', 'Northern'], n: 1000, sector: 'governance' },
  { template: 'monitoring_report', name: 'Livelihoods & Resilience Program Quarterly Monitoring — Demo', country: 'Ethiopia',
    regions: ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Somali', 'SNNPR'], n: 1000, sector: 'monitoring_evaluation' },
  { template: 'quarterly_performance', name: 'Multi-Region Social Impact Program — Quarterly Performance — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Mbeya', 'Zanzibar'], n: 1000, sector: 'monitoring_evaluation' },
  { template: 'annual_impact', name: 'National Youth Empowerment Program — Annual Impact — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Kigoma'], n: 1000, sector: 'monitoring_evaluation' },
  { template: 'sdg_progress', name: 'Local SDG Progress Tracking — Demo', country: 'Tanzania',
    regions: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Morogoro', 'Mbeya'], n: 1000, sector: 'monitoring_evaluation' },
];

const GENDERS = ['Male', 'Female'];
const AGE_BRACKETS = ['18-25', '26-35', '36-45', '46-60', '60+'];
const CHANNELS = ['sms', 'whatsapp', 'app', 'web_link'];

// Report-specific quote pools — each tailored to that report's EXACT
// listed focus areas, not a generic sector pool. This is what gives each
// report its own sector-specific voice (health reads like health,
// agriculture reads like agriculture, etc.) per the FINAL TASK's core
// business requirement.
const QUOTES = {
  health_survey: [
    'The nearest clinic is over two hours away on foot for elderly patients.',
    'Medicine was available this time, unlike my visit last year.',
    'We waited more than three hours before being seen by a nurse.',
    'My daughter received her immunization on schedule this time.',
    'The antenatal care nurse was patient and explained everything clearly.',
    'Referral to the district hospital took too long when my son was very sick.',
    'Health worker attitude has improved — they listen to us now.',
    'We cannot always afford the transport to reach the health center.',
    'I heard about the new SMS health reminders but have not used them yet.',
    'Maternal health services here are better than in the neighboring district.',
    'The clinic ran out of malaria medicine during the rainy season.',
    'Digital health services would help us if we had reliable network coverage.',
  ],
  education_assessment: [
    'My child is in a class of over eighty pupils with only one teacher.',
    'The school received new textbooks for the first time this term.',
    'Teachers are absent frequently, especially on market days.',
    'My daughter stopped attending regularly after she started her period.',
    'The school feeding program keeps children in class through the afternoon.',
    'We do not have any computers or tablets for digital learning.',
    'Parent meetings are rare, so I do not know how my child is performing.',
    'Girls in our village are pulled out of school during harvest season.',
    'The classroom leaks badly during the rains, disrupting lessons.',
    'Attendance has improved since the school introduced a feeding program.',
    'There are not enough qualified teachers for mathematics and science.',
    'My son enjoys school more now that there are more learning materials.',
  ],
  agriculture_survey: [
    'The improved seed variety gave us a much better harvest this season.',
    'Fertilizer prices have gone up beyond what most farmers can afford.',
    'Buyers at the market do not offer a fair price for our produce.',
    'Extension officers rarely visit our village to give advice.',
    'The drought this year destroyed most of our maize crop.',
    'We lost a large share of our harvest to poor storage after picking.',
    'Irrigation would help us farm through the dry season.',
    'Mobile money makes it easier to receive payment from traders now.',
    'Climate patterns have become harder to predict for planting season.',
    'The cooperative helped us negotiate a better group price this year.',
    'We still rely on rain-fed farming with no irrigation access.',
    'New farming techniques from training have improved our yield.',
  ],
  livelihood_assessment: [
    'A small loan helped me expand my tailoring business this year.',
    'Youth in our area still struggle to find any stable employment.',
    'Our savings group has helped members cope with sudden expenses.',
    'Vocational training gave me the skills to start a small workshop.',
    'Women-led businesses here still face difficulty accessing credit.',
    'The recent drought forced us to sell livestock at a loss.',
    'Financial inclusion has improved since mobile banking arrived.',
    'My business collapsed after the flooding damaged our stock.',
    'More young people are finding casual work than a year ago.',
    'We rely entirely on informal trade since there are no formal jobs here.',
    'The vocational center taught me tailoring and now I earn an income.',
    'Household income is still unpredictable from month to month.',
  ],
  humanitarian_needs: [
    'We received food assistance but not enough for the whole family.',
    'Clean water access improved since the new borehole was built.',
    'Shelter materials arrived late, after the rains had already started.',
    'We do not feel safe walking to the water point after dark.',
    'Our children have not attended school since we were displaced.',
    'The health post here has no medicine for common illnesses.',
    'Protection concerns have increased since the new arrivals came.',
    'Humanitarian workers registered our family but assistance is delayed.',
    'We had to reduce meals to one per day to make food last longer.',
    'The WASH facilities are shared by too many households.',
    'Some families still lack any shelter material at all.',
    'Distribution point staff have been more organized in recent months.',
  ],
  baseline_study: [
    'Facility delivery is difficult when the clinic is this far from home.',
    'Community health workers visit regularly and give useful advice.',
    'My child completed the full immunization schedule this year.',
    'Antenatal care visits are hard to keep up with during farming season.',
    'Nutrition counseling has helped me feed my children better.',
    'Barriers to care include cost of transport and long waiting times.',
    'Health knowledge sessions in the village have been helpful.',
    'We still deliver at home because the clinic is too far.',
    'Community health workers do not always have supplies to help us.',
    'Staff responsiveness at the health center has been reasonable.',
    'We lack basic health knowledge about newborn care.',
    'Some households still avoid the clinic due to distance and cost.',
  ],
  endline_evaluation: [
    'Facility delivery has become easier since the new health post opened.',
    'Community health workers are more responsive than at the start of the project.',
    'Immunization completion improved noticeably compared to two years ago.',
    'Antenatal care attendance is now much better than before the project.',
    'Nutrition knowledge has clearly improved among mothers in our village.',
    'Some barriers to care, like transport cost, remain unresolved.',
    'Health knowledge sessions changed how we feed our young children.',
    'We still see some households delivering at home despite the improvements.',
    'Community health workers now have more supplies than before.',
    'Compared to the baseline, service delivery has clearly improved.',
    'Some promised infrastructure upgrades have still not been completed.',
    'Staff are more responsive than during the baseline period.',
  ],
  market_research: [
    'I trust the new digital wallet more since my friends started using it.',
    'The fees for digital transactions still feel too high to use it daily.',
    'I would pay more for a service with better customer support.',
    'Network problems make it hard to complete transactions sometimes.',
    'Awareness of the new financial product is still low in our area.',
    'I switched from a competitor because this app is easier to use.',
    'Digital access is a challenge for older customers in my family.',
    'Price sensitivity is high — most customers compare fees carefully.',
    'Younger customers adopted the product much faster than older ones.',
    'I would recommend this service if the fees were lower.',
    'Trust in digital financial products has grown in the last year.',
    'Customer segments differ a lot — rural users adopt more slowly.',
  ],
  customer_satisfaction: [
    'The mobile app is convenient but sometimes fails during transactions.',
    'Customer support response time has improved this year.',
    'Fees on international transfers still feel too high.',
    'Branch staff were helpful but the wait was over an hour.',
    'I would recommend this bank to a friend based on this year alone.',
    'Complaints are not resolved quickly enough for my liking.',
    'Trust in the bank has grown since they improved fraud protection.',
    'The new branch near my home made banking much more convenient.',
    'I switched most of my banking to mobile after the app update.',
    'Net promoter feeling is positive but fee transparency needs work.',
    'Support agents were polite but could not resolve my issue in one call.',
    'Overall experience has been consistent across the branches I use.',
  ],
  employee_engagement: [
    'Management has been more transparent about company decisions this quarter.',
    'There are still limited opportunities for career growth in my department.',
    'My workload has increased but staffing has not kept pace.',
    'Leadership trust has improved since the new communication policy.',
    'Recognition for good work is still inconsistent across teams.',
    'Wellbeing support programs have made a real difference this year.',
    'Retention risk feels high among junior staff without clear growth paths.',
    'Communication between departments could be much better.',
    'I feel supported by my direct manager but not by senior leadership.',
    'Career growth opportunities are unclear even after two years here.',
    'Workload balance has improved since the recent restructuring.',
    'Team morale is generally positive despite the recent changes.',
  ],
  citizen_feedback: [
    'Waste collection has become more regular in our neighborhood.',
    'Road conditions in our ward have not improved in years.',
    'Getting a business permit took much longer than it should.',
    'We still do not see budget information shared publicly.',
    'The new complaints desk at the ward office is a welcome change.',
    'Water supply interruptions are common during the dry season.',
    'Local leaders are more responsive to complaints than before.',
    'Communication from the municipal office has improved this year.',
    'Trust in local government is growing slowly but steadily.',
    'Permit processing remains the most frustrating service for residents.',
    'Complaint resolution is faster than it was two years ago.',
    'Waste management in our area still needs significant improvement.',
  ],
  community_scorecard: [
    'The health post now has more staff than during the last scorecard round.',
    'Teachers at the local school show more commitment than before.',
    'Infrastructure at the clinic is still inadequate for the population.',
    'Community members are more involved in service planning this year.',
    'Accountability meetings between staff and community are held regularly now.',
    'Action plans from the last scorecard session were only partly implemented.',
    'Staff attitude at the health facility has clearly improved.',
    'The school still lacks adequate desks and learning space.',
    'We appreciate being consulted, but follow-through has been slow.',
    'Service availability at the clinic has improved since the last review.',
    'Community participation in these sessions has grown steadily.',
    'Facility management has responded well to our previous feedback.',
  ],
  monitoring_report: [
    'Training sessions were completed on schedule this quarter.',
    'Grant disbursement to beneficiaries was delayed by several weeks.',
    'Market linkage activities have connected us to new buyers.',
    'Some of the promised infrastructure has still not been completed.',
    'Beneficiary reach this quarter fell short of the original target.',
    'Management responded quickly when we raised implementation concerns.',
    'Activity delivery in our area has been consistent and on time.',
    'Training completion rates were high across most target groups.',
    'Compared to last quarter, program delivery has clearly improved.',
    'Staff are more responsive than during the earlier monitoring period.',
    'Some communities have not yet received the planned support.',
    'Grant disbursement timelines need improvement going into next quarter.',
  ],
  quarterly_performance: [
    'This quarter\'s targets were met in most but not all regions.',
    'Budget absorption has improved compared to the previous quarter.',
    'Some regional teams delivered faster than others this quarter.',
    'Management flagged a risk around staffing gaps in two regions.',
    'Compared to last quarter, service delivery has clearly improved.',
    'Some of the promised infrastructure has still not been completed.',
    'Staff are more responsive than during the earlier reporting period.',
    'Regional performance varied more this quarter than in Q2.',
    'Key risks this quarter were mainly around supply timing.',
    'Budget utilization improved but is still below the annual target pace.',
    'Management decisions this quarter focused on addressing delivery delays.',
    'Overall program direction remains positive heading into next quarter.',
  ],
  annual_impact: [
    'The program helped me start a small business that now supports my family.',
    'More young women in my community have found formal employment this year.',
    'Vocational training gave many youths practical, marketable skills.',
    'Compared to last year, service delivery has clearly improved.',
    'Some of the promised infrastructure has still not been completed.',
    'Partnerships with local employers created real job placements this year.',
    'Gender inclusion in the program has visibly increased since last year.',
    'Sustainability of youth-led businesses remains a concern after year one.',
    'Staff are more responsive than during the earlier stage of the program.',
    'This program\'s success stories have inspired more youth to apply.',
    'Reach expanded significantly compared to the program\'s first year.',
    'Entrepreneurship support has helped several youth-led ventures grow.',
  ],
  sdg_progress: [
    'Staff are more responsive than during the baseline period.',
    'Some of the promised infrastructure has still not been completed.',
    'Compared to last year, service delivery has clearly improved.',
    'Access to clean water has improved in our ward this year.',
    'Gender representation in local decision-making is slowly increasing.',
    'Climate-related shocks are affecting household income more each year.',
    'Access to basic health services remains uneven across regions.',
    'Poverty reduction efforts have shown modest but real progress.',
    'Educational access has improved but quality concerns remain.',
    'Local government transparency has improved slightly this year.',
    'Urban services are outpacing rural service delivery improvements.',
    'National development plan priorities are visible in local programming.',
  ],
};

// Deterministic PRNG — reproducible dataset across runs.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function weightedSentiment() {
  const r = rand();
  return r < 0.55 ? 'positive' : r < 0.85 ? 'neutral' : 'negative';
}

const lines = [];
lines.push('-- Task FINAL: Enterprise Report Showcase v2 -- 1,000 respondents per report (16,000 total).');
lines.push('-- Fictional data only, clearly namespaced (demo_org_showcase, demo_ phone prefix).');

REPORTS.forEach((r, idx) => {
  const campaignId = `demo_camp_${r.template}`;
  const quotes = QUOTES[r.template];

  for (let i = 0; i < r.n; i++) {
    const respId = `demo_resp2_${r.template}_${i}`;
    const region = pick(r.regions);
    const gender = pick(GENDERS);
    const age = pick(AGE_BRACKETS);
    const sentiment = weightedSentiment();
    const phone = `+demo2${String(2000000 + idx * 10000 + i)}`;
    const daysAgo = Math.floor(rand() * 40) + 1;

    lines.push(`INSERT INTO respondents (id, organization_id, phone_number, region, consent_given) VALUES ('${respId}', 'demo_org_showcase', '${phone}', '${region}', 1);`);
    lines.push(`INSERT INTO respondent_demographics (respondent_id, organization_id, gender, age_bracket, region) VALUES ('${respId}', 'demo_org_showcase', '${gender}', '${age}', '${region}');`);
    const responseId = `demo_response2_${r.template}_${i}`;
    lines.push(`INSERT INTO responses (id, campaign_id, respondent_id, channel, status, overall_sentiment, fraud_score, started_at, completed_at) VALUES ('${responseId}', '${campaignId}', '${respId}', '${pick(CHANNELS)}', 'completed', '${sentiment}', ${(rand() * 0.15).toFixed(2)}, datetime('now', '-${daysAgo} days'), datetime('now', '-${daysAgo} days'));`);

    if (i < 15) {
      const answerId = `demo_answer2_${r.template}_${i}`;
      const quoteText = quotes[i % quotes.length];
      lines.push(`INSERT INTO answers (id, response_id, question_id, answer_text) VALUES ('${answerId}', '${responseId}', 'demo_q1', '${quoteText.replace(/'/g, "''")}');`);
      lines.push(`INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES ('demo_tr2_${r.template}_${i}', '${answerId}', '${quoteText.replace(/'/g, "''")}', 'en', 'demo_seed_v2');`);
      lines.push(`INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES ('demo_ai2_${r.template}_${i}', '${responseId}', 'summary', '${JSON.stringify({ sentiment, summary: quoteText }).replace(/'/g, "''")}', 'claude-sonnet-5-demo-seed');`);
    }
  }
});

console.log(lines.join('\n'));
