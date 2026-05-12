# MCP Apple Notes

MCP Apple Notes is a local-first Apple Notes intelligence system. It is designed around a reusable Notes adapter, a thin MCP capability layer, portable Markdown skills/workflows, local storage, and CLI access.

This is not a Claude-specific project. Claude Desktop is one possible consumer alongside Claude Code, GitHub Copilot, OpenAI Codex, Cursor, future MCP-compatible agents, CLI workflows, and custom local apps.

## Current Status

Phase 0 is a minimal TypeScript workspace foundation. It intentionally does not implement Apple Notes access yet.

Current packages:

- `@mcp-apple-notes/notes-adapter`: future reusable Apple Notes service boundary.
- `@mcp-apple-notes/mcp-server`: future MCP server boundary.
- `@mcp-apple-notes/storage`: future local metadata and cache boundary.
- `@mcp-apple-notes/cli`: future local command-line boundary.

## Development

```sh
npm install
npm run build
npm test
```

The project uses TypeScript, Node.js ESM, npm workspaces, and Node's built-in `node:test` runner.

## Architecture

Start with:

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Folder Structure](./FOLDER_STRUCTURE.md)
- [Risks And Limitations](./RISKS_AND_LIMITATIONS.md)
