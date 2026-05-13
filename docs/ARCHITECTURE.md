# Architecture

This repository uses a workspace layout so Apple Notes access, command-line tooling, and future MCP transport can evolve independently.

## Package Boundaries

### `@mcp-apple-notes/notes-adapter`

This package is the execution boundary for Apple Notes. It is responsible for:

- input validation
- dispatching JXA scripts through `osascript`
- timeout handling
- normalization of raw note records
- conversion of failures into stable error codes

Its public surface is the `AppleNotesAdapter` plus typed inputs and outputs such as `SearchNotesInput`, `NoteSummary`, `NoteContent`, and `NotesResult<T>`.

Internally, the package is split into focused layers:

- `adapter.ts`: public operations such as search, read, create, append, and diagnostics
- `scripts/jxa.ts`: generated JXA source for Apple Notes automation
- `execution/`: script runner and timeout helpers
- `normalization/`: HTML stripping and note result normalization
- `errors.ts`: structured error creation and coercion
- `diagnostics.ts`: environment and Notes reachability checks

### `@mcp-apple-notes/cli`

The CLI is a thin wrapper over the adapter. It owns:

- argument parsing
- command routing
- exit codes
- text and JSON output formatting

It does not implement Apple Notes behavior itself. That remains in the adapter.

### `@mcp-apple-notes/mcp-server`

This package exposes the adapter as MCP tools over stdio. It owns:

- MCP server startup
- tool definitions and descriptions
- JSON schemas for tool inputs
- mapping adapter results into MCP tool responses

### `@mcp-apple-notes/storage`

This package is reserved for local persistence concerns such as metadata, run history, or caches. It is intentionally deferred for v1 and kept private until there is a concrete storage model to implement.

## Execution Model

Apple Notes access is performed locally through `/usr/bin/osascript` using JavaScript for Automation (JXA). The adapter builds short JXA programs for each operation and executes them with a timeout.

This approach keeps the Apple Events boundary narrow:

- TypeScript decides what operation should run.
- JXA performs the actual Notes automation.
- normalization code reshapes the results into stable TypeScript types.

That separation matters because Apple Notes automation has platform-specific quirks, slow property access at scale, and macOS permission prompts that should not leak through every consumer.

## Data And Error Shape

All adapter operations return `NotesResult<T>`, a discriminated union:

- success: `{ ok: true, value: T }`
- failure: `{ ok: false, error: NotesError }`

Important error codes include:

- `NOTES_PERMISSION_DENIED`
- `NOTES_APP_UNAVAILABLE`
- `SCRIPT_EXECUTION_FAILED`
- `NOTE_NOT_FOUND`
- `FOLDER_NOT_FOUND`
- `TIMEOUT`
- `UNKNOWN_ERROR`

This keeps the CLI and MCP server from having to inspect raw shell output.

## Planned Next Step

The next architectural milestone is only revisiting storage once there is a concrete persistence requirement, keeping any cache or run-history concerns outside the adapter and MCP transport layers.