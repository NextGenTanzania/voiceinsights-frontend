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
  must_change_password INTEGER NOT NULL DEFAULT 0,
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

-- Impact indicators for Donor Reports — baseline vs current, tracked manually
-- (these typically come from an external M&E framework, not just voice data).
CREATE TABLE IF NOT EXISTS impact_indicators (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  baseline_value    TEXT,
  current_value     TEXT,
  unit              TEXT,
  order_index       INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extra profile fields for team members (phone, region) — kept separate from
-- the core users table so it's safe to add without an ALTER TABLE.
CREATE TABLE IF NOT EXISTS user_profile (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  phone         TEXT,
  region        TEXT,
  invite_method TEXT
);

-- Sustainability and Coherence (OECD-DAC criteria) require program-level
-- judgment no AI can infer from voice data alone — stored per-organization so
-- your team writes them once and every report picks them up automatically.
CREATE TABLE IF NOT EXISTS oecd_dac_assessments (
  organization_id  TEXT PRIMARY KEY REFERENCES organizations(id),
  sustainability_note TEXT,
  coherence_note       TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Optional field-collection metadata (GPS, device, timestamp) — kept as its
-- own table so no ALTER TABLE is ever needed on the existing responses table.
-- Populated only when the collecting device/browser provides it; never required.
CREATE TABLE IF NOT EXISTS response_metadata (
  response_id   TEXT PRIMARY KEY REFERENCES responses(id),
  device_id     TEXT,
  gps_lat       REAL,
  gps_lng       REAL,
  gps_accuracy_m REAL,
  captured_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple sliding-window rate limiting — no extra Cloudflare product needed,
-- just a small D1 table. Cleared rows are cheap; old rows are pruned on write.
-- Short, human-speakable codes respondents reply with FIRST on shared-number
-- channels (WhatsApp/SMS) so the system knows EXACTLY which campaign/project
-- this specific conversation belongs to — without this, every WhatsApp/SMS
-- reply on a shared number would be unable to tell which organization or
-- project it's even for.
CREATE TABLE IF NOT EXISTS campaign_access_codes (
  code          TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Links one campaign as a later ROUND of an earlier one (baseline → midline →
-- endline), the standard M&E design for measuring change over time. Kept as
-- its own table rather than a column so no ALTER TABLE is ever needed.
CREATE TABLE IF NOT EXISTS campaign_panel_links (
  campaign_id           TEXT PRIMARY KEY REFERENCES campaigns(id),
  baseline_campaign_id  TEXT NOT NULL REFERENCES campaigns(id),
  round_label           TEXT NOT NULL DEFAULT 'Follow-up',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracks a sales lead's progress through the pipeline — the lightweight CRM
-- layer that lets more than one person work leads without everything living
-- in one founder's head.
CREATE TABLE IF NOT EXISTS lead_pipeline (
  lead_id       TEXT PRIMARY KEY REFERENCES leads(id),
  stage         TEXT NOT NULL DEFAULT 'new',  -- new | contacted | proposal_sent | negotiating | won | lost
  owner_note    TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DHIS2 connection details for an organization's OWN DHIS2 instance (Ministry
-- of Health systems, standard across African health M&E). Stores a Personal
-- Access Token (PAT), not a password — the modern, safer DHIS2 auth method.
-- This is the org's OWN credential for their OWN system, configured by them,
-- same pattern as any SaaS "connect your API" settings page.
CREATE TABLE IF NOT EXISTS dhis2_integrations (
  organization_id   TEXT PRIMARY KEY REFERENCES organizations(id),
  instance_url       TEXT NOT NULL,
  api_token          TEXT NOT NULL,
  default_org_unit   TEXT,
  default_dataset_id TEXT,
  enabled            INTEGER NOT NULL DEFAULT 1,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Maps ONE of our Outcome Indicators to a specific DHIS2 Data Element — every
-- DHIS2 instance has its own IDs, so this mapping is what makes push actually
-- land in the right place for each client's specific configuration.
CREATE TABLE IF NOT EXISTS dhis2_indicator_mapping (
  indicator_id        TEXT PRIMARY KEY REFERENCES impact_indicators(id),
  dhis2_data_element_id TEXT NOT NULL,
  dhis2_category_option_combo TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI-generated qualification for a Business Inquiry — score, estimated deal
-- size, priority, and recommended package, computed once from what the
-- prospect told us, so Sales sees a ranked pipeline instead of a flat list.
CREATE TABLE IF NOT EXISTS lead_ai_analysis (
  lead_id             TEXT PRIMARY KEY REFERENCES leads(id),
  score               INTEGER NOT NULL,
  estimated_deal_usd  INTEGER,
  priority            TEXT NOT NULL DEFAULT 'medium',  -- high | medium | low
  recommended_package TEXT,
  reasoning           TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manually-marked lifecycle stages for a project (Planning, Training,
-- Validation, Client Delivery, Archive) — the stages that can't be
-- auto-derived from data (Deployment/Collection/AI Processing ARE derived
-- live from real signals: access code exists, responses exist, insights exist).
CREATE TABLE IF NOT EXISTS project_lifecycle_stages (
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  stage         TEXT NOT NULL,  -- planning | training | validation | client_delivery | archive
  completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (campaign_id, stage)
);

-- Project document links (contracts, TORs, consent forms) — shared links, not
-- file storage yet, but persisted server-side and visible to the whole team,
-- not just whoever's browser localStorage happened to have it.
CREATE TABLE IF NOT EXISTS project_documents (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'other',  -- contract | tor | training | consent | report | invoice | other
  added_by      TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple broadcast messages from a supervisor to everyone on a project's team
-- — the "Messages" enumerators see, not a full chat system yet.
CREATE TABLE IF NOT EXISTS project_announcements (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  message       TEXT NOT NULL,
  posted_by     TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lightweight device telemetry (battery, last seen) reported by the
-- Enumerator App on each sync — separate from response_metadata so no
-- ALTER TABLE is needed on a table that may already be deployed.
CREATE TABLE IF NOT EXISTS enumerator_device_status (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  battery_pct   INTEGER,
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Training resources for a project's enumerators — links/notes an Org Admin
-- sets up once, visible to everyone assigned to that project.
CREATE TABLE IF NOT EXISTS project_training_materials (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  title         TEXT NOT NULL,
  url           TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QA sign-off on a specific response — approved/rejected + who/when, so
-- flagged responses have a real audit trail of review, not just a fraud score.
CREATE TABLE IF NOT EXISTS response_qa_review (
  response_id   TEXT PRIMARY KEY REFERENCES responses(id),
  decision      TEXT NOT NULL,  -- approved | rejected
  reviewed_by   TEXT REFERENCES users(id),
  notes         TEXT,
  reviewed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which enumerator (user) actually collected a given response — enables real
-- per-person attribution (leaderboards, individual quality stats) without
-- an ALTER TABLE on responses, which may already be deployed in production.
CREATE TABLE IF NOT EXISTS response_collector (
  response_id   TEXT PRIMARY KEY REFERENCES responses(id),
  user_id       TEXT NOT NULL REFERENCES users(id)
);

-- Log of every DHIS2 push attempt — lets an org see when they last pushed
-- data and whether it succeeded, instead of wondering if the button worked.
CREATE TABLE IF NOT EXISTS dhis2_push_log (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  pushed_count    INTEGER NOT NULL,
  status          TEXT NOT NULL,  -- success | failed
  detail          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Respondent's own rating of their experience (1-5) after finishing a
-- web-based survey — a real experience-quality signal, separate from the
-- research content itself.
CREATE TABLE IF NOT EXISTS respondent_satisfaction (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
  rating        INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PLATFORM SECRET VAULT — generic, reusable encrypted-credential
-- storage for EVERY integration (DHIS2, Twilio, SMTP, OAuth tokens,
-- org API keys, and anything added in the future). Feature code never
-- stores a raw credential column of its own again — it stores a
-- reference into this table instead.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_secrets (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,          -- 'platform' for platform-wide secrets, otherwise a real org id
  secret_type     TEXT NOT NULL,          -- 'dhis2_api_token' | 'twilio_auth_token' | 'smtp_password' | ...
  envelope_json   TEXT NOT NULL,          -- { v, alg, org, iv, ct, created_at } — see secret-vault.js
  status          TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, secret_type)
);

-- Tracks a rotation batch job's progress — lets Vault Health show
-- "% complete" instead of an operator guessing whether it's still running.
-- cursor_id lets the Cron-driven batch processor resume exactly where the
-- last invocation stopped, instead of re-scanning from the start each time.
CREATE TABLE IF NOT EXISTS secret_rotation_jobs (
  id              TEXT PRIMARY KEY,
  from_version    INTEGER NOT NULL,
  to_version      INTEGER NOT NULL,
  total_secrets   INTEGER NOT NULL DEFAULT 0,
  rotated_count   INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  cursor_id       TEXT,             -- last-processed platform_secrets.id; NULL = not started
  status          TEXT NOT NULL DEFAULT 'running',  -- running | complete | failed
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT
);

-- Every encrypt/decrypt/rotate attempt — success AND failure — so a spike in
-- failures is visible as a monitoring signal, not just a support ticket.
CREATE TABLE IF NOT EXISTS vault_audit_log (
  id              TEXT PRIMARY KEY,
  organization_id TEXT,
  secret_type     TEXT,
  operation       TEXT NOT NULL,   -- encrypt | decrypt | rotate | validate
  outcome         TEXT NOT NULL,   -- success | failure
  error_code      TEXT,            -- KEY_VERSION_UNAVAILABLE | TENANT_MISMATCH | TAMPERED | null
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- AI PROCESSING QUEUE — Sprint 1.2 (Reliability)
-- ------------------------------------------------------------
-- Guarantees a collected answer is NEVER lost even if a downstream AI call
-- (sentiment/fraud analysis, or transcription) fails transiently. The raw
-- answer is saved immediately; if enrichment fails, a retry row is queued
-- here instead of the answer silently vanishing. A Cron Trigger (added in
-- a later Sprint 1.2 task) processes this queue with backoff.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id              TEXT PRIMARY KEY,
  answer_id       TEXT NOT NULL REFERENCES answers(id),
  response_id     TEXT NOT NULL REFERENCES responses(id),
  stage           TEXT NOT NULL,   -- 'analyze' (sentiment/topics/fraud) | 'transcribe' (Whisper) — only 'analyze' used in this task
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | complete | failed_permanently
  next_retry_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every individual retry ATTEMPT for a queue item — not just the latest
-- error. This is what lets a future report show a real per-attempt
-- timeline (attempt 1 failed with X at 10:02, attempt 2 failed with Y at
-- 10:06, attempt 3 succeeded at 10:14), which ai_processing_queue's single
-- `last_error` column cannot reconstruct on its own.
CREATE TABLE IF NOT EXISTS ai_processing_attempts_log (
  id              TEXT PRIMARY KEY,
  queue_id        TEXT NOT NULL REFERENCES ai_processing_queue(id),
  attempt_number  INTEGER NOT NULL,
  outcome         TEXT NOT NULL,   -- success | failure
  error           TEXT,
  duration_ms     INTEGER,
  attempted_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Records EVERY scheduled() Cron execution (not per-queue-row) — this is
-- what makes "last successful/failed Cron execution" answerable, since a
-- Cron tick can succeed while processing zero queue items (an empty queue
-- is not distinguishable from a crashed Cron without this).
CREATE TABLE IF NOT EXISTS ai_retry_cron_log (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | success | failed
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_succeeded INTEGER NOT NULL DEFAULT 0,
  items_failed    INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);

-- Demographic data for a respondent, kept separate from the core
-- `respondents` table (which never had gender/age_bracket columns) so no
-- ALTER TABLE is needed on a table that may already hold real production
-- data. LEFT JOINed wherever demographic breakdowns are needed; missing
-- rows simply mean "not provided" rather than breaking the query.
CREATE TABLE IF NOT EXISTS respondent_demographics (
  respondent_id   TEXT PRIMARY KEY REFERENCES respondents(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  gender          TEXT,
  age_bracket     TEXT,
  region          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Photo attached to an answer (proof-of-visit, damaged infrastructure,
-- consent forms, etc.) — a separate table rather than a column on
-- `answers`, so no ALTER TABLE is ever needed on that table.
CREATE TABLE IF NOT EXISTS answer_photos (
  answer_id   TEXT PRIMARY KEY REFERENCES answers(id),
  r2_key      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Periodic health-check snapshots (Task 5.3) — recorded independently by
-- the Cron trigger every 5 minutes, not dependent on visitor traffic to the
-- public status page, so history exists even during zero-traffic outages.
-- Deliberately minimal: no incident-management workflow yet (acknowledge/
-- resolve/postmortem) — just the raw signal a status page needs to show
-- "here's what actually happened recently."
CREATE TABLE IF NOT EXISTS status_check_history (
  id            TEXT PRIMARY KEY,
  service       TEXT NOT NULL,   -- api | database | storage
  status        TEXT NOT NULL,   -- operational | degraded
  latency_ms    INTEGER,
  error_message TEXT,
  checked_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracks which COMPUTED notifications (identified by a stable key like
-- "fraud_alert:response_123") a specific user has already read. Deliberately
-- separate from notification GENERATION, which stays computed-on-read from
-- real business data (fraud/leads/campaigns) — this table only adds the
-- read/unread layer on top, without touching how/where notifications
-- originate. Safer, smaller change than a full notifications-table rewrite.
CREATE TABLE IF NOT EXISTS notification_read_state (
  user_id           TEXT NOT NULL,
  notification_key  TEXT NOT NULL,
  read_at           TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, notification_key)
);

-- Web/mobile push tokens (Firebase Cloud Messaging) per user. One user can
-- have multiple tokens (multiple devices/browsers). Tokens are opaque
-- strings from Firebase, not secrets themselves, but scoped strictly to the
-- owning user — never shared or exposed across organizations.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id       TEXT NOT NULL,
  token         TEXT NOT NULL,
  device_type   TEXT,   -- web | android | ios (informational only)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, token)
);

-- ============================================================
-- ENTERPRISE INTELLIGENCE & REPORTING PLATFORM (Phase 8)
-- ------------------------------------------------------------
-- One Report Engine, many configurations — a "report type" (Health
-- Survey, Baseline Study, etc.) is DATA (this table), not a separate
-- codebase. Adding report type #26 later means inserting one row here,
-- not writing new rendering code.
-- ============================================================
CREATE TABLE IF NOT EXISTS report_templates (
  id                  TEXT PRIMARY KEY,          -- e.g. 'health_survey'
  name                TEXT NOT NULL,              -- e.g. 'Health Survey Report'
  sector              TEXT,                       -- e.g. 'health', 'education', 'agriculture'
  sections_json       TEXT NOT NULL,              -- ordered array of section keys this report type includes
  standards_json      TEXT,                       -- array: e.g. ["SDG","WHO","OECD-DAC"]
  target_page_band    TEXT NOT NULL,              -- 'executive_brief_8_12' | 'board_15_20' | 'executive_25_40' |
                                                   -- 'summary_35_60' | 'narrative_60_120' | 'technical_120_250'
  chart_defaults_json TEXT,                       -- which chart type per data-shape category (see Task 8.5)
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per ACTUAL generated report (not per template). The full
-- assembled content lives in document_model_json — a structured JSON
-- "document model" (sections, chart data, narrative text), NOT rendered
-- HTML/PDF. This is what makes multi-format export (PDF/Word/PPTX/Excel)
-- possible from ONE generation — render-to-format happens at download
-- time, from this one source of truth, per organization/campaign.
CREATE TABLE IF NOT EXISTS generated_reports (
  id                    TEXT PRIMARY KEY,
  template_id           TEXT NOT NULL REFERENCES report_templates(id),
  organization_id       TEXT NOT NULL REFERENCES organizations(id),
  campaign_id           TEXT REFERENCES campaigns(id),   -- nullable: a report MAY span multiple campaigns later
  status                TEXT NOT NULL DEFAULT 'draft',    -- draft | review | approved | published | archived
  version               INTEGER NOT NULL DEFAULT 1,
  document_model_json   TEXT,                             -- the assembled report content (Task 8.2)
  generated_by          TEXT REFERENCES users(id),
  -- Task 8.10 (Enterprise Report Showcase): marks a report as a public
  -- demonstration asset built from fictional data — never real client
  -- data. is_demo gates the public, no-login endpoint; demo_country/
  -- demo_language are denormalized here (not joined from campaigns/orgs)
  -- specifically so the public Report Library page can filter fast
  -- without needing a login-gated join across tables.
  is_demo               INTEGER NOT NULL DEFAULT 0,
  demo_country          TEXT,
  demo_language         TEXT DEFAULT 'English',
  demo_downloads        INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  -- Migration 039: explicit scope (never inferred solely from a nullable
  -- campaign_id) and the deterministic dataset identity this report was
  -- generated from (see report-generator.js:buildDatasetIdentity).
  scope_type            TEXT NOT NULL DEFAULT 'ORGANIZATION',
  dataset_version        TEXT
);

-- Every organization's visual identity, inherited automatically by every
-- export (Branding Engine, Task 8.4). One row per org; missing row =
-- fall back to platform default branding. header_text/footer_text are
-- free-form strings the org can customize (e.g. a standard report
-- letterhead line); logo stored in the existing R2 bucket (documents/
-- prefix pattern already proven in Task 2.4), referenced here by key only.
CREATE TABLE IF NOT EXISTS organization_branding (
  organization_id       TEXT PRIMARY KEY REFERENCES organizations(id),
  logo_r2_key           TEXT,
  primary_color         TEXT DEFAULT '#E4A23A',
  secondary_color       TEXT DEFAULT '#1E2620',
  font_family           TEXT DEFAULT 'Inter',
  header_text           TEXT,
  footer_text           TEXT,
  disclaimer_text       TEXT,
  confidentiality_text  TEXT,
  contact_details       TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scheduled recurring report generation + email delivery (Report
-- Scheduler, Task 8.8) — built now as schema so 8.1 defines the complete
-- data model up front, even though the Cron-driven generator lands later.
CREATE TABLE IF NOT EXISTS report_schedules (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  template_id       TEXT NOT NULL REFERENCES report_templates(id),
  campaign_id       TEXT REFERENCES campaigns(id),
  frequency         TEXT NOT NULL,        -- weekly | monthly | quarterly
  recipient_emails  TEXT NOT NULL,        -- comma-separated
  next_run_at       TEXT NOT NULL,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PHASE 9: ENTERPRISE REPORTING INTELLIGENCE
-- ============================================================

-- Presentation styles (Task 9.1) — like report_templates, a style is DATA:
-- tone/audience/appendix-depth config, never a separate code path. The
-- SAME document_model_json is reused for every style; only the narrative
-- TEXT is re-written per style (via the AI Narrative Engine, Task 8.3's
-- reliability pattern) and which sections are emphasized/hidden changes.
CREATE TABLE IF NOT EXISTS report_styles (
  id                    TEXT PRIMARY KEY,   -- e.g. 'un_agency'
  name                  TEXT NOT NULL,      -- e.g. 'UN Agency Report'
  audience_description  TEXT NOT NULL,      -- fed into the AI narrative prompt as context
  tone_instruction       TEXT NOT NULL,      -- e.g. 'formal, results-framework-oriented, avoid marketing language'
  appendix_depth        TEXT NOT NULL DEFAULT 'summary',  -- full | summary | none
  emphasized_sections_json TEXT,             -- which sections this audience cares about most
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached styled narrative — regenerating narrative text on every single
-- viewer page load would be slow and costly (a real Claude call each time).
-- One row per (report_id, style_id) pair; regenerated only when explicitly
-- requested (e.g. the underlying report was updated) — the ORIGINAL
-- document_model_json in generated_reports is never modified by this.
CREATE TABLE IF NOT EXISTS report_styled_narratives (
  report_id       TEXT NOT NULL REFERENCES generated_reports(id),
  style_id        TEXT NOT NULL REFERENCES report_styles(id),
  styled_narrative_json TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (report_id, style_id)
);

-- Benchmark reference values (Task 9.4) — SDG targets are platform-wide
-- defaults (organization_id NULL); donor KPIs are org-specific. Kept as a
-- simple, editable table rather than hardcoded numbers in code, so targets
-- can be updated without a deploy.
CREATE TABLE IF NOT EXISTS benchmark_targets (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),  -- NULL = platform-wide (e.g. SDG target)
  metric_name     TEXT NOT NULL,   -- e.g. 'response_rate_pct', 'positive_sentiment_pct'
  target_value    REAL NOT NULL,
  target_type     TEXT NOT NULL,   -- 'sdg' | 'donor_kpi'
  label           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cache for tiered recommendations (Task 9.5) — one row per report,
-- regenerated only on explicit request (same reasoning as
-- report_styled_narratives: avoid a real Claude call on every page view).
CREATE TABLE IF NOT EXISTS report_tiered_recommendations (
  report_id       TEXT PRIMARY KEY REFERENCES generated_reports(id),
  recommendations_json TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cache for evidence citations (Task 9.6) — one row per report.
CREATE TABLE IF NOT EXISTS report_evidence_citations (
  report_id     TEXT PRIMARY KEY REFERENCES generated_reports(id),
  citations_json TEXT NOT NULL,
  generated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cache for implementation roadmaps (Task 9.8) — one row per report.
CREATE TABLE IF NOT EXISTS report_roadmaps (
  report_id     TEXT PRIMARY KEY REFERENCES generated_reports(id),
  roadmap_json  TEXT NOT NULL,
  generated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PHASE 11: EDITORIAL STANDARDS LIBRARY
-- ------------------------------------------------------------
-- This is DATA that governs future AI writing quality, not new platform
-- features. Every table here is read by the EXISTING AI-calling functions
-- (writeNarrative, writeStyledNarrative, generateTieredRecommendations,
-- askReportQuestion) as OPTIONAL prompt-enrichment input -- if a row is
-- missing, those functions fall back to their exact current behavior
-- (100% backward compatible, per the instruction not to modify Report
-- Engine logic unless absolutely required).
-- ============================================================

-- One row per report_templates.id (Part B/C/D/H combined) -- the complete,
-- permanent editorial standard for that report type: section-by-section
-- writing rules, sector knowledge, and the recommendation framework
-- categories relevant to it. Consolidated into one JSON per report type
-- rather than exploded into dozens of rows, so it stays maintainable while
-- still being exhaustive per report type.
CREATE TABLE IF NOT EXISTS report_editorial_guidelines (
  template_id       TEXT PRIMARY KEY REFERENCES report_templates(id),
  tone_and_voice     TEXT NOT NULL,   -- Part B: overall writing tone/voice for this report type
  section_rules_json TEXT NOT NULL,   -- Part B/C: per-section writing rules (executive_summary, discussion, methodology, limitations, recommendations, policy_implications, lessons_learned, conclusion, annexes, evidence_style)
  sector_knowledge_json TEXT NOT NULL, -- Part H: common_kpis, common_risks, typical_recommendations, donor_expectations, typical_findings
  recommendation_categories_json TEXT NOT NULL, -- Part D: which of the 16 recommendation categories apply to this report type
  forbidden_behaviors_json TEXT NOT NULL, -- Part E: report-type-specific things the AI must never do
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cross-cutting audience/style writing rules (Part A + G) -- these apply
-- ACROSS all 16 report types whenever a given executive style is selected
-- (Task 9.1's report_styles table already has audience_description/
-- tone_instruction; this table adds the DEEPER, permanent writing-standard
-- layer: paragraph length, vocabulary level, chart density, structure).
CREATE TABLE IF NOT EXISTS audience_writing_standards (
  style_id          TEXT PRIMARY KEY REFERENCES report_styles(id),
  paragraph_length_guidance TEXT NOT NULL,
  vocabulary_level  TEXT NOT NULL,
  chart_density     TEXT NOT NULL,
  recommendation_style TEXT NOT NULL,
  structure_notes   TEXT NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- International standards decision library (Part I) -- tells the AI WHEN
-- a given standard applies and what citing it correctly looks like, so
-- prompts can include "if applicable, reference X" guidance without ever
-- forcing an irrelevant standard into a report that shouldn't have it.
CREATE TABLE IF NOT EXISTS standards_library (
  id                TEXT PRIMARY KEY,   -- e.g. 'SDG', 'OECD-DAC', 'Sphere'
  full_name         TEXT NOT NULL,
  applies_when       TEXT NOT NULL,   -- guidance on which report types/sectors this is relevant to
  citation_guidance  TEXT NOT NULL,   -- how to reference it correctly without overclaiming compliance
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key    TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL
);
-- no ALTER TABLE is ever needed on the existing users table.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- enumerators who should only see data for the specific project they were
-- invited to). Kept as its own table so no ALTER TABLE is ever needed on
-- the existing user_profile table.
CREATE TABLE IF NOT EXISTS user_campaign_assignment (
  user_id      TEXT PRIMARY KEY REFERENCES users(id),
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id),
  assigned_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

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
-- Seed data: a demo organization only.
--
-- SECURITY (2026-07-14): this file used to also seed three real named admin
-- accounts with hardcoded PBKDF2 hashes, and — worse — their matching
-- plaintext passwords right in the comments above the INSERT. Because this
-- file is run directly against production (see README "Load the schema"),
-- those UPDATE statements silently re-forced known passwords onto real
-- super_admin accounts on every rerun. That has been removed. See
-- SECURITY_INCIDENT_2026-07-13.md for the exposure report and rotation
-- status. Admin accounts are now created only via
-- backend/scripts/bootstrap-admin.js, which takes credentials from the
-- environment and never writes them to a file.
-- ============================================================
INSERT OR IGNORE INTO organizations (id, name, type, billing_tier)
VALUES ('org_demo', 'VoiceInsights Africa', 'local_ngo', 'professional');

-- Force the org name even on a database that already had the old seed row.
UPDATE organizations SET name = 'VoiceInsights Africa' WHERE id = 'org_demo' AND name != 'VoiceInsights Africa';

-- Default survey + campaign + question so the WhatsApp pipeline has somewhere
-- to save incoming voice notes right out of the box (no manual setup needed).
-- created_by is NULL here — no user is seeded by this file; it is set to the
-- real admin's id by bootstrap-admin.js if run afterwards.
INSERT OR IGNORE INTO surveys (id, organization_id, created_by, title, description, module_type, language, status)
VALUES ('survey_default', 'org_demo', NULL, 'WhatsApp Inbound Interviews', 'Auto-created survey that catches all incoming WhatsApp voice notes.', 'call_research', 'en', 'active');

INSERT OR IGNORE INTO questions (id, survey_id, order_index, question_text, question_type)
VALUES
  ('q_default', 'survey_default', 0, 'Please share your feedback in your own words.', 'open_voice'),
  ('q_default_2', 'survey_default', 1, 'What is the main challenge you are facing right now?', 'open_voice'),
  ('q_default_3', 'survey_default', 2, 'Is there anything else you would like us to know?', 'open_voice');

INSERT OR IGNORE INTO campaigns (id, survey_id, organization_id, name, channel, status)
VALUES ('camp_default', 'survey_default', 'org_demo', 'WhatsApp Default Line', 'whatsapp', 'running');

-- v210.3A Enterprise Identity & Access
CREATE TABLE IF NOT EXISTS iam_mfa_methods (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT, method TEXT NOT NULL,
  secret_envelope TEXT, verified_at TEXT, recovery_codes_hash_json TEXT, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iam_mfa_user ON iam_mfa_methods(user_id, status);

CREATE TABLE IF NOT EXISTS iam_sso_connections (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, provider TEXT NOT NULL, issuer_url TEXT NOT NULL,
  client_id TEXT NOT NULL, client_secret_reference TEXT, redirect_uri TEXT NOT NULL, enforced INTEGER NOT NULL DEFAULT 0,
  jit_provisioning INTEGER NOT NULL DEFAULT 1, domain TEXT, status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iam_sso_org ON iam_sso_connections(organization_id, status);

CREATE TABLE IF NOT EXISTS iam_scim_connections (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, token_hash TEXT NOT NULL, token_prefix TEXT NOT NULL,
  group_mappings_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', last_sync_at TEXT,
  last_error TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iam_scim_org ON iam_scim_connections(organization_id, status);

CREATE TABLE IF NOT EXISTS iam_api_keys_v2 (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL, scopes_json TEXT NOT NULL, expires_at TEXT, last_used_at TEXT,
  created_by TEXT, revoked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iam_api_keys_org ON iam_api_keys_v2(organization_id, revoked_at);

-- v210.3B Data Protection & Security Operations
CREATE TABLE IF NOT EXISTS security_audit_events_v2 (
  id TEXT PRIMARY KEY, organization_id TEXT, actor_id TEXT, actor_role TEXT,
  action TEXT NOT NULL, resource_type TEXT, resource_id TEXT, result TEXT NOT NULL,
  risk_level TEXT NOT NULL, correlation_id TEXT NOT NULL, ip_address TEXT, device TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_audit_org_time ON security_audit_events_v2(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_risk ON security_audit_events_v2(risk_level, created_at DESC);

CREATE TABLE IF NOT EXISTS security_secret_metadata (
  id TEXT PRIMARY KEY, organization_id TEXT, name TEXT NOT NULL, provider TEXT,
  environment TEXT NOT NULL DEFAULT 'production', secret_reference TEXT, masked_value TEXT NOT NULL DEFAULT '••••••••',
  owner TEXT, status TEXT NOT NULL DEFAULT 'configuration_required', version INTEGER NOT NULL DEFAULT 1,
  last_rotated_at TEXT, next_rotation_at TEXT, expires_at TEXT, used_by_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_security_secrets_org ON security_secret_metadata(organization_id, status);

CREATE TABLE IF NOT EXISTS consent_vault_records (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, respondent_reference TEXT NOT NULL,
  project_id TEXT NOT NULL, campaign_id TEXT NOT NULL, channel TEXT NOT NULL,
  consent_version TEXT NOT NULL, language TEXT NOT NULL, purpose TEXT NOT NULL,
  status TEXT NOT NULL, proof_type TEXT, proof_reference TEXT, device_source TEXT,
  retention_policy TEXT, accepted_at TEXT, withdrawn_at TEXT, expires_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consent_vault_org_campaign ON consent_vault_records(organization_id, campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_vault_respondent ON consent_vault_records(respondent_reference, status);

CREATE TABLE IF NOT EXISTS encryption_control_status (
  id TEXT PRIMARY KEY, organization_id TEXT, control_name TEXT NOT NULL, status TEXT NOT NULL,
  key_version TEXT, last_verified_at TEXT, next_rotation_at TEXT, evidence_reference TEXT,
  notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_encryption_control_org ON encryption_control_status(organization_id, status);

-- v210.5 Knowledge Cloud
CREATE TABLE IF NOT EXISTS knowledge_cloud_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  report_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  sector TEXT,
  country TEXT,
  tags_json TEXT DEFAULT '[]',
  source_type TEXT,
  source_reference TEXT,
  evidence_classification TEXT,
  confidence_score REAL DEFAULT 80,
  visibility TEXT DEFAULT 'organization',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_org_type ON knowledge_cloud_items(organization_id,type);
CREATE INDEX IF NOT EXISTS idx_knowledge_org_report ON knowledge_cloud_items(organization_id,report_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_org_updated ON knowledge_cloud_items(organization_id,updated_at);

-- v210.7 Marketplace
CREATE TABLE IF NOT EXISTS marketplace_installs_v2107 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed',
  configuration_json TEXT NOT NULL DEFAULT '{}',
  installed_by TEXT,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id,item_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_org_status ON marketplace_installs_v2107(organization_id,status);


-- v210.8 Benchmark Cloud™
CREATE TABLE IF NOT EXISTS benchmark_snapshots_v2108 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  period TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'organization',
  country TEXT,
  sector TEXT,
  region TEXT,
  peer_group_label TEXT,
  source_reference TEXT,
  benchmark_opt_in INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id,metric,period,scope)
);
CREATE INDEX IF NOT EXISTS idx_benchmark_org_period ON benchmark_snapshots_v2108(organization_id,period DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_peer_group ON benchmark_snapshots_v2108(metric,sector,country,region,benchmark_opt_in);

-- v210.9A Pilot Management & Customer Success Core
CREATE TABLE IF NOT EXISTS enterprise_pilots_v2109a (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  risk_level TEXT NOT NULL DEFAULT 'low',
  owner_id TEXT NOT NULL,
  operations_manager_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  contract_value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  delivery_score REAL NOT NULL DEFAULT 75,
  success_score REAL NOT NULL DEFAULT 0,
  next_milestone TEXT,
  success_criteria_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pilots_org_status ON enterprise_pilots_v2109a(organization_id,status);

CREATE TABLE IF NOT EXISTS customer_success_profiles_v2109a (
  organization_id TEXT PRIMARY KEY,
  success_manager_id TEXT,
  engagement_score REAL NOT NULL DEFAULT 70,
  health_score REAL NOT NULL DEFAULT 0,
  health_risk TEXT NOT NULL DEFAULT 'moderate',
  renewal_probability REAL NOT NULL DEFAULT 0,
  adoption_score REAL NOT NULL DEFAULT 0,
  training_score REAL NOT NULL DEFAULT 0,
  support_score REAL NOT NULL DEFAULT 100,
  last_executive_meeting TEXT,
  next_success_review TEXT,
  contract_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_activities_v2109a (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pilot_activity ON pilot_activities_v2109a(pilot_id,created_at DESC);

-- v210.9B Training, Support & Adoption
CREATE TABLE IF NOT EXISTS training_courses_v2109b (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  audience_role TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  modules_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_courses_org ON training_courses_v2109b(organization_id,status);

CREATE TABLE IF NOT EXISTS training_enrollments_v2109b (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  score_pct REAL,
  status TEXT NOT NULL DEFAULT 'enrolled',
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_training_enroll_org ON training_enrollments_v2109b(organization_id,status);

CREATE TABLE IF NOT EXISTS training_certifications_v2109b (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  verification_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid'
);

CREATE TABLE IF NOT EXISTS support_tickets_v2109b (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  requester_id TEXT NOT NULL,
  assigned_to TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets_v2109b(organization_id,status,priority);

CREATE TABLE IF NOT EXISTS usage_events_v2109b (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  channel TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_time ON usage_events_v2109b(organization_id,created_at DESC);


-- v210.9C Renewal & Expansion Intelligence
CREATE TABLE IF NOT EXISTS customer_contracts_v2109c (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
 start_date TEXT NOT NULL, end_date TEXT NOT NULL, value REAL DEFAULT 0,
 currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'active', owner_id TEXT,
 notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contracts_v2109c_org_end ON customer_contracts_v2109c(organization_id,end_date);
CREATE TABLE IF NOT EXISTS expansion_opportunities_v2109c (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, module_key TEXT NOT NULL,
 title TEXT NOT NULL, reason TEXT, score INTEGER DEFAULT 0, estimated_value REAL DEFAULT 0,
 currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'identified', owner_id TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expansion_v2109c_org ON expansion_opportunities_v2109c(organization_id,status);


-- Compliance & Procurement Trust
CREATE TABLE IF NOT EXISTS compliance_controls (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  framework TEXT,
  domain TEXT NOT NULL,
  control_code TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'evidence_pending',
  score INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  owner TEXT,
  last_reviewed_at TEXT,
  next_review_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_org ON compliance_controls(organization_id, framework, domain);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  owner TEXT,
  verification_status TEXT,
  classification TEXT,
  generated_at TEXT NOT NULL,
  expires_at TEXT,
  reference TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_org ON compliance_evidence(organization_id, generated_at);


-- VoiceInsights Intelligence Network™ (VIN™)
CREATE TABLE IF NOT EXISTS vin_network_registry (
  organization_id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT,
  sector TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  registered_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vin_registry_geo ON vin_network_registry(country,region,sector);

CREATE TABLE IF NOT EXISTS vin_organization_consents (
  organization_id TEXT PRIMARY KEY,
  anonymous_benchmarking INTEGER NOT NULL DEFAULT 0,
  sector_benchmarking INTEGER NOT NULL DEFAULT 0,
  country_benchmarking INTEGER NOT NULL DEFAULT 0,
  regional_intelligence INTEGER NOT NULL DEFAULT 0,
  africa_intelligence INTEGER NOT NULL DEFAULT 0,
  public_statistics INTEGER NOT NULL DEFAULT 0,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  approved_by TEXT,
  approved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vin_intelligence_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  sector TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL,
  period TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vin_snapshots_group ON vin_intelligence_snapshots(country,region,sector,metric_key,created_at);

CREATE TABLE IF NOT EXISTS vin_network_settings (
  id TEXT PRIMARY KEY,
  network_active INTEGER NOT NULL DEFAULT 0,
  public_portal_active INTEGER NOT NULL DEFAULT 0,
  activated_by TEXT,
  activated_at TEXT,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO vin_network_settings (id,network_active,public_portal_active,updated_at) VALUES ('global',0,0,CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS vin_collaboration_opportunities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  sector TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  description TEXT,
  skills_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vin_collaboration ON vin_collaboration_opportunities(country,sector,status,created_at);
-- Collection, Enumerator, Offline & Omni-Channel Operations
CREATE TABLE IF NOT EXISTS channel_delivery_events (
 id TEXT PRIMARY KEY, organization_id TEXT, campaign_id TEXT, survey_id TEXT,
 channel TEXT NOT NULL, provider_sid TEXT, recipient_masked TEXT, provider_status TEXT,
 normalized_status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 5, next_attempt_at TEXT, error_code TEXT,
 error_message TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_delivery_lookup ON channel_delivery_events(organization_id,campaign_id,channel,normalized_status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_delivery_provider_sid ON channel_delivery_events(channel,provider_sid) WHERE provider_sid IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_dead_letters (
 id TEXT PRIMARY KEY, delivery_event_id TEXT NOT NULL, organization_id TEXT, channel TEXT NOT NULL,
 reason TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', resolution_status TEXT NOT NULL DEFAULT 'open',
 resolved_by TEXT, resolved_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_dead_letters_status ON channel_dead_letters(organization_id,resolution_status,created_at);

CREATE TABLE IF NOT EXISTS enumerator_assignments_v2 (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 campaign_id TEXT, enumerator_id TEXT NOT NULL, supervisor_id TEXT, assignment_type TEXT NOT NULL DEFAULT 'standard',
 region TEXT, language TEXT, status TEXT NOT NULL DEFAULT 'assigned', offline_package_version INTEGER NOT NULL DEFAULT 1,
 due_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enum_assignments_user ON enumerator_assignments_v2(organization_id,enumerator_id,status,due_at);

CREATE TABLE IF NOT EXISTS offline_sync_items_v2 (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assignment_id TEXT, device_id TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, client_version INTEGER NOT NULL DEFAULT 1,
 server_version INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL, checksum TEXT,
 sync_status TEXT NOT NULL DEFAULT 'pending', conflict_reason TEXT, server_payload_json TEXT,
 synced_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_sync_idempotency ON offline_sync_items_v2(organization_id,device_id,entity_type,entity_id,client_version);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_items_v2(organization_id,sync_status,updated_at);

CREATE TABLE IF NOT EXISTS double_entry_assignments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT NOT NULL, survey_id TEXT NOT NULL,
 source_response_id TEXT NOT NULL, first_enumerator_id TEXT, second_enumerator_id TEXT,
 verification_mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'assigned', due_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_source ON double_entry_assignments(organization_id,source_response_id);

CREATE TABLE IF NOT EXISTS double_entry_submissions (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, entry_number INTEGER NOT NULL,
 enumerator_id TEXT NOT NULL, answers_json TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
 submitted_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_number ON double_entry_submissions(assignment_id,entry_number);

CREATE TABLE IF NOT EXISTS double_entry_comparisons (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, match_score INTEGER NOT NULL,
 conflict_score INTEGER NOT NULL, status TEXT NOT NULL, conflicts_json TEXT NOT NULL DEFAULT '[]',
 compared_at TEXT NOT NULL, reviewed_by TEXT, review_decision TEXT, review_notes TEXT, reviewed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_double_entry_comparison_assignment ON double_entry_comparisons(assignment_id);

CREATE TABLE IF NOT EXISTS field_quality_assessments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, survey_id TEXT,
 response_id TEXT NOT NULL, enumerator_id TEXT, fraud_risk_score INTEGER NOT NULL,
 quality_score INTEGER NOT NULL, verification_mode TEXT NOT NULL, flags_json TEXT NOT NULL DEFAULT '[]',
 review_status TEXT NOT NULL DEFAULT 'pending', supervisor_id TEXT, me_reviewer_id TEXT,
 resolution TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_field_quality_review ON field_quality_assessments(organization_id,review_status,fraud_risk_score,created_at);
CREATE TABLE IF NOT EXISTS enterprise_client_workflows (
 id TEXT PRIMARY KEY, organization_id TEXT, client_name TEXT NOT NULL, project_name TEXT,
 stage TEXT NOT NULL DEFAULT 'demo_received', owner_id TEXT, proposal_reference TEXT,
 contract_reference TEXT, invoice_reference TEXT, approval_id TEXT, project_id TEXT,
 workspace_id TEXT, campaign_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_workflows_stage ON enterprise_client_workflows(stage,updated_at);

CREATE TABLE IF NOT EXISTS enterprise_workflow_events (
 id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, organization_id TEXT, actor_id TEXT,
 actor_role TEXT, from_stage TEXT, to_stage TEXT NOT NULL, result TEXT NOT NULL,
 metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_workflow_events ON enterprise_workflow_events(workflow_id,created_at);

CREATE TABLE IF NOT EXISTS iam_auth_journey_evidence (
 id TEXT PRIMARY KEY, organization_id TEXT, environment TEXT NOT NULL DEFAULT 'production',
 journey_name TEXT NOT NULL, status TEXT NOT NULL, evidence_reference TEXT,
 executed_by TEXT, executed_at TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS iam_sso_transactions (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL,
 state_hash TEXT NOT NULL, nonce_hash TEXT NOT NULL, pkce_verifier_envelope TEXT,
 redirect_after TEXT, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_transactions_expiry ON iam_sso_transactions(organization_id,expires_at,consumed_at);

CREATE TABLE IF NOT EXISTS scim_provisioning_events (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT,
 external_id TEXT, operation TEXT NOT NULL, resource_type TEXT NOT NULL,
 resource_id TEXT, status TEXT NOT NULL, error_message TEXT,
 correlation_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scim_events_org ON scim_provisioning_events(organization_id,created_at);

CREATE TABLE IF NOT EXISTS procurement_evidence_runs (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, completion_pct INTEGER NOT NULL,
 evidence_json TEXT NOT NULL, generated_by TEXT, generated_at TEXT NOT NULL
);


-- Workstream 4: production queues and operational acceptance evidence
CREATE TABLE IF NOT EXISTS production_queue_jobs_ws4 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  campaign_id TEXT,
  queue_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  available_at TEXT,
  locked_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ws4_queue_status_available ON production_queue_jobs_ws4(queue_type,status,available_at,priority);
CREATE INDEX IF NOT EXISTS idx_ws4_queue_org ON production_queue_jobs_ws4(organization_id,created_at);

CREATE TABLE IF NOT EXISTS operational_acceptance_runs_ws4 (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score_pct INTEGER NOT NULL,
  evidence_reference TEXT,
  result_json TEXT NOT NULL,
  executed_by TEXT,
  executed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ws4_acceptance_type ON operational_acceptance_runs_ws4(run_type,status,executed_at);
CREATE TABLE IF NOT EXISTS enterprise_workflow_documents (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  organization_id TEXT,
  document_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER DEFAULT 0,
  uploaded_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_documents_workflow ON enterprise_workflow_documents(workflow_id,document_type,created_at);

CREATE TABLE IF NOT EXISTS operations_manager_appointments (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  status TEXT NOT NULL,
  note TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operations_manager_appointments_status ON operations_manager_appointments(status,created_at);

CREATE TABLE IF NOT EXISTS field_issue_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  assignment_id TEXT,
  reported_by TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_field_issue_reports_org_status ON field_issue_reports(organization_id,status,created_at);


-- Operational readiness closure

CREATE TABLE IF NOT EXISTS enterprise_projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner_id TEXT,
  start_date TEXT,
  end_date TEXT,
  budget_value REAL,
  currency TEXT DEFAULT 'USD',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_projects_org ON enterprise_projects(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS organization_workspaces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_workspace_project ON organization_workspaces(organization_id,project_id);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_org_invites_status ON organization_invitations(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS provider_health_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_health_channel ON provider_health_events(channel,created_at);

CREATE TABLE IF NOT EXISTS offline_conflict_resolutions (
  id TEXT PRIMARY KEY,
  sync_item_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  resolution TEXT NOT NULL,
  merged_payload_json TEXT,
  resolved_by TEXT NOT NULL,
  resolved_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_resolution_item ON offline_conflict_resolutions(sync_item_id);
-- 031_security_hardening.sql
-- V213 Critical/High security remediation:
--   - user_sessions:         server-side session registry for real logout/revocation
--   - twilio_event_registry: SID replay protection for verified Twilio webhooks
--   - security_audit_log:    redacted security events (rejected webhooks, etc.)

-- ---- Session registry (real server-side logout / revocation) --------------
CREATE TABLE IF NOT EXISTS user_sessions (
  sid_hash         TEXT PRIMARY KEY,              -- SHA-256 of the token's session id (raw sid never stored)
  user_id          TEXT NOT NULL,
  organization_id  TEXT,
  status           TEXT NOT NULL DEFAULT 'active', -- active | logged_out | revoked
  user_agent       TEXT,
  ip_hash          TEXT,                           -- salted hash, not the raw IP
  revoke_reason    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at     TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at       TEXT,
  expires_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user   ON user_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ---- Twilio replay protection ---------------------------------------------
-- A (sid, event_key, path) tuple can be processed once. A second delivery of
-- the same tuple (Twilio retry / replay) is ignored by the guard.
CREATE TABLE IF NOT EXISTS twilio_event_registry (
  sid        TEXT NOT NULL,
  event_key  TEXT NOT NULL,
  path       TEXT NOT NULL,
  seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sid, event_key, path)
);
CREATE INDEX IF NOT EXISTS idx_twilio_event_seen ON twilio_event_registry(seen_at);

-- ---- Redacted security audit log ------------------------------------------
CREATE TABLE IF NOT EXISTS security_audit_log (
  id             TEXT PRIMARY KEY,
  event_type     TEXT NOT NULL,   -- twilio_webhook_rejected | ...
  severity       TEXT NOT NULL DEFAULT 'medium',
  path           TEXT,
  reason         TEXT,
  subject_masked TEXT,            -- masked recipient (e.g. wha***@... / +25***12)
  provider_sid   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_type    ON security_audit_log(event_type);

-- Migration 038: Canonical Publication Quality Gate evaluation history.
-- Immutable — a new row is inserted for every evaluation, never updated in
-- place, so a report's quality history can always be reconstructed.
CREATE TABLE IF NOT EXISTS publication_gate_evaluations (
 id TEXT PRIMARY KEY, report_id TEXT, report_version TEXT, dataset_version TEXT, scope_type TEXT,
 organization_id TEXT, project_id TEXT, report_context TEXT NOT NULL DEFAULT 'CUSTOMER',
 canonical_engine_version TEXT NOT NULL, overall_score REAL, score_state TEXT NOT NULL,
 publication_status TEXT NOT NULL, export_allowed INTEGER NOT NULL DEFAULT 0,
 blocking_failures_json TEXT NOT NULL DEFAULT '[]', warnings_json TEXT NOT NULL DEFAULT '[]',
 domain_results_json TEXT NOT NULL DEFAULT '{}', validator_results_json TEXT NOT NULL DEFAULT '{}',
 required_approvals_json TEXT NOT NULL DEFAULT '[]', completed_approvals_json TEXT NOT NULL DEFAULT '[]',
 evaluated_by TEXT, evaluated_at TEXT NOT NULL, input_hash TEXT NOT NULL, result_hash TEXT NOT NULL,
 is_latest INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_publication_gate_report ON publication_gate_evaluations(report_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_gate_latest ON publication_gate_evaluations(report_id, is_latest);
