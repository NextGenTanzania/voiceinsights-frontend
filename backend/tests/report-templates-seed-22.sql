-- Remaining 22 Report Type Configs (Task 8.9). Each row follows the exact
-- structure proven by the 3 pilot templates (Task 8.1) -- adding a report
-- type here means one INSERT, never new code. sections_json uses the
-- narrower 33-section set (Citizen Feedback's shape) for shorter/executive
-- report types, and the fuller 40-section set (Health/Baseline's shape)
-- for narrative/technical report types, matching each type's realistic
-- depth per international practice.

INSERT INTO report_templates (id, name, sector, sections_json, standards_json, target_page_band, chart_defaults_json) VALUES

('education_assessment', 'Education Assessment Report', 'education',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'narrative_report', '{"demographics":"donut","trends":"line","regional":"map"}'),

('agriculture_survey', 'Agriculture Survey Report', 'agriculture',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","risk_analysis","opportunity_analysis","trend_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG","FAO"]', 'summary_report', '{"demographics":"donut","trends":"line","regional":"map","yield":"bar"}'),

('livelihood_assessment', 'Livelihood Assessment Report', 'economic_development',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","risk_analysis","opportunity_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG","RBM"]', 'summary_report', '{"demographics":"donut","income":"bar","regional":"map"}'),

('humanitarian_needs', 'Humanitarian Needs Assessment', 'humanitarian',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["Sphere","CHS","Humanitarian standards"]', 'technical_report', '{"demographics":"donut","needs":"bar","regional":"map","severity":"radar"}'),

('midline_report', 'Midline Report', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["RBM","Theory of Change","Results Framework"]', 'technical_report', '{"demographics":"donut","trends":"line","regional":"map","baseline_comparison":"line"}'),

('endline_evaluation', 'Endline Evaluation', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["RBM","Theory of Change","Results Framework","Logical Framework"]', 'technical_report', '{"demographics":"donut","trends":"line","regional":"map","impact":"waterfall"}'),

('market_research', 'Market Research Report', 'private_sector',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","opportunity_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","annexes","questionnaire","statistical_tables","metadata"]',
 '[]', 'executive_report', '{"demographics":"donut","preferences":"bar","sentiment":"donut"}'),

('customer_satisfaction', 'Customer Satisfaction Report', 'private_sector',
 '["cover","executive_summary","background","objectives","methodology","respondent_profile","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","representative_quotes","sentiment_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","annexes","questionnaire","statistical_tables","metadata"]',
 '[]', 'board_report', '{"satisfaction":"radar","sentiment":"donut","trends":"line"}'),

('employee_engagement', 'Employee Engagement Report', 'private_sector',
 '["cover","executive_summary","background","objectives","methodology","respondent_profile","demographics","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","representative_quotes","sentiment_analysis","risk_analysis","opportunity_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","annexes","questionnaire","statistical_tables","metadata"]',
 '[]', 'board_report', '{"demographics":"donut","engagement":"radar","sentiment":"donut"}'),

('community_scorecard', 'Community Scorecard Report', 'governance',
 '["cover","executive_summary","background","objectives","methodology","respondent_profile","demographics","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","representative_quotes","sentiment_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","policy_recommendations","annexes","questionnaire","metadata"]',
 '["CHS","Governance & Accountability"]', 'executive_report', '{"demographics":"donut","scorecard":"radar","regional":"map"}'),

('monitoring_report', 'Monitoring Report', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","respondent_profile","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","cross_tabulations","key_findings","risk_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","annexes","statistical_tables","metadata"]',
 '["RBM","Results Framework"]', 'executive_brief', '{"trends":"line","progress":"bar"}'),

('quarterly_performance', 'Quarterly Performance Report', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","response_rate","data_quality_assessment","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","trend_analysis","risk_analysis","opportunity_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","annexes","statistical_tables","metadata"]',
 '["RBM"]', 'board_report', '{"trends":"line","kpis":"bar"}'),

('annual_impact', 'Annual Impact Report', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG","RBM","Theory of Change"]', 'narrative_report', '{"demographics":"donut","trends":"line","regional":"map","impact":"waterfall"}'),

('sdg_progress', 'SDG Progress Report', 'monitoring_evaluation',
 '["cover","executive_summary","background","objectives","methodology","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","trend_analysis","risk_analysis","opportunity_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","statistical_tables","metadata"]',
 '["SDG"]', 'summary_report', '{"sdg_indicators":"bar","trends":"line","regional":"map"}'),

('gender_assessment', 'Gender Assessment Report', 'social_inclusion',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'summary_report', '{"demographics":"donut","gender_gap":"bar","regional":"map"}'),

('youth_assessment', 'Youth Assessment Report', 'social_inclusion',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","risk_analysis","opportunity_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'summary_report', '{"demographics":"donut","age":"bar","regional":"map"}'),

('climate_environment', 'Climate & Environment Report', 'environment',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","risk_analysis","opportunity_analysis","trend_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'narrative_report', '{"trends":"line","regional":"map","risk":"heatmap"}'),

('governance_accountability', 'Governance & Accountability Report', 'governance',
 '["cover","executive_summary","background","objectives","methodology","respondent_profile","demographics","geographic_coverage","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","representative_quotes","contradictory_findings","risk_analysis","sentiment_analysis","data_quality_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["CHS","Governance & Accountability"]', 'executive_report', '{"demographics":"donut","trust_indicators":"bar","regional":"map"}'),

('financial_inclusion', 'Financial Inclusion Report', 'economic_development',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","risk_analysis","opportunity_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'summary_report', '{"demographics":"donut","access":"bar","regional":"map"}'),

('nutrition_assessment', 'Nutrition Assessment Report', 'health',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","risk_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG","WHO"]', 'technical_report', '{"demographics":"donut","nutrition_indicators":"bar","regional":"map"}'),

('wash_assessment', 'WASH Assessment Report', 'health',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","risk_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG","WHO","Sphere"]', 'technical_report', '{"demographics":"donut","access":"bar","regional":"map"}'),

('multi_sector_research', 'Multi-sector Research Report', 'cross_sector',
 '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
 '["SDG"]', 'narrative_report', '{"demographics":"donut","trends":"line","regional":"map","sector_comparison":"bar"}');
