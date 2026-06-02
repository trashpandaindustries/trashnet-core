CREATE TABLE kanban_columns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    position    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY kanban_columns_user_isolation ON kanban_columns
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE TABLE kanban_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    column_id         UUID NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    priority          VARCHAR(10) NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high')),
    due_date          TIMESTAMPTZ,
    show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kanban_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY kanban_items_user_isolation ON kanban_items
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE INDEX idx_kanban_items_user_col ON kanban_items(user_id, column_id);
CREATE INDEX idx_kanban_items_due      ON kanban_items(due_date)
    WHERE due_date IS NOT NULL;

CREATE TABLE kanban_item_tags (
    item_id UUID NOT NULL REFERENCES kanban_items(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

INSERT INTO kanban_columns (user_id, name, position)
SELECT id, 'To Do', 0 FROM users;

INSERT INTO kanban_columns (user_id, name, position)
SELECT id, 'In Progress', 1 FROM users;

INSERT INTO kanban_columns (user_id, name, position)
SELECT id, 'Done', 2 FROM users;
