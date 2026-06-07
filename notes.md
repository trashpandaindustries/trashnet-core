## Notes for future improvements

### Dashboard
- Edit mode toggle — a padlock icon in the dashboard header. Unlocked state shows resize handles + remove buttons. Locking saves any pending layout changes.
- Resize handles — bottom-right corner drag handle on each card. As you drag, it snaps to the nearest grid column/row boundary and updates the card's width/height live. On drop, fires the existing PUT /api/dashboard/modules/:id with new dimensions.
- Portainer module icons, allow image linking or is there a big old databse of them we can use

### Notes
- Add MCP/LLM integration for summarizing or formatting notes.
- allow for setting the filename field inside the notes section.

### Bookmarks
- Generate and store full screenshot thumbnails of bookmarked pages instead of relying purely on og:image.

### Kanban
 - kanban status doesnt update on dashboard, if a item has been moved to in progress/review/done it still shows as To Do on the item card on the dash
### Feeds
- Polling health indicators & notifications: gracefully alert the user if a feed fails to poll repeatedly.

### Files
 - Look at potential ways to securely share files, either by temp passwords and/or time 

### Preferences

### Platform Admin
- Access and action logs. 


