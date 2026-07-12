-- Initial 3 pilot Report Type configurations (Task 8.1). Structure proven
-- here is what all 25 eventual types (Task 8.9) will follow — adding a new
-- type later means one more INSERT like these, not new code.

INSERT INTO report_templates (id, name, sector, sections_json, standards_json, target_page_band, chart_defaults_json) VALUES
(
  'health_survey',
  'Health Survey Report',
  'health',
  '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
  '["SDG","WHO"]',
  'narrative_report',
  '{"demographics":"donut","trends":"line","regional":"map","sentiment":"bar"}'
),
(
  'baseline_study',
  'Baseline Study Report',
  'monitoring_evaluation',
  '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","maps","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","trend_analysis","sentiment_analysis","enumerator_performance","fraud_detection_summary","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","recommendations_long_term","policy_recommendations","implementation_roadmap","annexes","questionnaire","statistical_tables","metadata"]',
  '["RBM","Theory of Change","Results Framework","Logical Framework"]',
  'technical_report',
  '{"demographics":"donut","trends":"line","regional":"map","baseline_indicators":"bar"}'
),
(
  'citizen_feedback',
  'Citizen Feedback Report',
  'governance',
  '["cover","executive_summary","background","objectives","methodology","sampling","respondent_profile","demographics","geographic_coverage","response_rate","data_quality_assessment","survey_findings","charts","cross_tabulations","ai_narrative","key_findings","emerging_themes","representative_quotes","contradictory_findings","risk_analysis","opportunity_analysis","sentiment_analysis","data_quality_score","confidence_score","limitations","discussion","conclusions","recommendations_immediate","recommendations_medium_term","policy_recommendations","annexes","questionnaire","metadata"]',
  '["CHS","Governance & Accountability"]',
  'executive_report',
  '{"demographics":"donut","sentiment":"bar","regional":"map","satisfaction":"radar"}'
);
