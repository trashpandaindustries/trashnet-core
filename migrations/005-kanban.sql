CREATE TABLE kanban_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    status            VARCHAR(50) NOT NULL DEFAULT 'To Do'
                          CHECK (status IN ('To Do', 'In Progress', 'In Review', 'Done')),
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

CREATE INDEX idx_kanban_items_user_status ON kanban_items(user_id, status);
CREATE INDEX idx_kanban_items_due      ON kanban_items(due_date)
    WHERE due_date IS NOT NULL;

CREATE TABLE kanban_item_tags (
    item_id UUID NOT NULL REFERENCES kanban_items(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
