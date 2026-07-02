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
