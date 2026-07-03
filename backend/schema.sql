-- ============================================================
-- VoiceInsights Africa — D1 (SQLite) Schema
-- Adapted from schema.sql (Postgres) for Cloudflare D1.
-- Run: wrangler d1 execute voiceinsights-db --file=./schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'local_ngo',
  country         TEXT DEFAULT 'Tanzania',
  billing_tier    TEXT NOT NULL DEFAULT 'starter',
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  password_salt     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'me_officer',
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at     TEXT
);

CREATE TABLE IF NOT EXISTS surveys (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  created_by        TEXT REFERENCES users(id),
  title             TEXT NOT NULL,
  description       TEXT,
  module_type       TEXT NOT NULL DEFAULT 'survey',
  language          TEXT DEFAULT 'en',
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id                TEXT PRIMARY KEY,
  survey_id         TEXT NOT NULL REFERENCES surveys(id),
  order_index       INTEGER NOT NULL,
  question_text     TEXT NOT NULL,
  question_type     TEXT NOT NULL DEFAULT 'open_voice',
  options_json      TEXT,
  is_required       INTEGER NOT NULL DEFAULT 1,
  kpi_tag           TEXT
);

CREATE TABLE IF NOT EXISTS campaigns (
  id                  TEXT PRIMARY KEY,
  survey_id           TEXT NOT NULL REFERENCES surveys(id),
  organization_id     TEXT NOT NULL REFERENCES organizations(id),
  name                TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'whatsapp',
  target_respondents  INTEGER,
  status              TEXT NOT NULL DEFAULT 'scheduled',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS respondents (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  phone_number      TEXT,
  full_name         TEXT,
  region            TEXT,
  consent_given     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS responses (
  id                  TEXT PRIMARY KEY,
  campaign_id         TEXT NOT NULL REFERENCES campaigns(id),
  respondent_id       TEXT NOT NULL REFERENCES respondents(id),
  channel             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'in_progress',
  overall_sentiment   TEXT,
  fraud_score         REAL,
  started_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);

CREATE TABLE IF NOT EXISTS answers (
  id                  TEXT PRIMARY KEY,
  response_id         TEXT NOT NULL REFERENCES responses(id),
  question_id         TEXT NOT NULL REFERENCES questions(id),
  answer_text         TEXT,
  audio_r2_key        TEXT,
  duration_seconds    INTEGER,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transcripts (
  id                  TEXT PRIMARY KEY,
  answer_id           TEXT NOT NULL REFERENCES answers(id),
  raw_text            TEXT NOT NULL,
  language_detected   TEXT,
  stt_engine          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id                  TEXT PRIMARY KEY,
  response_id         TEXT NOT NULL REFERENCES responses(id),
  insight_type        TEXT NOT NULL,
  content_json        TEXT NOT NULL,
  model_used          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracks an in-progress multi-question conversation for a respondent on a
-- given channel (WhatsApp phone number, Voice CallSid, or a web session key).
-- Lets WhatsApp/Voice/SMS/Web all walk through the SAME survey question-by-question.
CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  session_key         TEXT NOT NULL,      -- phone number, CallSid, or web session token
  channel             TEXT NOT NULL,      -- whatsapp | phone_call | sms | web_link
  campaign_id         TEXT NOT NULL REFERENCES campaigns(id),
  survey_id           TEXT NOT NULL REFERENCES surveys(id),
  respondent_id       TEXT NOT NULL REFERENCES respondents(id),
  response_id         TEXT NOT NULL REFERENCES responses(id),
  current_index       INTEGER NOT NULL DEFAULT 0,
  language            TEXT NOT NULL DEFAULT 'sw',
  status              TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_key ON sessions(session_key, channel, status);

-- Contact/demo-request form submissions from the public website (sales pipeline).
CREATE TABLE IF NOT EXISTS leads (
  id                    TEXT PRIMARY KEY,
  full_name             TEXT NOT NULL,
  work_email            TEXT NOT NULL,
  organization          TEXT,
  country               TEXT,
  organization_type     TEXT,
  project_size          TEXT,
  expected_respondents  TEXT,
  preferred_channels    TEXT,
  message               TEXT,
  status                TEXT NOT NULL DEFAULT 'new',  -- new | contacted | converted | closed
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regulatory / compliance status per survey (COSTECH, NBS, Ethics) — one row per survey.
-- Two-Factor Authentication (TOTP) per user — compatible with Google Authenticator, Authy, etc.
CREATE TABLE IF NOT EXISTS user_2fa (
  user_id      TEXT PRIMARY KEY REFERENCES users(id),
  secret       TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API keys per organization (for future custom integrations).
CREATE TABLE IF NOT EXISTS organization_api_keys (
  organization_id  TEXT PRIMARY KEY REFERENCES organizations(id),
  api_key          TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS survey_compliance (
  survey_id           TEXT PRIMARY KEY REFERENCES surveys(id),
  costech_status      TEXT NOT NULL DEFAULT 'not_required',  -- not_required | pending | approved
  nbs_status          TEXT NOT NULL DEFAULT 'not_required',
  ethics_status       TEXT NOT NULL DEFAULT 'not_required',
  minors_involved     INTEGER NOT NULL DEFAULT 0,
  safeguarding_risk   TEXT NOT NULL DEFAULT 'low',           -- low | medium | high
  notes               TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT,
  user_id             TEXT,
  action              TEXT NOT NULL,
  resource_type       TEXT,
  resource_id         TEXT,
  ip_address          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_org ON surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_questions_survey ON questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_survey ON campaigns(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_campaign ON responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_respondents_phone ON respondents(phone_number);

-- ============================================================
-- Seed data: one demo organization + one login you can use immediately
-- Email: admin@nextgentanzania.com
-- Password: VoiceInsights2026!
-- (CHANGE THIS PASSWORD after first login in production)
-- ============================================================
INSERT OR IGNORE INTO organizations (id, name, type, billing_tier)
VALUES ('org_demo', 'NEXT-GEN Holdings Company Limited', 'local_ngo', 'professional');

INSERT OR IGNORE INTO users (id, organization_id, email, password_hash, password_salt, full_name, role)
VALUES (
  'user_demo_admin',
  'org_demo',
  'admin@nextgentanzania.com',
  'f9a560af904ea1aaf949276e3c2adc89346921a60090783f74274ceb71c9f1eb',
  '429f4023fe215e10540a0fc3df1b4365',
  'Kitentya Luth Msuya',
  'org_admin'
);

-- Second demo login with a restricted role, to test role-based UI differences.
-- Email: meofficer@nextgentanzania.com   Password: MEOfficer2026!
INSERT OR IGNORE INTO users (id, organization_id, email, password_hash, password_salt, full_name, role)
VALUES (
  'user_demo_me_officer',
  'org_demo',
  'meofficer@nextgentanzania.com',
  'e4282632b66fc80e1d3581b816c5daee529550d18d31dcee6e21be38aa83f6ad',
  '628983e0b63fda25ae23f4877508f387',
  'Amina Rashid',
  'me_officer'
);

-- Default survey + campaign + question so the WhatsApp pipeline has somewhere
-- to save incoming voice notes right out of the box (no manual setup needed).
INSERT OR IGNORE INTO surveys (id, organization_id, created_by, title, description, module_type, language, status)
VALUES ('survey_default', 'org_demo', 'user_demo_admin', 'WhatsApp Inbound Interviews', 'Auto-created survey that catches all incoming WhatsApp voice notes.', 'call_research', 'en', 'active');

INSERT OR IGNORE INTO questions (id, survey_id, order_index, question_text, question_type)
VALUES
  ('q_default', 'survey_default', 0, 'Please share your feedback in your own words.', 'open_voice'),
  ('q_default_2', 'survey_default', 1, 'What is the main challenge you are facing right now?', 'open_voice'),
  ('q_default_3', 'survey_default', 2, 'Is there anything else you would like us to know?', 'open_voice');

INSERT OR IGNORE INTO campaigns (id, survey_id, organization_id, name, channel, status)
VALUES ('camp_default', 'survey_default', 'org_demo', 'WhatsApp Default Line', 'whatsapp', 'running');
