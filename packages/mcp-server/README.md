# @noahshrader/mcp-apple-notes

MCP server for Apple Notes. Exposes search, read, create, append, tag search, diagnostics, and note-sync tools over the [Model Context Protocol](https://modelcontextprotocol.io) stdio transport.

## Requirements

- **macOS only** — relies on JXA (`osascript`) and the local Apple Notes SQLite database
- **Node.js >=22.5** — uses the built-in `node:sqlite` module
- **Apple Notes** must be installed and the account synced at least once

## Usage

### Run with npx (no install required)

```sh
npx @noahshrader/mcp-apple-notes
```

### Global install

```sh
npm install -g @noahshrader/mcp-apple-notes
mcp-apple-notes
```

## MCP Client Configuration

Add this to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "apple-notes": {
      "command": "npx",
      "args": ["-y", "@noahshrader/mcp-apple-notes"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "apple-notes": {
      "command": "mcp-apple-notes"
    }
  }
}
```

## Tools

### `search_notes`
Search Apple Notes by text query, folder, account, and result limit. Returns note summaries (id, title, folder, dates, excerpt).

| Input | Type | Description |
|---|---|---|
| `query` | string? | Text to match against note titles and bodies |
| `folder` | string? | Folder name to scope the search |
| `account` | string? | Account name to scope the search |
| `limit` | number? | Maximum notes to return |

### `search_tags`
Search hashtags used in Apple Notes. With Full Disk Access uses a fast direct SQLite query returning all tags with occurrence counts. Falls back to a JXA body-text scan otherwise.

| Input | Type | Description |
|---|---|---|
| `query` | string? | Tag text to match (with or without leading `#`) |
| `folder` | string? | Folder name to scope the search |
| `account` | string? | Account name to scope the search |
| `limit` | number? | Maximum tags to return |
| `maxNotes` | number? | Maximum notes to scan (JXA fallback only) |
| `timeBudgetMs` | number? | Max scan time before returning partial results (JXA fallback only) |

### `read_note`
Read a single note by its opaque identifier. With Full Disk Access, includes a `structured` field containing `checklists` (items with `text` and `done`) and `tags` (hashtags).

| Input | Type | Description |
|---|---|---|
| `id` | string | Opaque Apple Notes note identifier |

### `read_folder`
Read the full plain-text body of every note in a folder in a single call. Returns an array sorted by Apple Notes order. With Full Disk Access each note includes `structured` content. Suitable for bulk analysis without per-note round-trips.

| Input | Type | Description |
|---|---|---|
| `folder` | string | Folder name to read all notes from |
| `account` | string? | Account name to scope the folder lookup |

### `create_note`
Create a new Apple Note. Use `dryRun: true` to preview the mutation without writing.

| Input | Type | Description |
|---|---|---|
| `title` | string | Title for the new note |
| `body` | string | Body content for the new note |
| `folder` | string? | Folder to create the note in |
| `account` | string? | Account to create the note in |
| `dryRun` | boolean? | Return a preview without mutating Notes |

### `append_note`
Append content to an existing note. Use `dryRun: true` to preview.

| Input | Type | Description |
|---|---|---|
| `id` | string | Opaque Apple Notes note identifier |
| `content` | string | Content to append to the note body |
| `separator` | string? | Separator inserted before appended content (default: `\n\n`) |
| `dryRun` | boolean? | Return a preview without mutating Notes |

### `diagnostics`
Check Apple Notes reachability, permissions, and platform diagnostics. Useful for troubleshooting connectivity and permission issues.

### `note_sync`
Sync Apple Notes folders into a local JSON cache (`~/.mcp-apple-notes/note-cache` by default). Checklists and attachments are extracted automatically. Unchanged notes are skipped based on a content hash.

| Input | Type | Description |
|---|---|---|
| `folder_names` | string[] | Folder names to sync (e.g. `["Journal", "2025", "Projects"]`) |
| `cache_dir` | string? | Custom cache directory path |

### `note_list`
List cached note entries from a previously synced cache, optionally filtered by year. Returns each entry's title, year, body preview, checklists, and attachment paths.

| Input | Type | Description |
|---|---|---|
| `year` | string? | 4-digit year to filter entries (e.g. `"2026"`) |
| `cache_dir` | string? | Custom cache directory path |

### `note_get`
Retrieve a single cached note entry by its Apple Notes `noteId` (x-coredata:// URI). Returns the full entry including all checklists and attachments.

| Input | Type | Description |
|---|---|---|
| `note_id` | string | The x-coredata:// URI of the note |
| `cache_dir` | string? | Custom cache directory path |

### `note_sync_status`
Return the status of the most recent sync: last sync time, entry count, error count, and any error messages.

| Input | Type | Description |
|---|---|---|
| `cache_dir` | string? | Custom cache directory path |

## Permissions

Some tools require **Full Disk Access** for your terminal or MCP client:

| Feature | Without FDA | With FDA |
|---|---|---|
| `search_notes` | JXA (slower) | Direct SQLite (fast) |
| `search_tags` | JXA body scan | Direct SQLite with counts |
| `read_note` / `read_folder` | JXA only | SQLite + structured content |
| `note_sync` | Not available | Required |

To grant Full Disk Access: **System Settings → Privacy & Security → Full Disk Access** → add your terminal app or MCP client host.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `PERMISSION_DENIED` errors | Full Disk Access not granted |
| Empty results / no notes | Apple Notes not synced; open Notes.app and wait for sync |
| `osascript` timeout | Notes.app is busy or a large sync is in progress |
| `note_sync` returns no entries | Full Disk Access is required for the sync tools |
| Command not found after `npm install -g` | Check `npm bin -g` is on your `$PATH` |

## Development

From the repo root:

```sh
npm install          # install all workspace dependencies
npm run typecheck    # type-check all packages

# Build only mcp-server (tsup bundle)
cd packages/mcp-server
npm run build

# Inspect the publish tarball without publishing
npm pack --dry-run
```

## License

MIT
