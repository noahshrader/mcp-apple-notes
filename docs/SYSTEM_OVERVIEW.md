# System Overview

MCP Apple Notes is a local-first Apple Notes integration designed to expose Apple Notes operations through reusable TypeScript packages instead of binding the logic directly to one assistant client.

The current repository is organized around four boundaries:

- `@mcp-apple-notes/notes-adapter`: the real implementation surface today. It runs JXA scripts through `osascript`, normalizes Apple Notes output, applies validation, and returns structured results.
- `@mcp-apple-notes/cli`: a local command-line wrapper around the adapter for diagnostics and manual testing.
- `@mcp-apple-notes/mcp-server`: the future MCP transport layer that will expose adapter operations as MCP tools.
- `@mcp-apple-notes/storage`: a future package for local metadata, cache, and run-history concerns.

## What Problem It Solves

Apple Notes is useful personal and operational data, but it is hard to access safely from local agent workflows without writing raw AppleScript or JXA each time. This project creates a reusable, typed boundary around Apple Notes so that:

- local tools can search and read notes consistently
- write operations can support dry runs before mutating user data
- errors are normalized into stable codes instead of ad hoc shell failures
- future MCP clients can call the same adapter instead of reimplementing Notes access

## Current Flow

Today, the working path is:

1. A caller uses the CLI or the adapter directly.
2. The adapter validates input and selects the appropriate JXA script.
3. The script executes through `/usr/bin/osascript` on macOS.
4. Raw Apple Notes data is converted into normalized note records.
5. The adapter returns a typed success result or a structured error.

This keeps platform-specific automation isolated in one place while the rest of the code stays plain TypeScript.

## Why The Layers Exist

The package boundaries are deliberate:

- The adapter owns Apple Notes behavior and platform quirks.
- The CLI owns argument parsing and human-readable output.
- The future MCP server will own transport concerns, tool schemas, and client interoperability.
- Future storage will own persistence and cache concerns rather than leaking them into the adapter.

That separation is what makes the codebase portable across Claude Desktop, Cursor, Copilot, custom local apps, or direct scripting.

## Current Maturity

The adapter and CLI are real and testable. The MCP server and storage packages are placeholders for the next phase. Public release work is tracked in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).