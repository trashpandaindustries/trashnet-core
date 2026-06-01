CREATE TABLE notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    content         TEXT,
    is_scratchpad   BOOLEAN NOT NULL DEFAULT false,
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_user_isolation ON notes
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE INDEX idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX idx_notes_scratchpad   ON notes(user_id, is_scratchpad)
    WHERE is_scratchpad = true;
CREATE INDEX idx_notes_fts ON notes
    USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));

CREATE TABLE tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    VARCHAR(100) NOT NULL,
    color   VARCHAR(7) NOT NULL DEFAULT '#718096',
    UNIQUE (user_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_user_isolation ON tags
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Seed scratchpad note for existing users (like the admin user)
INSERT INTO notes (user_id, title, is_scratchpad)
SELECT id, 'Scratchpad', true FROM users;
