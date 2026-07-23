-- 040_user_sessions_expires_at.sql
-- HOTFIX: user_sessions was missing expires_at even though session-registry.js
-- (isSessionRevoked, called from requireAuth on every authenticated request)
-- has always selected it. Root cause: migration 031_security_hardening.sql
-- created user_sessions without this column, and registerSession() never set
-- it either — the column was read but never defined or written anywhere.
-- On real D1 this is a hard SQL error ("no such column: expires_at"), which
-- utils.js requireAuth() catches and turns into a 503 on every authenticated
-- request for any session-bearing (post-V213) token. It was masked in tests
-- because security-remediation.test.js's mock DB matches queries by regex
-- and does not enforce real column existence.
--
-- This migration only adds the column. src/session-registry.js's
-- registerSession() is updated in the same release to actually populate it
-- (matching the signed JWT's real expiry) so existing rows are not silently
-- treated as revoked once expires_at starts being enforced.
ALTER TABLE user_sessions ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
