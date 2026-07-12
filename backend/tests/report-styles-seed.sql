INSERT INTO report_styles (id, name, audience_description, tone_instruction, appendix_depth, emphasized_sections_json) VALUES

('executive_board', 'Executive Board Report', 'A corporate or organizational Board of Directors with limited time and no technical background',
 'Extremely concise, decision-oriented. Lead with the bottom-line implication before any detail. Avoid jargon. Every paragraph should answer "so what does the Board need to decide?"',
 'none', '["executive_summary","recommendations_immediate","risk_analysis"]'),

('un_agency', 'UN Agency Report', 'UN agency programme staff and technical advisors (UNDP/UNICEF/WHO/FAO style)',
 'Formal, results-framework-oriented. Reference SDGs and international standards explicitly wherever the data supports it. Avoid promotional language — this audience expects rigor and neutrality.',
 'full', '["survey_findings","trend_analysis","policy_recommendations","implementation_roadmap"]'),

('government', 'Government Report', 'Government ministry officials and civil servants who will use this for policy and budget decisions',
 'Formal and policy-focused. Frame findings in terms of public service delivery and citizen impact. Recommendations should distinguish clearly between what requires new budget versus what is operational.',
 'summary', '["policy_recommendations","geographic_coverage","recommendations_immediate"]'),

('donor', 'Donor Report', 'Institutional donors and grant funders evaluating program performance and value for money',
 'Formal, accountability-focused. Emphasize what was achieved against what was funded. Be explicit about data quality and limitations — donors distrust reports that hide weaknesses.',
 'full', '["data_quality_assessment","key_findings","recommendations_medium_term"]'),

('academic_research', 'Academic Research Report', 'Researchers and academics who will scrutinize methodology and statistical rigor',
 'Technical and precise. Use exact statistics, confidence levels, and methodological caveats. Do not soften uncertain findings — state confidence levels explicitly.',
 'full', '["methodology","sampling","data_quality_assessment","limitations","statistical_tables"]'),

('corporate', 'Corporate Report', 'Private-sector executives and business stakeholders focused on ROI and market impact',
 'Direct, business-oriented language. Frame findings in terms of business impact, customer/employee experience, and actionable next steps with clear ownership.',
 'summary', '["executive_summary","opportunity_analysis","recommendations_immediate"]'),

('public_summary', 'Public Summary Report', 'The general public and media — no technical background, needs a plain-language summary',
 'Very simple, plain language, no jargon, no statistical terminology. Short sentences. Focus on what changed for real people, not methodology.',
 'none', '["executive_summary","key_findings"]');
