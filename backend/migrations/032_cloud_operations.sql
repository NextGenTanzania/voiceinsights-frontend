PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS queue_jobs (
 job_id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,queue_name TEXT NOT NULL,job_type TEXT NOT NULL,tenant_id TEXT NOT NULL,project_id TEXT,actor_id TEXT,correlation_id TEXT,causation_id TEXT,status TEXT NOT NULL CHECK(status IN('pending','processing','retrying','completed','dead_letter','cancelled')),attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 5,payload_ref TEXT,result_json TEXT,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,processing_started_at TEXT,completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_tenant_status ON queue_jobs(tenant_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_status ON queue_jobs(queue_name,status,created_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_correlation ON queue_jobs(correlation_id);
CREATE TABLE IF NOT EXISTS queue_events (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL,queue_name TEXT NOT NULL,job_type TEXT NOT NULL,tenant_id TEXT NOT NULL,correlation_id TEXT,event_name TEXT NOT NULL,attempt INTEGER NOT NULL DEFAULT 0,duration_ms INTEGER,error_class TEXT,details_json TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_events_job ON queue_events(job_id,created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_queue_time ON queue_events(queue_name,created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_tenant_time ON queue_events(tenant_id,created_at);
CREATE TABLE IF NOT EXISTS queue_dead_letters (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL,queue_name TEXT NOT NULL,tenant_id TEXT NOT NULL,correlation_id TEXT,attempt_count INTEGER NOT NULL,error_class TEXT,error_message TEXT,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','resolved','discarded')),replay_count INTEGER NOT NULL DEFAULT 0,last_replayed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dlq_tenant_status ON queue_dead_letters(tenant_id,status,created_at);
CREATE TABLE IF NOT EXISTS queue_replay_history (id TEXT PRIMARY KEY,dead_letter_id TEXT NOT NULL,original_job_id TEXT NOT NULL,new_job_id TEXT,actor_id TEXT NOT NULL,tenant_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS queue_consumer_heartbeats (consumer_name TEXT PRIMARY KEY,queue_name TEXT NOT NULL,last_seen_at TEXT NOT NULL,last_batch_size INTEGER NOT NULL DEFAULT 0,last_error TEXT);
CREATE TABLE IF NOT EXISTS operational_metric_aggregates (id TEXT PRIMARY KEY,metric_date TEXT NOT NULL,queue_name TEXT NOT NULL,queued INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,retried INTEGER NOT NULL DEFAULT 0,dead_letter INTEGER NOT NULL DEFAULT 0,avg_processing_ms REAL,created_at TEXT NOT NULL,UNIQUE(metric_date,queue_name));
