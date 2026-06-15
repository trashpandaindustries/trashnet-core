Security
The JWT localStorage storage is the big one you already know about. Beyond that, api/auth.ts has SQL injection risk in the RLS helper — SET LOCAL app.current_user_id = '${userId}' uses string interpolation directly. Should use parameterized: SET LOCAL app.current_user_id = $1. Same pattern in db.ts's withUser.
The GitHub token encryption uses a static salt in crypto.scryptSync: scryptSync(JWT_SECRET, 'salt', 32) — that literal 'salt' string means every installation has the same salt, weakening the key derivation significantly.
Bugs
In api/notes.ts, the archive title extraction uses split('\\n') (escaped backslash-n as a literal string) instead of split('\n'), so it'll never split on actual newlines and titles will always be 'Untitled'.
The withUser wrapper in db.ts runs inside a transaction with SET LOCAL, which is correct — but the bare query() function doesn't set the user context at all, meaning any direct query() calls bypass RLS entirely. Several places use pool.query() directly (settings, logs, users), which is fine for admin routes but worth auditing.
Kanban
The status field uses a CHECK constraint with hardcoded values ('To Do', 'In Progress', 'In Review', 'Done') but the frontend renders columns dynamically. If someone tries to add a custom column name it'll hit a DB constraint error with no graceful handling.
Feed poller
pollSource in api/feeds.ts accepts a globalClient but the ON CONFLICT condition has a subtle issue — WHERE feed_items.raw != $4 means if the raw payload is unchanged it won't update fetched_at, which is probably fine, but rowCount will be 0 even for existing unchanged items, so hasNewItems stays false correctly. That part is actually fine on closer inspection.
Minor
web/src/lib/api.ts imports useState but never uses it. The deleteModule mutation in Dashboard.tsx queries ['dashboard', 'modules'] but other places use ['dashboard_modules'] — that inconsistency means cache invalidation won't work correctly between them.