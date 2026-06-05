# Trashnet-Core User Guide

Welcome to Trashnet-Core, your unified personal operations dashboard. This guide walks you through the core modules and how to use them effectively to manage notes, links, tasks, and system monitoring in one place.

## 1. Dashboard

The Dashboard is the central hub of Trashnet-Core, designed as a customizable grid of modules.

### Grid Layout & Pinning
- **Drag-and-Drop:** You can freely drag modules around the grid to rearrange them. Layouts are saved automatically for your user account.
- **Pinning Content:** Across the app, you will see options to "Pin to Dashboard" (or "Show on Dashboard") on Bookmarks, Kanban items, Notes, and Feed sources. Pinning an item creates a dedicated module for it on your home screen.
- **System Modules:** By default, you can add two core homelab modules using the "System Stats" or "Docker Services" buttons in the top right corner of the dashboard screen.

### Modules Available
- **System Stats:** Live monitoring of your host machine's CPU load, Memory usage, Uptime, and Disk utilization.
- **Docker Services:** Automatically discovers and lists your Docker containers (specifically those with a `dashboard.show=true` label, powered by Portainer).
- **Pinned Items:** Specific Notes, Bookmarks, and Kanban tasks.
- **Feeds:** Scrollable summary cards of configured RSS or JSON feeds.

#### Docker Services Module
The docker services module will periodically (30 second increments) poll your Portainer instance for containers featuring "dashboard.show=true" and automatically add the container to the system. This can be expanded on using the following labels added to your container.

Example:
```yaml
    labels:
      - "dashboard.show=true"
      - "dashboard.url=http://192.168.1.69:1221"
      - "dashboard.name=Papra"
      - "dashboard.icon=papra"
      - "dashboard.description=Document Management"
```
(icon is not implemented as of yet)


---

## 2. Notes & Scratchpad

The Notes module functions as a quick-capture markdown scratchpad and persistent notebook.

### The Scratchpad
The primary input area is a persistent Scratchpad. It auto-saves your text, allowing you to quickly dump thoughts, code snippets, or notes. 
- **Markdown Support:** The editor fully supports Markdown (including code blocks and tables) with a live split-pane preview.
- **Autosave:** Your scratchpad content is automatically saved periodically and when the editor loses focus.

### Archiving and Managing Notes
- **Archive:** Once you’ve drafted a note you want to keep long-term, click "Archive". This moves the content into your archived notes library and clears out the scratchpad for new thoughts.
- **Tags:** You can apply custom, color-coded tags to any archived note for quick filtering and searching.
- **Send to Kanban:** Need to take action on a note? You can instantly convert an archived note into a Kanban task using the "Send to Kanban" feature.

---

## 3. Bookmarks

The Bookmarks module acts as a personal link archive with automatic background metadata scraping.

### Features
- **Saving Links:** Paste a URL to quickly save it. The system will process it asynchronously in the background.
- **Automatic Scrape:** A background worker will attempt to pull the page title, description, and thumbnail image automatically. If it fails, the raw URL is safely preserved.
- **Tagging:** Like Notes, you can apply custom tags to organize links (e.g., `tech`, `recipes`, `inspiration`).
- **Dashboard Pinning:** Pin highly visited or important links to access them directly from the Dashboard.

---

## 4. Kanban (Tasks)

The Kanban module provides a flexible drag-and-drop board for task management.

### Features
- **Columns:** Standard "To Do", "In Progress", and "Done" columns are provided by default, but you can add and rename columns to fit your workflow.
- **Card Details:** Tasks support Markdown descriptions, Priority settings (Low, Medium, High), and Due Dates.
- **Drag & Drop:** Move cards smoothly between columns to update their status.
- **Integration:** Tasks can be tagged. You can also pin high-priority items straight to your Dashboard to keep them in focus.

---

## 5. Feeds

The Feeds module lets you pull in custom dynamic content from the web—both standard RSS feeds and arbitrary JSON APIs—and view them as normalized cards on your Dashboard.

### Types of Feeds
- **RSS/Atom:** Enter an RSS feed URL, and the system handles normalization.
- **JSON APIs:** Pull data from an arbitrary API endpoint (e.g., release logs, issue trackers, weather alerts).

### Mapping Configuration
To ensure custom JSON shapes are understood by the dashboard, the system provides a visual mapping UI:
1. Provide the Endpoint URL.
2. Fetch a sample payload to view the Data Inspector tree.
3. Map internal "Paths" (e.g., `author.name`, `data.items`) to Standard Display Fields (Title, Summary, Date, Badge, etc.).
4. The result produces a clean feed card summarizing the incoming items dynamically.

---

## 6. Global Search

Trashnet-Core includes a unified search bar in the top navigation header (`Cmd/Ctrl+K` integration planned).
- You can search across your Notes, Bookmarks, and Kanban items simultaneously.
- Results are smartly organized by content type.

---

## 7. File Browser

The File Browser module provides secure, read-only access to a designated storage drive mounted on your homelab server.

### Features
- **Directory Navigation:** Browse through folders and view files using breadcrumb navigation and visual icons indicating file types.
- **File Previews:** Instantly preview common file types directly in your browser, including images (PNG, JPG, SVG, etc.), PDFs, text files, and standard code formats without needing to download them first. 
- **File Downloads:** Download any file securely using the download action on the item row or via the preview dialog.
- **Search Filtering:** Quickly filter files in the current directory using the search input.
- **Security:** Access is strictly read-only, logging every preview and download action for audit purposes, with protections built-in against path traversal attempts.

---

## 8. User Controls & Administration

Trashnet-Core supports multiple users per instance with partitioned data and preferences, plus global administrative controls.

### Preferences (All Users)
Accessible via the sidebar gear icon, current settings allow you to customize your personal layout workspace:
- **Interface Theme:** Toggle your desired aesthetic (Dark Mode or experimental Light Mode).
- **Dashboard Grid Columns:** Adjust the underlying layout resolution of the drag-and-drop dashboard. Default columns are 12, but can be scaled up or down to support specific display resolutions.

### Platform Admin (Admin Users Only)
Users designated as Administrators gain access to the Platform Admin panel to manage the system's users.
- **User Management:** Create new users. Accounts are automatically seeded with default kanban columns and a scratchpad.
- **Visibility & Actions:** View user roles, activity status (disabled/active), and basic account properties.
- **Editing:** Update user data, change roles, or deactivate users to freeze their platform access.
- **Password Resets:** Administrators can force-reset user passwords, an action that will additionally wipe all active sessions for the targeted user.