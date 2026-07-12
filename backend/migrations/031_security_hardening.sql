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
  revoked_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user   ON user_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);

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
