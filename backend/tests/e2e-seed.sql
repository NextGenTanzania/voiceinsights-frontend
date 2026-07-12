-- Minimal seed data for Sprint 1.2 end-to-end integration tests.
-- Test org, one text-based question (not full_name, so it exercises the
-- AI-analysis path), one active SMS campaign with a known access code.

INSERT INTO organizations (id, name) VALUES ('org_e2e_test', 'E2E Test Org');

INSERT INTO surveys (id, organization_id, title, status) VALUES ('survey_e2e_test', 'org_e2e_test', 'E2E Test Survey', 'active');

INSERT INTO questions (id, survey_id, order_index, question_text, question_type) VALUES
  ('q_e2e_1', 'survey_e2e_test', 0, 'How was your experience?', 'open_voice');

INSERT INTO campaigns (id, survey_id, organization_id, name, channel, status, target_respondents) VALUES
  ('camp_e2e_test', 'survey_e2e_test', 'org_e2e_test', 'E2E Test Campaign', 'sms', 'active', 100);

INSERT INTO campaign_access_codes (code, campaign_id) VALUES ('9999', 'camp_e2e_test');

INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active) VALUES
  ('user_e2e_admin', 'org_e2e_test', 'e2e-admin@test.local', 'x', 'x', 'E2E Admin', 'super_admin', 1);
