CREATE TABLE file_index (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path        TEXT NOT NULL UNIQUE,   -- absolute path from storage root
    filename    TEXT NOT NULL,
    extension   TEXT,                  -- lowercase, no dot, e.g. 'pdf'
    size_bytes  BIGINT,
    modified_at TIMESTAMPTZ,
    indexed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_index_path      ON file_index(path);
CREATE INDEX idx_file_index_extension ON file_index(extension);
CREATE INDEX idx_file_index_modified  ON file_index(modified_at DESC);
