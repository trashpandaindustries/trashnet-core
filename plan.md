# Trashnet-Core — Project Planning Document

> Dashboard · Notes · Bookmarks · Kanban · Feeds

| | |
|---|---|
| **Frontend** | React (Vite) + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL |
| **Auth** | Caddy + Authelia (TOTP) |
| **Access** | LAN + internet-facing (hardened) |
| **Users** | Multi-user from the start |

---

## Contents

1. [Project Overview](#1-project-overview)
2. [Infrastructure & Security](#2-infrastructure--security)
3. [Feature Specifications](#3-feature-specifications)
4. [Database Schema](#4-database-schema)
5. [API Endpoint Reference](#5-api-endpoint-reference)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Key Design Decisions & Rationale](#7-key-design-decisions--rationale)
8. [Future Plans](#8-future-plans)
9. [Feed Module](#9-feed-module)

---

## 1. Project Overview

Trashnet-Core is a unified personal operations dashboard designed to replace multiple single-purpose homelab tools with a single, always-open interface. The core problem it solves is managing a 36-container Docker stack without memorising port numbers, while also providing persistent notes, a link archive, a kanban board, and configurable feed modules.

Multi-user is built in from day one. All data is scoped to a user via `user_id` foreign keys and Postgres row-level security (RLS). Adding a new user requires no schema changes.

It must be accessible both on the LAN (no auth overhead) and from the internet (hardened auth stack).

### 1.1 Goals

- Replace gethomepage: auto-discover Docker services via Portainer API, display system stats
- Replace filebrowser: read-only file dump for accessing the storage drive remotely
- Add persistent scratchpad with markdown support and archiving
- Add a link archive (bookmarks) with automatic meta scraping and tag-based search
- Add a kanban/todo board with priority, due dates, and dashboard pinning
- Unified global search across notes, bookmarks, and kanban from the header
- Drag-and-drop dashboard with layout persisted per user in the database
- Configurable feed modules (JSON APIs + RSS) via per-feed mapping tables

### 1.2 Out of scope (for now)

- File upload / write access to storage drive — read-only initially
- MCP integration — planned future addition for AI-assisted note and kanban editing

---

## 2. Infrastructure & Security

### 2.1 Docker stack (new containers)

| Container | Image | Role |
|---|---|---|
| caddy | caddy:alpine | TLS termination, reverse proxy, LAN vs WAN routing |
| authelia | authelia/authelia | TOTP auth for WAN requests only |
| trashnet-api | node:20-alpine (custom) | Express API server |
| trashnet-web | nginx:alpine (custom) | Serves React build |
| postgres | postgres:16-alpine | Primary database (may already exist in stack) |

### 2.2 Request flow

Caddy binds on two separate interfaces:

- **Port 443 (WAN):** TLS termination → Authelia forward auth → app. Rate limiting applied at this layer.
- **Port 80 (LAN):** Direct passthrough to app. Trusted IP header set by Caddy so the app knows it's a LAN request.

One app container handles both entry points. The app checks the trusted IP header to determine context (e.g. to skip redundant auth UI elements on LAN).

### 2.3 Authelia configuration notes

- TOTP required for all WAN access — no plain password fallback
- Session duration: 8 hours, with remember-me up to 7 days
- Rate limit login endpoint: max 5 attempts per 5 minutes per IP
- Authelia's session secret and JWT secret in Docker secrets, not env vars
- LAN subnet must be explicitly trusted in Caddy so the X-Forwarded-For header is not spoofable

### 2.4 Portainer API access

- API token stored server-side in an environment variable — never sent to the browser
- Use the read-only API key scope (Portainer supports this)
- Filter containers by label: `dashboard.show=true`
- Poll interval: 30 seconds via a WebSocket push from the API server to the frontend
- If Portainer is unreachable, dashboard shows last known state with a staleness indicator

---

## 3. Feature Specifications

### 3.1 Dashboard

The main screen. Everything displayed is a "module" — an independently positionable card. Layout is drag-and-drop with position persisted in `dashboard_modules` per user.

**System stats module**
- CPU load average (1m, 5m, 15m) via node:os
- Memory usage: total, used, free
- Uptime formatted as days/hours/minutes
- Disk usage for the storage drive mount point
- Refreshes every 10 seconds via WebSocket

**Docker services module**
- Polls Portainer API every 30 seconds
- Shows all containers with label `dashboard.show=true`
- Per-container: name, status (running/stopped/restarting), uptime, quick link if a port label is present
- Clicking a service name opens its Portainer detail page
- Containers without a port label show status only — no broken links

**Pinnable modules (notes, bookmarks, kanban items)**
- Any note, bookmark, or kanban item can be pinned to the dashboard
- Pinning creates a row in `dashboard_modules` with the item's type and UUID
- Removing from dashboard deletes the `dashboard_modules` row — the source item is unaffected
- Dashboard shows a compact card per pinned item; clicking opens the full item in its section

**Global search (header)**
- Single search bar in the header, always visible
- Searches across notes (title + content), bookmarks (title + url + description), kanban items (title + description)
- Can filter by tag using `tag:` prefix e.g. `tag:urgent`
- Results grouped by type, shown in a dropdown

### 3.2 Notes & Scratchpad

A persistent markdown scratchpad with save/archive capability.

- Active scratchpad: one well-known record per user in the `notes` table, seeded on user creation with a deterministic UUID. Not a boolean flag hunt.
- Autosaves every 30 seconds and on blur — `PUT /api/notes/scratchpad`
- Markdown rendered live with a split-pane or toggle preview
- Archive: copies current scratchpad content to a new note row, clears the scratchpad
- Archived notes appear in a sidebar list sorted by `updated_at`
- Any note (including scratchpad) can be pinned to the dashboard
- Any note can be sent to kanban as a new item — `POST /api/kanban/items` with content pre-filled
- Tags can be applied to any note

### 3.3 Bookmarks

A link archive with automatic metadata scraping.

- Submit a URL — `POST /api/bookmarks` returns 202 immediately, scraping happens async
- Meta scraper fetches: page title, og:description, og:image, favicon URL
- Failed scrapes leave the record with just the URL — no blocking errors
- Tags for searchability and grouping
- `show_on_dashboard` toggle pins to dashboard
- Sorted by `created_at` desc by default; filterable by tag
- No category field — tags replace this more flexibly

### 3.4 Kanban / Todo

A simple kanban board with priority and due dates.

- Default columns: To Do, In Progress, Done (seeded per user on account creation)
- Columns are reorderable; new columns can be added
- Per item: title, description (markdown), priority (low/medium/high), due date, tags
- Items can be moved between columns via drag-and-drop
- `show_on_dashboard` toggle pins item card to dashboard
- Items can be created from a note via "Send to kanban"

### 3.5 File browser (read-only)

Access to the storage drive. Read-only for now — write access is a future addition requiring additional security review.

- Docker volume mounted read-only into the API container
- API serves directory listings and file downloads only — no execution, no preview of executables
- Path traversal prevention: all paths resolved and checked against the mount root before any fs operation
- File type whitelist for inline preview: images, plain text, PDF
- All other types: download only
- Every access (directory list, file download) logged to `file_audit_log` in Postgres with `user_id`
- No write endpoints in v1

---

## 4. Database Schema

All primary keys are UUID using `gen_random_uuid()`. All timestamps are `TIMESTAMPTZ`. Postgres 16 assumed.

Multi-user is enforced via `user_id` foreign keys on all user-owned tables, plus Postgres Row-Level Security (RLS) policies so that even a buggy query cannot leak one user's data to another.

### 4.1 Users & Sessions

```sql
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
```

### 4.2 Notes

```sql
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

-- One scratchpad per user, seeded on account creation:
-- INSERT INTO notes (id, user_id, title, is_scratchpad)
-- VALUES (gen_random_uuid(), <user_id>, 'Scratchpad', true);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_user_isolation ON notes
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE INDEX idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX idx_notes_scratchpad   ON notes(user_id, is_scratchpad)
    WHERE is_scratchpad = true;
CREATE INDEX idx_notes_fts ON notes
    USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));
```

### 4.3 Tags (shared across all content types)

```sql
CREATE TABLE tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    VARCHAR(100) NOT NULL,
    color   VARCHAR(7) NOT NULL DEFAULT '#718096',  -- hex color for UI badges
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

CREATE TABLE kanban_item_tags (
    item_id UUID NOT NULL REFERENCES kanban_items(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE bookmark_tags (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);
```

### 4.4 Kanban

```sql
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

-- Seed default columns on user creation:
-- INSERT INTO kanban_columns (user_id, name, position) VALUES
--   (<user_id>, 'To Do', 0),
--   (<user_id>, 'In Progress', 1),
--   (<user_id>, 'Done', 2);
```

### 4.5 Bookmarks

```sql
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
```

### 4.6 Dashboard Modules

```sql
CREATE TABLE dashboard_modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL,
                -- 'note' | 'bookmark' | 'kanban_item'
                -- | 'system_stats' | 'docker_services' | 'feed_source'
    ref_id      UUID,       -- NULL for system modules (stats, docker)
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
```

### 4.7 File Access Audit Log

```sql
CREATE TABLE file_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(20) NOT NULL CHECK (action IN ('list', 'download')),
    path        TEXT NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS on audit log — admin can see all. App enforces user scoping in queries.
CREATE INDEX idx_file_audit_time ON file_audit_log(accessed_at DESC);
CREATE INDEX idx_file_audit_user ON file_audit_log(user_id);
```

### 4.8 Settings

```sql
-- Global settings (admin-managed, not per-user)
CREATE TABLE settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User preferences (per-user overrides)
CREATE TABLE user_preferences (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example global settings seed:
-- INSERT INTO settings (key, value) VALUES
--   ('portainer_url',              '"http://portainer:9000"'),
--   ('docker_label_filter',        '"dashboard.show=true"'),
--   ('stats_refresh_interval_ms',  '10000'),
--   ('docker_refresh_interval_ms', '30000');

-- Example user preferences (stored in preferences JSONB):
--   theme: 'dark' | 'light'
--   dashboard_columns: 12
--   stats_refresh_interval_ms: 10000 (can override global)
```

### 4.9 RLS Helper

The API server sets `app.current_user_id` on each connection before any query. Add this to your Express middleware:

```js
// In your DB query wrapper, before running any user-scoped query:
await db.query(`SET LOCAL app.current_user_id = '${userId}'`);
```

This means even if application code forgets a `WHERE user_id = ?` clause, Postgres RLS silently filters the rows. Belt and braces.

---

## 5. API Endpoint Reference

All routes under `/api` require a valid JWT in `Authorization: Bearer <token>` except `/api/auth/*`. The JWT payload contains `{ sub: user_id, role }`.

### 5.1 Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/login | Username + password → JWT + refresh token |
| POST | /api/auth/refresh | Refresh token → new JWT |
| POST | /api/auth/logout | Invalidate session token |
| GET  | /api/auth/me | Current user info |

### 5.2 Users — `/api/users` (admin only)

| Method | Path | Description |
|---|---|---|
| GET    | /api/users | List all users |
| POST   | /api/users | Create user (seeds scratchpad + kanban columns) |
| GET    | /api/users/:id | Get user |
| PUT    | /api/users/:id | Update user (username, email, role, active) |
| DELETE | /api/users/:id | Delete user + cascade all data |
| POST   | /api/users/:id/reset-password | Force password reset |

### 5.3 System — `/api/system`

| Method | Path | Description |
|---|---|---|
| GET | /api/system/stats | CPU, memory, uptime, disk via node:os |
| GET | /api/system/docker | Portainer API — containers with dashboard.show=true label |
| WS  | /api/system/live | WebSocket: pushes stats + docker state on interval |

### 5.4 Dashboard — `/api/dashboard`

| Method | Path | Description |
|---|---|---|
| GET    | /api/dashboard/modules | All dashboard modules for the current user |
| POST   | /api/dashboard/modules | Add a module (pin an item) |
| PUT    | /api/dashboard/modules/:id | Update position/size after drag |
| DELETE | /api/dashboard/modules/:id | Remove module from dashboard (does not delete source) |

### 5.5 Notes — `/api/notes`

| Method | Path | Description |
|---|---|---|
| GET    | /api/notes/scratchpad | Get active scratchpad for current user |
| PUT    | /api/notes/scratchpad | Autosave scratchpad |
| POST   | /api/notes/scratchpad/archive | Archive scratchpad to new note, clear scratchpad |
| GET    | /api/notes | List archived notes (sorted by updated_at desc) |
| GET    | /api/notes/:id | Get single note |
| PUT    | /api/notes/:id | Update note title/content |
| DELETE | /api/notes/:id | Delete note |
| POST   | /api/notes/:id/convert-to-kanban | Create kanban item from note content |
| POST   | /api/notes/:id/tags/:tagId | Apply tag to note |
| DELETE | /api/notes/:id/tags/:tagId | Remove tag from note |

### 5.6 Bookmarks — `/api/bookmarks`

| Method | Path | Description |
|---|---|---|
| GET    | /api/bookmarks | List all bookmarks (filter by ?tag=, ?q=) |
| POST   | /api/bookmarks | Save URL — returns 202, scraping is async |
| GET    | /api/bookmarks/:id | Get single bookmark |
| PUT    | /api/bookmarks/:id | Update title, description, show_on_dashboard |
| DELETE | /api/bookmarks/:id | Delete bookmark |
| POST   | /api/bookmarks/:id/tags/:tagId | Apply tag |
| DELETE | /api/bookmarks/:id/tags/:tagId | Remove tag |

### 5.7 Kanban — `/api/kanban`

| Method | Path | Description |
|---|---|---|
| GET    | /api/kanban/board | All columns + items for current user |
| POST   | /api/kanban/columns | Add a new column |
| PUT    | /api/kanban/columns/:id | Rename or reposition column |
| DELETE | /api/kanban/columns/:id | Delete column (cascade deletes items) |
| POST   | /api/kanban/items | Create new item |
| PUT    | /api/kanban/items/:id | Update item (title, desc, priority, due, column, show_on_dashboard) |
| DELETE | /api/kanban/items/:id | Delete item |
| POST   | /api/kanban/items/:id/tags/:tagId | Apply tag |
| DELETE | /api/kanban/items/:id/tags/:tagId | Remove tag |

### 5.8 Tags — `/api/tags`

| Method | Path | Description |
|---|---|---|
| GET    | /api/tags | List all tags for current user |
| POST   | /api/tags | Create tag (name + color) |
| PUT    | /api/tags/:id | Update tag name or color |
| DELETE | /api/tags/:id | Delete tag (cascades via join tables) |

### 5.9 Global Search — `/api/search`

| Method | Path | Description |
|---|---|---|
| GET | /api/search?q=&tags= | Search notes, bookmarks, kanban for current user. Returns grouped results. |

### 5.10 Files — `/api/files`

| Method | Path | Description |
|---|---|---|
| GET | /api/files?path=/ | Directory listing. Path resolved + validated against mount root. |
| GET | /api/files/download?path=/foo/bar.txt | File download. Path validated. Access logged with user_id. |

### 5.11 Feeds — `/api/feeds`

| Method | Path | Description |
|---|---|---|
| GET    | /api/feeds/sources | List feed sources for current user |
| POST   | /api/feeds/sources | Create a new feed source |
| GET    | /api/feeds/sources/:id | Get source + its mapping config |
| PUT    | /api/feeds/sources/:id | Update source settings |
| DELETE | /api/feeds/sources/:id | Delete source + cascade mappings + items |
| POST   | /api/feeds/sources/preview | Fetch one sample item from a URL (for mapping UI) |
| GET    | /api/feeds/sources/:id/mappings | Get all mapping rows for a source |
| PUT    | /api/feeds/sources/:id/mappings | Replace all mappings for a source (send full array) |
| POST   | /api/feeds/sources/:id/remap | Re-run applyMapping() on all stored raw items |
| GET    | /api/feeds/sources/:id/items | Get cached normalised items for a source |
| POST   | /api/feeds/sources/:id/poll | Trigger an immediate poll |

### 5.12 User Preferences — `/api/preferences`

| Method | Path | Description |
|---|---|---|
| GET | /api/preferences | Get current user's preferences |
| PUT | /api/preferences | Update preferences (theme, dashboard columns, etc.) |

---

## 6. Frontend Architecture

### 6.1 Stack

- React 18 + Vite
- Tailwind CSS — clean minimalist design, no component library dependency
- React Router for section navigation (Dashboard, Notes, Bookmarks, Kanban, Files, Feeds)
- TanStack Query (react-query) for data fetching, caching, and background refetch
- react-markdown + remark-gfm for markdown rendering in notes
- dnd-kit for drag-and-drop (dashboard layout + kanban column/card movement)
- Light/dark mode via Tailwind's class-based dark mode — preference stored in `user_preferences`

### 6.2 Layout

- Persistent sidebar: navigation icons + section labels
- Global search bar in the header — always visible, keyboard shortcut `Cmd/Ctrl+K`
- User avatar/menu in header — logout, preferences, admin panel (if admin role)
- Main content area fills remaining space
- Dashboard is the default/home route

### 6.3 Dashboard grid

- CSS Grid with configurable column count (default 12, stored in user_preferences)
- Modules are positioned using `pos_x`, `pos_y`, `width`, `height` from `dashboard_modules`
- Drag-and-drop repositioning via dnd-kit; debounced PUT to API on drop
- Add module button: opens a picker to choose content type or select a specific note/bookmark/kanban item
- System stats and docker services modules are always available to add; they have no `ref_id`

### 6.4 Notes editor

- Split pane: raw markdown on left, rendered preview on right (toggle-able on narrow screens)
- Autosave debounce: 30 seconds after last keystroke
- Archive button with confirmation — irreversible (scratchpad is cleared)
- Note list in sidebar sorted by `updated_at`, shows title and snippet

### 6.5 Bookmark scrape feedback

- On POST, show the bookmark immediately in the list with a 'Fetching metadata…' state
- Poll `GET /api/bookmarks/:id` every 3 seconds until `scrape_status` is not `'pending'`
- Update card in place when metadata arrives

### 6.6 Auth flow

- Login page served at `/login` — username + password + TOTP (WAN only, Authelia handles this transparently on LAN)
- JWT stored in `httpOnly` cookie — not accessible to JS
- TanStack Query handles 401 responses by redirecting to `/login`
- Admin users see an additional "Admin" nav item with user management

---

## 7. Key Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Multi-user from day one | `user_id` FK + RLS on all tables | Cheaper to build in than retrofit. RLS is a hard security boundary, not just application-level filtering. |
| Scratchpad identity | One row per user, seeded on account creation | Avoids scanning for `is_scratchpad = true`; clean per-user identity without a separate table. |
| Bookmark scraping | Async / 202 pattern with p-queue | Saves fast, no blocked requests. p-queue keeps concurrency manageable without Redis. |
| Tag storage | Single `tags` table per user + 3 join tables | One tag named 'urgent' works across notes, bookmarks, kanban. Enables cross-type tag search. |
| Dashboard layout | `dashboard_modules` table with grid coords | Layout survives container restarts. Clean separation: pinning a note doesn't mutate the note. |
| File browser writes | Deferred, read-only mount in v1 | Reduces attack surface significantly while the auth stack is being established. |
| LAN vs WAN auth | Caddy dual listener + trusted IP header | One app container, no duplicated deployment. LAN access stays fast, WAN stays secure. |
| Portainer token | Server-side env var only | Token never reaches the browser. Scoped to read-only Portainer API key. |
| Settings split | Global `settings` table + per-user `user_preferences` | Global config (Portainer URL etc.) is admin-managed; layout/theme prefs are per-user. |
| RLS helper | `SET LOCAL app.current_user_id` per connection | Belt-and-braces: even buggy app code can't leak rows across users. |

---

## 8. Future Plans

### 8.1 File manager write access

When added, this requires: explicit per-session write unlock (a second confirmation), full audit logging of every write/delete with `user_id`, strict path validation, and content-type checking on upload. Do not add writes until the auth stack has been running in production for a while.

### 8.2 MCP integration

The plan is to expose notes and kanban over MCP so AI tools can read and create items. The API is already structured to support this — MCP would call the same endpoints. Authentication would use a separate long-lived API token scoped to a user, rather than session auth.

### 8.3 Caddy as the stack-wide reverse proxy

Trashnet-Core's addition of Caddy is a good opportunity to migrate the other 35 containers off their raw port mappings and onto Caddy subdomains or path routes. This would solve the port-memory problem at the infrastructure level, not just for this app. Worth planning as a parallel workstream.

### 8.4 GitHub push — offsite backup and static site publishing

Two related but distinct use cases, both using the same GitHub integration:

**Offsite backup of notes**

Archived notes push to a private GitHub repo as individual `.md` files, with each archive action creating a commit. This gives notes a full off-site version history essentially for free — if the database is ever lost, the repo is a complete recovery point. The scratchpad itself could also sync on autosave, committing to a `scratchpad.md` file so even un-archived work is preserved.

`octokit` (GitHub's official JS client) is the right tool here — it handles the API calls without needing to manage an actual git checkout or `simple-git` on the server. The flow is just `GET` the current file SHA, then `PUT` the new content with the previous SHA, which GitHub translates to a commit.

**Publishing to a static site generator**

If notes are already landing in a GitHub repo as markdown, an Astro (or any SSG) site can consume them directly as a content collection. The pipeline becomes:

```
Write in scratchpad → Archive → Push to GitHub → Astro rebuild triggers → Published
```

Astro's git-based deploy (via GitHub Actions or Cloudflare Pages) handles the rebuild automatically on push. The "CMS" is just the trashnet scratchpad — no separate tooling needed.

Kanban `done` items could also serialize to the same repo as frontmatter-tagged entries, giving a passive log of completed work over time.

**Sync direction**

Push-only (trashnet → GitHub) is simple and covers 95% of the use case. Bidirectional sync (edits made in GitHub UI reflecting back into trashnet) needs a webhook receiver and conflict resolution — not worth the complexity unless it becomes a real need. A manual "pull from GitHub" button bridges the gap for the occasional edit made outside trashnet.

**Configuration**

All GitHub settings live in the `settings` table (global) or `user_preferences` (per-user repo targets):

```
github_token          — personal access token, contents:write scope on target repo
github_repo           — e.g. 'username/my-notes'
github_branch         — default 'main'
github_notes_path     — path prefix in repo, e.g. 'notes/' or 'src/content/posts/'
github_push_on_archive — boolean, auto-push when a scratchpad is archived
```

The token is stored encrypted in the `settings`/`user_preferences` JSONB and never returned to the frontend in plaintext — only a masked indicator that one is set.

---

## 9. Build Phase Plan

Each phase produces a **runnable, testable app**. Do not start the next phase until the current one works end-to-end. Phases are designed to be handed to an AI coding assistant one at a time — include only the relevant spec sections in the prompt, and explicitly list what to stub or skip.

### Prompt template

Use this structure for every phase. Fill in the bracketed sections:

```
You are building trashnet-core, a self-hosted homelab dashboard.
Stack: Node.js + Express, React 18 + Vite + Tailwind CSS, PostgreSQL 16, Docker.

Full spec for this phase: [paste only the relevant sections from the plan doc]

Current phase: [N — name]
Already built and working: [list phases already complete]

Your task: [specific deliverable]
Build in this order: [ordered step list]

Do NOT build: [explicit list of features to skip — stubs only]
Do NOT modify: [files/tables already working from previous phases]

At each step, confirm the approach and show the file structure before writing code.
Flag any assumptions you are making.
```

The "Do NOT build" line is the most important. Without it, the assistant will helpfully scaffold the entire app and you'll spend the session debugging a half-working everything instead of a fully-working something.

---

### Phase 1 — Stack skeleton & auth

**Goal:** `docker compose up` gives a working login screen that authenticates against the database. Nothing else.

**Includes:**
- Monorepo folder structure (`/api`, `/web`, `/docker`, `/migrations`)
- `docker-compose.yml` — postgres, api, web, caddy services
- Caddy config — LAN passthrough + WAN stub (Authelia wired up later)
- Postgres container + init script running migration 001
- Migration 001: `users`, `sessions` tables only, RLS helper
- Express boilerplate: DB pool, `SET LOCAL app.current_user_id` middleware, JWT validation middleware
- Auth endpoints only: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- React shell: router, login page, protected route wrapper, basic nav sidebar (links, no content)
- Seed: one admin user

**Do NOT build:** any feature tables, any feature endpoints, any feature UI pages

**Test:** log in, get a JWT, hit `/api/auth/me`, log out. Nav sidebar visible but all links go to empty placeholder pages.

---

### Phase 2 — Notes & scratchpad

**Goal:** a fully working notes section — scratchpad, archive, tags, markdown preview.

**Includes:**
- Migration 002: `notes`, `tags`, `note_tags` tables + RLS policies + indexes
- Seed: scratchpad row per user on creation
- All `/api/notes/*` and `/api/tags/*` endpoints
- React notes section: scratchpad editor (split-pane markdown), autosave, archive button, archived note list, tag management
- Global search bar in header — notes only at this stage

**Do NOT build:** dashboard modules, kanban, bookmarks, feeds, pinning, GitHub push

**Test:** write in scratchpad, autosave fires, archive creates a new note, tags apply and filter, search finds content.

---

### Phase 3 — Dashboard shell & system modules

**Goal:** a working dashboard with drag-and-drop layout, system stats, and Docker services — no user content pinned yet.

**Includes:**
- Migration 003: `dashboard_modules` table + RLS
- `/api/system/stats`, `/api/system/docker`, `/api/system/live` (WebSocket)
- `/api/dashboard/modules` CRUD endpoints
- React dashboard: 12-column CSS grid, dnd-kit drag/drop, system stats module, Docker services module (Portainer API via backend), layout persistence on drag
- Settings seed: `portainer_url`, `docker_label_filter`, refresh intervals

**Do NOT build:** pinning of notes/bookmarks/kanban, any other modules

**Test:** dashboard loads with live stats, Docker containers list updates, drag a module and reload — position persists.

---

### Phase 4 — Bookmarks

**Goal:** fully working link archive with async metadata scraping and dashboard pinning.

**Includes:**
- Migration 004: `bookmarks`, `bookmark_tags` tables + RLS
- All `/api/bookmarks/*` endpoints, async scraper with p-queue, `scrape_status` polling
- React bookmarks section: add URL, metadata card with scrape feedback, tag filter, search
- Pinning: `show_on_dashboard` toggle creates/removes `dashboard_modules` row, pinned bookmark card appears on dashboard

**Do NOT build:** kanban, feeds, GitHub push

**Test:** save a URL, watch metadata populate, pin to dashboard, card appears. Remove pin, card gone.

---

### Phase 5 — Kanban

**Goal:** fully working kanban board with priorities, due dates, and dashboard pinning.

**Includes:**
- Migration 005: `kanban_columns`, `kanban_items`, `kanban_item_tags` tables + RLS
- Seed: default columns per user on creation
- All `/api/kanban/*` endpoints
- React kanban section: columns, cards, dnd-kit drag between columns, priority badge, due date, tag filter
- Note → kanban conversion (`POST /api/notes/:id/convert-to-kanban`)
- Pinning: pin individual items to dashboard

**Do NOT build:** feeds, GitHub push, file browser

**Test:** create items, drag between columns, convert a note to a kanban item, pin a card to dashboard.

---

### Phase 6 — Global search

**Goal:** header search working across all content types with tag filtering.

**Includes:**
- `GET /api/search?q=&tags=` endpoint — queries notes + bookmarks + kanban in one shot using Postgres FTS
- React: search dropdown with grouped results, `tag:` prefix filter, keyboard navigation, `Cmd/Ctrl+K` shortcut

**Do NOT build:** feeds, file browser, GitHub

**Test:** search term returns results from all three content types. Tag filter narrows correctly.

---

### Phase 7 — Feed module

**Goal:** fully working feed module — JSON and RSS sources with mapping UI and dashboard cards.

**Includes:**
- Migration 006: `feed_sources`, `feed_mappings`, `feed_items` tables + RLS
- All `/api/feeds/*` endpoints
- In-process poller with exponential backoff
- React feed management: add source, mapping UI (key tree + field slots + live preview), test fetch button
- Dashboard feed card: scrollable item list, staleness indicator, health dot

**Do NOT build:** file browser, GitHub push

**Test:** add a GitHub releases RSS feed, map title/date/url, card appears on dashboard and updates on poll.

---

### Phase 8 — File browser

**Goal:** read-only access to the storage drive mount.

**Includes:**
- Storage volume mounted read-only into API container
- `/api/files` directory listing and download endpoints, path traversal prevention
- Migration 007: `file_audit_log` table
- React file browser section: directory tree, file type icons, inline preview (images, text, PDF), download button

**Do NOT build:** write endpoints, GitHub push

**Test:** browse directories, download a file, confirm audit log row is written, attempt path traversal and confirm it's blocked.

---

### Phase 9 — User management & admin

**Goal:** admin UI for managing users, and per-user preferences.

**Includes:**
- `/api/users/*` endpoints (admin only)
- `/api/preferences` endpoints
- React admin panel: user list, create/edit/deactivate user, reset password
- React preferences page: theme toggle, dashboard column count
- `user_preferences` table (migration 008)

**Test:** create a second user, log in as them, confirm data isolation (their notes don't show in user 1's session).

---

### Phase 10 — GitHub push integration

**Goal:** archive a note and have it push to a GitHub repo as a `.md` file.

**Includes:**
- `octokit` in the API server
- `POST /api/notes/:id/github-push` endpoint
- Auto-push on archive if `github_push_on_archive` setting is true
- Settings UI for GitHub token, repo, branch, path prefix (token masked after save)
- Scratchpad sync on autosave (optional, toggle in preferences)

**Test:** archive a note, check GitHub repo for the commit. Disable auto-push, manually push, same result.

---

### Phase 11 — Hardening & Authelia

**Goal:** production-ready auth and security review before any public exposure.

**Includes:**
- Authelia config wired up in Caddy for WAN requests
- TOTP enrolment flow
- Rate limiting confirmed on login endpoint
- Audit log review — confirm all file accesses are logged
- GitHub token encryption at rest
- Docker secrets for DB credentials, JWT secret, Authelia secrets (replace env vars)
- `user_preferences` dark/light mode persisted and applied on load

**Test:** connect from outside the LAN, hit Authelia TOTP prompt, authenticate, reach the app. LAN access bypasses Authelia and goes straight through.

---

### Phase order rationale

| Phase | Why this order |
|---|---|
| 1 — Skeleton | Nothing works without the stack. Auth must exist before any feature. |
| 2 — Notes | Simplest self-contained feature. Proves DB + API + frontend loop works. |
| 3 — Dashboard | Needs the module table, but no user content yet — lower complexity. |
| 4 — Bookmarks | Introduces async pattern (scraper). Pinning proves dashboard modules work. |
| 5 — Kanban | Builds on tags pattern already established. Note conversion needs notes done first. |
| 6 — Search | Needs all content tables to exist. Straightforward once they do. |
| 7 — Feeds | Most self-contained feature. Complex enough to deserve its own phase. |
| 8 — File browser | Security-sensitive. Better to add late once auth is stable. |
| 9 — User management | Polish. App is fully usable single-user before this. |
| 10 — GitHub push | External integration. Completely additive, nothing depends on it. |
| 11 — Hardening | Last, intentionally. Don't expose to internet until this is done. |

---

## 10. Feed Module

The feed module allows arbitrary JSON APIs and RSS/Atom feeds to be pulled in and displayed as dashboard cards. The core challenge is that every feed has a different payload shape — the solution is a per-feed mapping table that maps a fixed set of display fields to dot-paths in the incoming payload, using an Overseerr-style `{{variable}}` convention in reverse.

### 10.1 How it works

Each feed source gets its own mapping configuration. When a payload arrives, the resolver walks the mapping rows for that source and extracts values by dot-path. The result is a normalised item with a fixed set of display fields the dashboard card knows how to render. The raw payload is preserved so mappings can be re-applied without re-fetching.

- Feed types: JSON (polled endpoint or incoming webhook) and RSS/Atom (polled)
- RSS/Atom is normalised to a JS object first using `rss-parser`, then the same mapper runs on it
- JSON feeds can be nested — dot-path handles arbitrary depth: `author.name`, `data.items[0].title`
- Array feeds: if the payload root is an array, or a path resolves to one, each item is mapped individually
- Mapping is per-source, in the database — no code changes to add a new feed

### 10.2 Display fields (normalised card shape)

All optional except `title`. Unmapped fields are blank on the card.

| Field | Type | Notes |
|---|---|---|
| title | string | Required. Main heading of the card. |
| date | string / ISO timestamp | Displayed as relative time (e.g. '2 hours ago'). Any parseable date string works. |
| url | string | Makes the card title a clickable link. |
| author | string | Shown as a byline below the title. |
| summary | string | Body text. Truncated at ~200 chars with expand. |
| image_url | string | Thumbnail shown at top or side of card. |
| badge | string | Small pill label e.g. 'error', 'merged', 'open'. |
| badge_color | string | Hex color for the badge pill. Defaults to gray. |

### 10.3 Mapping configuration UI

Setup flow — no manual dot-path typing needed:

1. User pastes the feed URL and selects the type (JSON or RSS)
2. Backend fetches one sample item and returns it to the frontend
3. Frontend renders the raw payload as an expandable key tree
4. User clicks or drags a key from the tree into a display field slot
5. Path is written automatically — clicking 'name' inside 'author' writes `author.name`
6. Each slot shows a live preview from the sample payload
7. Save writes the mapping rows to `feed_mappings`
8. A 'test fetch' button re-runs the mapping against a fresh payload and shows the resulting card

### 10.4 Database schema

```sql
CREATE TABLE feed_sources (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    endpoint_url      TEXT NOT NULL,
    feed_type         VARCHAR(10) NOT NULL CHECK (feed_type IN ('json', 'rss')),
    -- For JSON: dot-path to the array of items (e.g. 'data.results')
    -- Leave NULL if the root payload is already an array or single object
    items_path        TEXT,
    poll_interval_s   INT NOT NULL DEFAULT 300,   -- 5 minutes
    show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
    failure_count     INT NOT NULL DEFAULT 0,
    last_fetched_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_sources_user_isolation ON feed_sources
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- One row per display field per source
CREATE TABLE feed_mappings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id      UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    display_field  VARCHAR(20) NOT NULL
                       CHECK (display_field IN
                           ('title','date','url','author',
                            'summary','image_url','badge','badge_color')),
    payload_path   TEXT NOT NULL,   -- e.g. 'author.name', 'data.headline'
    UNIQUE (source_id, display_field)
);

-- Rolling cache of fetched items, keyed by source + dedup_key
CREATE TABLE feed_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    dedup_key   TEXT NOT NULL,   -- url or guid or hash of raw
    normalised  JSONB NOT NULL,  -- result of applying the mapping
    raw         JSONB NOT NULL,  -- original payload item, for re-mapping
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, dedup_key)
);

CREATE INDEX idx_feed_items_source  ON feed_items(source_id, fetched_at DESC);
CREATE INDEX idx_feed_sources_poll  ON feed_sources(last_fetched_at)
    WHERE show_on_dashboard = true;
```

### 10.5 Resolver implementation

```js
// Resolve 'author.name' against { author: { name: 'Alice' } }
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? null;
}

// Apply all mappings for a source to a single payload item
function applyMapping(payloadItem, mappings) {
  const result = {};
  for (const { display_field, payload_path } of mappings) {
    const value = resolvePath(payloadItem, payload_path);
    if (value !== null) result[display_field] = String(value);
  }
  return result;  // normalised item ready for feed_items.normalised
}

// Extract the items array from a JSON payload using items_path
function extractItems(payload, itemsPath) {
  if (!itemsPath) return Array.isArray(payload) ? payload : [payload];
  const arr = resolvePath(payload, itemsPath);
  return Array.isArray(arr) ? arr : [arr].filter(Boolean);
}

// RSS: rss-parser normalises to a consistent JS object first,
// then the same applyMapping() runs on each item.feed.items entry.
```

### 10.6 Deduplication

`dedup_key` resolved in order: value at the `url` mapping → value at a `guid` or `id` path → SHA-1 hash of raw item JSON. Re-polling never duplicates cards; items update in place if the payload changes.

### 10.7 Poller

In-process poller — no external job queue needed for a single-process Node app:

- On startup: read all sources with `show_on_dashboard = true`, schedule each at `poll_interval_s`
- New/updated item: `INSERT ... ON CONFLICT (source_id, dedup_key) DO UPDATE SET normalised = ..., fetched_at = NOW()`
- After poll: `UPDATE feed_sources SET last_fetched_at = NOW(), failure_count = 0`
- Failed poll: increment `failure_count`, back off exponentially up to max 1 hour
- WebSocket push: emit `feed:update` with `source_id` and new normalised items

### 10.8 Dashboard card

Each feed source with `show_on_dashboard = true` becomes a `dashboard_modules` row of type `feed_source`. The card renders a compact scrollable list of the most recent N items (configurable, default 5). Card header shows source name and `last_fetched_at` as relative time. A dot indicator shows green/amber/red fetch health based on `failure_count`.

### 10.9 Example mappings

**GitHub releases RSS**

```
feed_type:  rss
items_path: (null — rss-parser provides items array directly)

display_field   payload_path
title           title
date            pubDate
url             link
author          creator      (dc:creator via rss-parser)
summary         contentSnippet
```

**Gotify push notification API**

```
feed_type:  json
items_path: messages   (payload: { messages: [...], paging: {...} })

display_field   payload_path
title           title
date            date
summary         message
badge           priority
```