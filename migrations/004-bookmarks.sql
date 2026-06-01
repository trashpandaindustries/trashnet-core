CREATE TABLE bookmarks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url               TEXT NOT NULL,
    title             VARCHAR(255),
    description       TEXT,
    og_image_url      TEXT,
    favicon_url       VARCHAR(500),
    show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
    scrape_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (scrape_status IN ('pending', 'done', 'failed')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookmarks_user_isolation ON bookmarks
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE INDEX idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_bookmarks_scrape       ON bookmarks(scrape_status)
    WHERE scrape_status = 'pending';

CREATE TABLE bookmark_tags (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);
