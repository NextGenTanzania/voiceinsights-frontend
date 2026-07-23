ALTER TABLE generated_reports ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'ORGANIZATION';
ALTER TABLE generated_reports ADD COLUMN dataset_version TEXT;
ALTER TABLE publication_gate_evaluations ADD COLUMN scope_type TEXT;
