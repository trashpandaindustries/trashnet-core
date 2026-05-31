CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,          -- bcrypt, min cost 12
    role          VARCHAR(20) NOT NULL DEFAULT 'user'
                      CHECK (role IN ('admin', 'user')),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,   -- SHA-256 of the JWT
    expires_at    TIMESTAMPTZ NOT NULL,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Set an initial admin user
-- Password is 'admin123'
INSERT INTO users (username, role, password_hash)
VALUES ('admin', 'admin', '$2b$12$NqInz3V/v6E58Y.y3b.x5.s0hXbINs4D8M9PjB62e/YxWeWvR1jue');
