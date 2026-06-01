CREATE TABLE settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('portainer_url',              '"https://192.168.1.69:9443"'),
  ('portainer_token',            '""'),
  ('docker_label_filter',        '"dashboard.show=true"'),
  ('stats_refresh_interval_ms',  '10000'),
  ('docker_refresh_interval_ms', '30000'),
  ('portainer_env',              '3'),
  ('portainer_ignore_ssl', 'true')

CREATE TABLE dashboard_modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL,
    ref_id      UUID,
    pos_x       INT NOT NULL DEFAULT 0,
    pos_y       INT NOT NULL DEFAULT 0,
    width       INT NOT NULL DEFAULT 2,   -- grid columns
    height      INT NOT NULL DEFAULT 2,   -- grid rows
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dashboard_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_modules_user_isolation ON dashboard_modules
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE INDEX idx_dashboard_modules_user ON dashboard_modules(user_id);
