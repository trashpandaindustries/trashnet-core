CREATE TABLE file_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(20) NOT NULL CHECK (action IN ('list', 'download', 'preview')),
    path        TEXT NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_audit_time ON file_audit_log(accessed_at DESC);
CREATE INDEX idx_file_audit_user ON file_audit_log(user_id);
