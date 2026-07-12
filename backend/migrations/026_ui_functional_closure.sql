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
