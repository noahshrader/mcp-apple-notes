# MCP Apple Notes

MCP Apple Notes is a local-first Apple Notes intelligence system. It is designed around a reusable Notes adapter, a thin MCP capability layer, portable Markdown skills/workflows, local storage, and CLI access.

This is not a Claude-specific project. Claude Desktop is one possible consumer alongside Claude Code, GitHub Copilot, OpenAI Codex, Cursor, future MCP-compatible agents, CLI workflows, and custom local apps.

## Current Status

Phase 1 has a reusable Apple Notes adapter MVP. It includes a JXA-backed script boundary, structured errors, timeout handling, search/read/create/append methods, dry-run support for writes, diagnostics, and unit tests.

The MCP server, CLI commands, storage implementation, and portable skill runtime are still future phases.

Current packages:

- `@mcp-apple-notes/notes-adapter`: reusable Apple Notes service boundary.
- `@mcp-apple-notes/mcp-server`: future MCP server boundary.
- `@mcp-apple-notes/storage`: future local metadata and cache boundary.
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

Exit codes:

- `0`: success.
- `1`: adapter or Apple Notes operation failed.
- `2`: CLI usage error.
- `3`: unexpected CLI failure.

## Apple Notes Permissions

Apple Notes access uses local macOS automation through `/usr/bin/osascript`. See [macOS Permissions](./docs/permissions.md) before running integration operations against Notes.

## Architecture

Start with:

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Folder Structure](./FOLDER_STRUCTURE.md)
- [Risks And Limitations](./RISKS_AND_LIMITATIONS.md)
