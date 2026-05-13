# MCP Apple Notes

MCP Apple Notes is a local-first Apple Notes intelligence system. It is designed around a reusable Notes adapter, a thin MCP capability layer, deferred local storage, and CLI access.

This is not a Claude-specific project. Claude Desktop is one possible consumer alongside Claude Code, GitHub Copilot, OpenAI Codex, Cursor, future MCP-compatible agents, CLI workflows, and custom local apps.

## Current Status

Phase 1 has a reusable Apple Notes adapter MVP. It includes a JXA-backed script boundary, structured errors, timeout handling, search/read/create/append methods, dry-run support for writes, diagnostics, and unit tests.

The MCP server is now implemented over stdio with search, read, create, append, and diagnostics tools. Storage is explicitly deferred for v1 because the current release does not need cache, metadata, or sync state. The CLI is implemented for local diagnostics and manual adapter operations.

Current packages:

- `@mcp-apple-notes/notes-adapter`: reusable Apple Notes service boundary.
- `@mcp-apple-notes/mcp-server`: MCP stdio server exposing Apple Notes tools.
- `@mcp-apple-notes/storage`: deferred workspace placeholder for a future metadata and cache boundary.
- `@mcp-apple-notes/cli`: local command-line boundary for diagnostics and manual adapter operations.

## Development

```sh
npm install
npm run build
npm test
```

The project uses TypeScript, Node.js ESM, npm workspaces, and Node's built-in `node:test` runner.

## CLI

After building, run the local CLI through npm:

```sh
npm run cli -- --help
npm run cli -- diagnostics
npm run cli -- search --query "project memory" --limit 5
npm run cli -- read --id "<note-id>"
npm run cli -- create-preview --title "Draft" --body "Body"
npm run cli -- create --title "Draft" --body "Body"
npm run cli -- append-preview --id "<note-id>" --content "New section"
npm run cli -- append --id "<note-id>" --content "New section"
```

Add `--json` to any command for machine-readable output.

If you install the CLI package directly, the executable name is `mcp-apple-notes-cli` so it does not collide with the MCP server executable.

Exit codes:

- `0`: success.
- `1`: adapter or Apple Notes operation failed.
- `2`: CLI usage error.
- `3`: unexpected CLI failure.

## MCP Setup

Build the server before wiring a local checkout into an MCP client:

```sh
npm install
npm run build --workspace @mcp-apple-notes/mcp-server
```

Claude Desktop config snippet:

```json
{
	"mcpServers": {
		"apple-notes": {
			"command": "node",
			"args": [
				"/absolute/path/to/mcp-apple-notes/packages/mcp-server/dist/index.js"
			]
		}
	}
}
```

Cursor config snippet:

```json
{
	"mcpServers": {
		"apple-notes": {
			"command": "node",
			"args": [
				"/absolute/path/to/mcp-apple-notes/packages/mcp-server/dist/index.js"
			]
		}
	}
}
```

After connecting the server, a minimal live smoke test is asking the client to run `search_notes` with:

```json
{
	"folder": "Notes",
	"query": "2026-05-10",
	"limit": 1
}
```

Example agent interaction:

```text
User: Search my Notes folder for 2026-05-10.
Assistant: Calling search_notes with {"folder":"Notes","query":"2026-05-10","limit":1}
Tool result: 1 note found titled "2026-05-10"
Assistant: I found one note titled 2026-05-10 in Notes. I can read it next if you want.
```

## Apple Notes Permissions

Apple Notes access uses local macOS automation through `/usr/bin/osascript`. See [macOS Permissions](./docs/permissions.md) before running integration operations against Notes.

## Architecture

Start with:

- [System Overview](./docs/SYSTEM_OVERVIEW.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Folder Structure](./docs/FOLDER_STRUCTURE.md)
- [Risks And Limitations](./docs/RISKS_AND_LIMITATIONS.md)
