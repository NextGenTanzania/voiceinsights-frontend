// VoiceInsights Sample Report Showcase v20
// Additive metadata layer for the 16 public demonstration reports.
// Purpose: make the public sample library and live viewer look like
// international-standard executive intelligence products without changing
// core report generation, database schema, homepage, brand or navigation.

export const SAMPLE_REPORT_SHOWCASE_V20 = [
  {
    template_id: 'health_survey',
    product_name: 'National Health Access Intelligence Report',
    sector: 'Health Systems',
    country: 'Tanzania',
    buyer: 'Ministry / NGO / Donor',
    audiences: ['Government', 'Donor', 'Health Leadership', 'Board'],
    standards: ['WHO', 'SDG 3', 'OECD-DAC', 'CHS'],
    formats: ['Executive Report', 'Donor Impact', 'Policy Brief', 'Infographic', 'Board Deck', 'Statistical Annex'],
    flagship_use_case: 'Health access, service readiness, patient experience and district-level investment decisions.',
    executive_question: 'Where are access barriers most severe, and which corrective actions would improve service reach fastest?',
    sample_sections: ['Executive snapshot', 'Access barriers', 'Facility experience', 'Regional equity', 'Maternal health signals', 'Decision matrix', 'Evidence annex'],
    visual_package: ['KPI cards', 'Access heatmap', 'Regional risk matrix', 'SDG 3 card', 'Recommendation priority grid'],
    decision_outputs: ['Immediate service bottlenecks', 'District prioritisation', 'Referral-delay risk', '90-day action plan'],
    premium_score: 96,
  },
  {
    template_id: 'education_assessment',
    product_name: 'Primary Education Quality Intelligence Report',
    sector: 'Education', country: 'Kenya', buyer: 'Education Programme / Ministry / Donor',
    audiences: ['Government', 'Donor', 'Education Board', 'Research'], standards: ['SDG 4', 'UNICEF', 'OECD-DAC'],
    formats: ['Executive Report', 'Policy Brief', 'Infographic', 'Board Deck', 'Technical Annex'],
    flagship_use_case: 'Learning conditions, attendance barriers, teacher availability and parent feedback.',
    executive_question: 'Which school-quality constraints are most responsible for weak learning experience and attendance?',
    sample_sections: ['Learning quality snapshot', 'Attendance barriers', 'Teacher availability', 'Girls education lens', 'Regional comparison', 'Policy options'],
    visual_package: ['Learning KPI cards', 'Attendance funnel', 'Gender equity card', 'County comparison bar', 'Policy option matrix'],
    decision_outputs: ['School feeding signal', 'Teacher deployment risk', 'Girls participation actions'], premium_score: 95,
  },
  {
    template_id: 'agriculture_survey', product_name: 'Smallholder Productivity & Climate Resilience Intelligence Report',
    sector: 'Agriculture & Climate', country: 'Uganda', buyer: 'Agriculture Programme / Donor / Agribusiness',
    audiences: ['Donor', 'Programme Director', 'Agriculture Team', 'Research'], standards: ['FAO', 'SDG 2', 'SDG 13', 'OECD-DAC'],
    formats: ['Executive Report', 'Donor Impact', 'Infographic', 'Management Report', 'Statistical Annex'],
    flagship_use_case: 'Farmer productivity, input access, climate risk, storage losses and market barriers.',
    executive_question: 'Which combination of climate, input and market constraints is limiting smallholder productivity?',
    sample_sections: ['Productivity snapshot', 'Climate risk', 'Input affordability', 'Extension services', 'Market access', 'Investment priorities'],
    visual_package: ['Yield barrier cards', 'Climate risk radar', 'Market access matrix', 'SDG 2/13 cards'],
    decision_outputs: ['Extension prioritisation', 'Storage-loss reduction', 'Irrigation investment case'], premium_score: 95,
  },
  {
    template_id: 'livelihood_assessment', product_name: 'Youth & Household Livelihood Resilience Intelligence Report',
    sector: 'Livelihoods', country: 'Tanzania', buyer: 'INGO / Foundation / Youth Programme',
    audiences: ['Donor', 'NGO Leadership', 'Board', 'M&E'], standards: ['SDG 1', 'SDG 8', 'OECD-DAC', 'CHS'],
    formats: ['Executive Report', 'Donor Impact', 'Board Deck', 'Infographic', 'Recommendation Tracker'],
    flagship_use_case: 'Youth employment, household income resilience, savings groups, vocational training and credit barriers.',
    executive_question: 'Which livelihood interventions are most likely to improve household resilience and youth income?',
    sample_sections: ['Resilience snapshot', 'Youth employment', 'Credit access', 'Women-led enterprises', 'Shock exposure', 'Impact forecast'],
    visual_package: ['Livelihood KPI cards', 'Shock exposure heatmap', 'Impact-cost matrix', 'SDG 1/8 cards'],
    decision_outputs: ['Credit access priority', 'Vocational training ROI', 'Household resilience actions'], premium_score: 95,
  },
  {
    template_id: 'humanitarian_needs', product_name: 'Multi-Sector Humanitarian Needs Intelligence Report',
    sector: 'Humanitarian Response', country: 'South Sudan', buyer: 'UN / INGO / Cluster Coordination',
    audiences: ['UN Cluster', 'Donor', 'Humanitarian Leadership', 'Protection Team'], standards: ['Sphere', 'CHS', 'SDG 2', 'SDG 6'],
    formats: ['Executive Report', 'Situation Brief', 'Infographic', 'Protection Brief', 'Technical Annex'],
    flagship_use_case: 'Food security, WASH, shelter, protection, education disruption and assistance gaps.',
    executive_question: 'Which needs are most urgent, where are they concentrated, and what is the safest response sequence?',
    sample_sections: ['Severity overview', 'Food assistance', 'WASH access', 'Protection risks', 'Shelter gaps', 'Response prioritisation'],
    visual_package: ['Severity cards', 'Needs heatmap', 'Protection risk matrix', 'Cluster action grid'],
    decision_outputs: ['Critical needs ranking', 'Protection-sensitive routing', 'Distribution improvement plan'], premium_score: 97,
  },
  {
    template_id: 'baseline_study', product_name: 'Maternal & Child Health Baseline Intelligence Report',
    sector: 'M&E Baseline', country: 'Malawi', buyer: 'Health Donor / Implementing Partner',
    audiences: ['Donor', 'M&E', 'Health Leadership', 'Research'], standards: ['WHO', 'UNICEF', 'SDG 3', 'OECD-DAC'],
    formats: ['Baseline Report', 'Donor Brief', 'Statistical Annex', 'Board Deck'],
    flagship_use_case: 'Baseline indicators for maternal and child health programme design and future comparison.',
    executive_question: 'What is the starting point for access, knowledge, service use and equity before intervention?',
    sample_sections: ['Baseline snapshot', 'Indicator table', 'Equity lens', 'Care barriers', 'Readiness gaps', 'Measurement plan'],
    visual_package: ['Baseline KPI cards', 'Indicator dashboard', 'Equity matrix', 'Measurement roadmap'],
    decision_outputs: ['Baseline targets', 'Implementation assumptions', 'Monitoring priorities'], premium_score: 96,
  },
  {
    template_id: 'endline_evaluation', product_name: 'Maternal & Child Health Endline Evaluation Intelligence Report',
    sector: 'M&E Endline', country: 'Malawi', buyer: 'Donor / Evaluation Team / Ministry',
    audiences: ['Donor', 'Government', 'Evaluation Board', 'Research'], standards: ['WHO', 'UNICEF', 'OECD-DAC', 'SDG 3'],
    formats: ['Endline Report', 'Impact Brief', 'Policy Brief', 'Statistical Annex'],
    flagship_use_case: 'Endline performance, outcome contribution, lessons learned and continuation decisions.',
    executive_question: 'What changed, what likely contributed to change, and what should be scaled or redesigned?',
    sample_sections: ['Outcome snapshot', 'Before-after signals', 'Contribution analysis', 'Equity performance', 'Lessons learned', 'Scale recommendations'],
    visual_package: ['Outcome cards', 'Before-after waterfall', 'Contribution matrix', 'Scale decision grid'],
    decision_outputs: ['Scale/no-scale recommendation', 'Learning agenda', 'Funding continuation brief'], premium_score: 96,
  },
  {
    template_id: 'market_research', product_name: 'Digital Financial Services Market Intelligence Report',
    sector: 'Market Research', country: 'Rwanda', buyer: 'Fintech / Bank / Investor',
    audiences: ['Executive', 'Product Team', 'Investor', 'Marketing'], standards: ['CX', 'Market Research', 'Financial Inclusion'],
    formats: ['Executive Report', 'Market Brief', 'Infographic', 'Board Deck'],
    flagship_use_case: 'Adoption barriers, trust, digital finance usage, customer segments and product opportunity.',
    executive_question: 'Which customer segments are ready to adopt, and what prevents wider digital financial usage?',
    sample_sections: ['Market snapshot', 'Adoption funnel', 'Trust barriers', 'Segment insights', 'Opportunity map', 'Go-to-market actions'],
    visual_package: ['Adoption funnel', 'Segment cards', 'Trust-risk matrix', 'Opportunity sizing card'],
    decision_outputs: ['Product priority', 'Segment targeting', 'Trust-building actions'], premium_score: 94,
  },
  {
    template_id: 'customer_satisfaction', product_name: 'Banking & Mobile Financial Services Satisfaction Intelligence Report',
    sector: 'Customer Experience', country: 'Kenya', buyer: 'Bank / Telco / CX Leadership',
    audiences: ['Executive', 'CX Team', 'Operations', 'Board'], standards: ['CX', 'NPS-style', 'Service Quality'],
    formats: ['CX Executive Report', 'Board Deck', 'Infographic', 'Management Report'],
    flagship_use_case: 'Customer satisfaction, service pain points, digital channel performance and retention risk.',
    executive_question: 'Which service moments most affect trust, satisfaction and likely customer retention?',
    sample_sections: ['CX snapshot', 'Pain-point ranking', 'Digital channel experience', 'Branch/service comparison', 'Retention risk', 'Action plan'],
    visual_package: ['Satisfaction cards', 'Pain-point Pareto', 'Channel comparison', 'Retention risk matrix'],
    decision_outputs: ['Service recovery priorities', 'Retention risk mitigation', 'Branch/channel improvements'], premium_score: 94,
  },
  {
    template_id: 'employee_engagement', product_name: 'Employee Engagement & Culture Intelligence Report',
    sector: 'People & Culture', country: 'Tanzania', buyer: 'Corporate / HR / Board',
    audiences: ['CEO', 'HR Leadership', 'Board', 'Management'], standards: ['Employee Experience', 'Organizational Health'],
    formats: ['Executive Report', 'Board Deck', 'Management Report', 'Infographic'],
    flagship_use_case: 'Employee engagement, leadership trust, retention risk, culture gaps and management action planning.',
    executive_question: 'Which workplace factors most affect engagement, retention risk and leadership confidence?',
    sample_sections: ['Engagement snapshot', 'Leadership trust', 'Retention risk', 'Culture signals', 'Department comparison', 'Manager action plan'],
    visual_package: ['Engagement cards', 'Retention risk radar', 'Trust matrix', 'Department heatmap'],
    decision_outputs: ['Retention risk actions', 'Leadership communication plan', 'Manager coaching priorities'], premium_score: 94,
  },
  {
    template_id: 'citizen_feedback', product_name: 'Municipal Public Services Citizen Feedback Intelligence Report',
    sector: 'Governance', country: 'Tanzania', buyer: 'Municipality / Public Sector / Donor',
    audiences: ['Government', 'City Leadership', 'Donor', 'Public Service Team'], standards: ['SDG 11', 'Good Governance', 'Service Delivery'],
    formats: ['Policy Brief', 'Executive Report', 'Public Summary', 'Infographic'],
    flagship_use_case: 'Citizen feedback on municipal services, responsiveness, trust and service-priority ranking.',
    executive_question: 'Which public services require urgent improvement to increase citizen trust and satisfaction?',
    sample_sections: ['Citizen snapshot', 'Service ranking', 'Trust indicators', 'Complaint resolution', 'Ward comparison', 'Public action plan'],
    visual_package: ['Service cards', 'Ward heatmap', 'Trust gauge', 'Action transparency tracker'],
    decision_outputs: ['Public service priorities', 'Ward-level action list', 'Trust restoration plan'], premium_score: 95,
  },
  {
    template_id: 'community_scorecard', product_name: 'Community Scorecard — Health & Education Services Intelligence Report',
    sector: 'Social Accountability', country: 'Zambia', buyer: 'NGO / Government / Community Programme',
    audiences: ['NGO', 'Government', 'Community Leadership', 'Donor'], standards: ['CHS', 'SDG 3', 'SDG 4', 'Social Accountability'],
    formats: ['Community Scorecard', 'Executive Report', 'Public Summary', 'Action Tracker'],
    flagship_use_case: 'Community scoring of health and education services with joint action planning.',
    executive_question: 'Where do communities and service providers agree on the most urgent service improvements?',
    sample_sections: ['Scorecard overview', 'Community priorities', 'Provider response', 'Joint action plan', 'Accountability tracker'],
    visual_package: ['Scorecard cards', 'Agreement matrix', 'Joint action tracker', 'Community feedback quotes'],
    decision_outputs: ['Joint commitments', 'Service provider actions', 'Community follow-up plan'], premium_score: 95,
  },
  {
    template_id: 'monitoring_report', product_name: 'Quarterly Livelihoods & Resilience Monitoring Intelligence Report',
    sector: 'Programme Monitoring', country: 'Ethiopia', buyer: 'Programme Director / Donor / M&E',
    audiences: ['Donor', 'Programme Director', 'M&E', 'Operations'], standards: ['OECD-DAC', 'CHS', 'SDG 1', 'SDG 8'],
    formats: ['Quarterly Report', 'Management Report', 'Donor Brief', 'Infographic'],
    flagship_use_case: 'Quarterly programme performance, risks, implementation bottlenecks and adaptive management.',
    executive_question: 'Is implementation on track, where are risks emerging, and what should management adjust this quarter?',
    sample_sections: ['Quarterly dashboard', 'Output progress', 'Risk alerts', 'Regional performance', 'Adaptive management actions'],
    visual_package: ['Progress cards', 'Traffic-light dashboard', 'Risk trend', 'Quarterly action matrix'],
    decision_outputs: ['Adaptive actions', 'Risk escalation', 'Quarterly management priorities'], premium_score: 95,
  },
  {
    template_id: 'quarterly_performance', product_name: 'Multi-Region Social Impact Quarterly Performance Intelligence Report',
    sector: 'Performance Management', country: 'Tanzania', buyer: 'Executive / Board / Donor',
    audiences: ['CEO', 'Board', 'Donor', 'Programme Director'], standards: ['OECD-DAC', 'SDGs', 'Board Reporting'],
    formats: ['Board Deck', 'Executive Report', 'Performance Dashboard', 'Infographic'],
    flagship_use_case: 'Executive quarterly performance view across regions, outcomes, risks and decisions required.',
    executive_question: 'What changed this quarter, what needs leadership attention, and where should resources shift?',
    sample_sections: ['CEO snapshot', 'Regional performance', 'Outcome movement', 'Risk register', 'Decision required', 'Next-quarter priorities'],
    visual_package: ['CEO KPI wall', 'Regional league table', 'Decision matrix', 'Risk register cards'],
    decision_outputs: ['Leadership decisions', 'Resource allocation signals', 'Next-quarter priorities'], premium_score: 97,
  },
  {
    template_id: 'annual_impact', product_name: 'National Youth Empowerment Annual Impact Intelligence Report',
    sector: 'Annual Impact', country: 'Tanzania', buyer: 'Donor / Board / Executive',
    audiences: ['Donor', 'Board', 'Executive', 'Communications'], standards: ['SDG 4', 'SDG 8', 'OECD-DAC', 'Impact Reporting'],
    formats: ['Annual Impact Report', 'Donor Report', 'Board Deck', 'Public Summary'],
    flagship_use_case: 'Annual impact, outcome contribution, stories, lessons and next-year funding priorities.',
    executive_question: 'What impact was achieved, what evidence supports it, and what investment should continue next year?',
    sample_sections: ['Annual impact snapshot', 'Outcome evidence', 'Beneficiary voice', 'Value for money', 'Lessons', 'Next-year strategy'],
    visual_package: ['Impact cards', 'Outcome pathway', 'Value-for-money card', 'Beneficiary voice panel'],
    decision_outputs: ['Continuation case', 'Funding narrative', 'Next-year strategic priorities'], premium_score: 97,
  },
  {
    template_id: 'sdg_progress', product_name: 'Local SDG Progress Tracking Intelligence Report',
    sector: 'SDG Progress', country: 'Tanzania', buyer: 'Government / UN / Municipality',
    audiences: ['Government', 'UN', 'Donor', 'Public Sector'], standards: ['SDGs', 'UNDP', 'OECD-DAC', 'Local Government'],
    formats: ['SDG Progress Report', 'Policy Brief', 'Public Dashboard', 'Infographic'],
    flagship_use_case: 'Local SDG contribution, service progress, equity gaps and evidence-based planning.',
    executive_question: 'Which SDG targets show momentum, where are gaps, and what planning decisions are needed?',
    sample_sections: ['SDG snapshot', 'Goal cards', 'Equity gaps', 'Regional progress', 'Policy implications', 'Planning recommendations'],
    visual_package: ['SDG-aligned cards', 'Progress heatmap', 'Equity gap matrix', 'Planning decision grid'],
    decision_outputs: ['SDG gap priorities', 'Planning recommendations', 'Public accountability summary'], premium_score: 96,
  },
];

const byTemplate = new Map(SAMPLE_REPORT_SHOWCASE_V20.map(item => [item.template_id, item]));

export function getSampleReportShowcaseV20(templateId) {
  return byTemplate.get(templateId) || null;
}

export function listSampleReportShowcaseV20() {
  return SAMPLE_REPORT_SHOWCASE_V20.slice();
}

export function attachSampleReportShowcaseV20(documentModel = {}) {
  const templateId = documentModel?.metadata?.template_id;
  const meta = getSampleReportShowcaseV20(templateId);
  if (!meta) return documentModel;
  return {
    ...documentModel,
    sample_showcase_v20: {
      ...meta,
      standard_label: 'International sample report standard',
      evidence_disclosure: documentModel.is_demo
        ? 'Demonstration data only; evidence is generated through the same report engine structure used for production reports.'
        : 'Evidence should be interpreted according to the report quality gate and available raw response sources.',
    },
  };
}
