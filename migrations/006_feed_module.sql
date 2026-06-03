CREATE TABLE IF NOT EXISTS feed_sources (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    endpoint_url      TEXT NOT NULL,
    feed_type         VARCHAR(10) NOT NULL CHECK (feed_type IN ('json', 'rss')),
    items_path        TEXT,
    poll_interval_s   INT NOT NULL DEFAULT 300,   -- 5 minutes
    show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
    failure_count     INT NOT NULL DEFAULT 0,
    last_fetched_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feed_sources_user_isolation ON feed_sources;
CREATE POLICY feed_sources_user_isolation ON feed_sources
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE TABLE IF NOT EXISTS feed_mappings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id      UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    display_field  VARCHAR(20) NOT NULL
                       CHECK (display_field IN
                           ('title','date','url','author',
                            'summary','image_url','badge','badge_color')),
    payload_path   TEXT NOT NULL,
    UNIQUE (source_id, display_field)
);

CREATE TABLE IF NOT EXISTS feed_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    dedup_key   TEXT NOT NULL,
    normalised  JSONB NOT NULL,
    raw         JSONB NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_feed_items_source ON feed_items(source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_sources_poll ON feed_sources(last_fetched_at)
    WHERE show_on_dashboard = true;
