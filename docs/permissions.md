# macOS Permissions

Apple Notes access is local and uses `/usr/bin/osascript` with JXA scripts. macOS may require explicit automation permission before a terminal, editor, or agent client can control Notes.

## First Run

Run diagnostics from the adapter, CLI, or future MCP tool. macOS may prompt for permission to control Notes.

Approve the prompt for the app that launched the command. Depending on how you run the project, that may be Terminal, iTerm, VS Code, Cursor, Claude Desktop, or another agent client.

## Manual Permission Check

Open:

```text
System Settings > Privacy & Security > Automation
```

Find the launching app and ensure Notes is enabled under it.

If access is still denied, also check:

```text
System Settings > Privacy & Security > Full Disk Access
```

Full Disk Access is not always required, but some local agent setups are more reliable when their host app has it.

## Expected Failures

The adapter maps common failures into structured errors:

- `NOTES_PERMISSION_DENIED`: macOS blocked automation access.
- `NOTES_APP_UNAVAILABLE`: Notes could not be reached.
- `SCRIPT_EXECUTION_FAILED`: osascript ran but the Notes script failed.
- `TIMEOUT`: the script took too long.

## Safety Notes

The MVP is plain text-oriented. Rich text, attachments, tables, and embedded media may not round-trip cleanly. Prefer dry-run writes and append/create workflows until the adapter has been tested against your own Notes library.
