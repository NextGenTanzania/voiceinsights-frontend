-- Cleans up the OLD demo showcase dataset (Task 8.10 / Phase 10 -- counts
-- 120-500 per report, not the 1,000-per-report spec now required) before
-- loading the v2 seed. Safe: only ever touches rows explicitly prefixed
-- demo_resp_/demo_response_/demo_answer_/demo_tr_/demo_ai_ (old) and
-- generated_reports rows flagged is_demo=1 -- never touches real client data.

DELETE FROM ai_insights WHERE id LIKE 'demo_ai_%' AND id NOT LIKE 'demo_ai2_%';
DELETE FROM transcripts WHERE id LIKE 'demo_tr_%' AND id NOT LIKE 'demo_tr2_%';
DELETE FROM answers WHERE id LIKE 'demo_answer_%' AND id NOT LIKE 'demo_answer2_%';
DELETE FROM responses WHERE id LIKE 'demo_response_%' AND id NOT LIKE 'demo_response2_%';
DELETE FROM respondent_demographics WHERE respondent_id LIKE 'demo_resp_%' AND respondent_id NOT LIKE 'demo_resp2_%';
DELETE FROM respondents WHERE id LIKE 'demo_resp_%' AND id NOT LIKE 'demo_resp2_%';
DELETE FROM report_styled_narratives WHERE report_id IN (SELECT id FROM generated_reports WHERE is_demo = 1);
DELETE FROM report_tiered_recommendations WHERE report_id IN (SELECT id FROM generated_reports WHERE is_demo = 1);
DELETE FROM report_evidence_citations WHERE report_id IN (SELECT id FROM generated_reports WHERE is_demo = 1);
DELETE FROM report_roadmaps WHERE report_id IN (SELECT id FROM generated_reports WHERE is_demo = 1);
DELETE FROM generated_reports WHERE is_demo = 1;
