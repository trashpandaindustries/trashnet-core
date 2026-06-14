## Notes for future improvements

### Dashboard

### Notes
- Add MCP/LLM integration for summarizing or formatting notes.
- Dynamic frontmatter validation and malformation check
The goal is catching obvious issues before they cause a silent failure downstream.
What "malformed" reasonably means for frontmatter:

Block exists but isn't properly closed (no closing ---)
Block exists but is empty
Known date fields (pubDate, updatedDate, date) are present but not parseable as a date
tags field is present but isn't an array (e.g. someone typed tags: docker instead of tags: ['docker'])
Indentation/YAML syntax errors that would break any parser

What it deliberately ignores:

Which fields are present or absent (that's schema enforcement — too opinionated)
Field naming conventions (astro vs hugo vs jekyll all differ)
Values beyond the structural checks above

Implementation sketch:
On archive click, before the existing api.post('/api/notes/scratchpad/archive') fires, run a client-side parse attempt using a lightweight YAML parser already available in the dep tree (or a tiny regex pass), then show a modal with one of three states:

No frontmatter detected → proceed silently as today
Frontmatter detected, looks valid → show parsed summary, confirm to archive
Frontmatter detected, structural issue found → show the specific problem, let them cancel or archive anyway

The "archive anyway" option is important — it shouldn't block, just inform.

If the front matter is present, parse it at the top of the formatted note.

### Bookmarks

### Kanban
 - kanban status doesnt update on dashboard, if a item has been moved to in progress/review/done it still shows as To Do on the item card on the dash. Also clicking the title should send you to the kanban for ease of use

### Feeds
- Polling health indicators & notifications: gracefully alert the user if a feed fails to poll repeatedly.

### Files


### Preferences

### Platform Admin


### Websearch
