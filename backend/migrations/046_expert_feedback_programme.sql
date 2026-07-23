-- 046_expert_feedback_programme.sql
-- Enterprise Market Validation Release, Part B. Additive only.
--
-- A dedicated table, not a `leads` companion. The `leads` table
-- (schema.sql) has no scores column, no type discriminator, and its own
-- admin UI (site/admin/leads.html) renders a sales-stage Kanban board that
-- has no meaningful "stage" for review feedback. Structured multi-dimension
-- ratings plus a reviewer category deserve a purpose-built shape rather
-- than overloading a sales-lead record.
--
-- Reviewer categories and the 8 scored questions match
-- docs/expert-review-programme/EXPERT_REVIEW_PROGRAMME.md verbatim, so
-- external review feedback and this engagement's own internal 8-persona
-- QA sit on one comparable scale.
CREATE TABLE IF NOT EXISTS expert_feedback (
  id                TEXT PRIMARY KEY,
  reviewer_category TEXT NOT NULL,
  reviewer_name     TEXT,
  reviewer_email    TEXT,
  organization       TEXT,
  scores_json       TEXT NOT NULL,
  free_text         TEXT,
  status            TEXT NOT NULL DEFAULT 'new',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expert_feedback_category_created
  ON expert_feedback(reviewer_category, created_at DESC);
