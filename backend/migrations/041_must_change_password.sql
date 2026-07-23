-- 041_must_change_password.sql
-- SECURITY INCIDENT RESPONSE (2026-07-13/14): supports forcing a password
-- change on next login. Needed so backend/scripts/rotate-user-password.js
-- can issue a one-time temporary password for the two admin accounts whose
-- real credentials were committed in plaintext in schema.sql (see
-- SECURITY_INCIDENT_2026-07-13.md) without that temporary password being a
-- long-lived credential itself.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
