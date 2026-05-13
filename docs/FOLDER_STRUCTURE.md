# Folder Structure

This repository uses npm workspaces and keeps implementation boundaries at the package level.

## Top Level

```text
.
├── README.md
├── LICENSE
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FOLDER_STRUCTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── RISKS_AND_LIMITATIONS.md
│   ├── SYSTEM_OVERVIEW.md
│   └── permissions.md
├── packages/
├── storage/
├── package.json
└── tsconfig.json
```

- `README.md`: public entry point and quickstart
- `LICENSE`: repository license
- `docs/`: project documentation, release planning, architecture notes, and permissions guidance
- `packages/`: workspace packages that contain the actual code
- `storage/`: reserved top-level directory for runtime artifacts or future local data
- `package.json`: workspace root manifest
- `tsconfig.json`: TypeScript project references entry point

## Packages

```text
packages/
├── cli/
├── mcp-server/
├── notes-adapter/
└── storage/
```

### `packages/notes-adapter`

The current implementation center of the repo.

```text
packages/notes-adapter/
├── src/
│   ├── adapter.ts
│   ├── diagnostics.ts
│   ├── errors.ts
│   ├── execution/
│   ├── normalization/
│   ├── scripts/
│   ├── index.ts
│   └── types.ts
└── test/
```

- `adapter.ts`: adapter methods and orchestration
- `diagnostics.ts`: environment and Notes health checks
- `errors.ts`: shared structured error helpers
- `execution/`: script runner and timeout logic
- `normalization/`: note cleanup and output shaping
- `scripts/`: JXA script builders
- `types.ts`: shared public types
- `test/`: adapter unit tests

### `packages/cli`

```text
packages/cli/
├── src/
│   ├── args.ts
│   ├── commands/
│   ├── output/
│   ├── index.ts
│   ├── types.ts
│   └── usage.ts
└── test/
```

- `args.ts`: command-line parsing
- `commands/`: adapter-backed command execution
- `output/`: text and JSON formatters
- `index.ts`: CLI entry point
- `types.ts`: CLI-local types
- `usage.ts`: usage and validation messages
- `test/`: CLI unit tests

### `packages/mcp-server`

Currently a placeholder package for the future MCP stdio server.

```text
packages/mcp-server/
└── src/
    └── index.ts
```

### `packages/storage`

Currently a placeholder package for future local persistence concerns.

```text
packages/storage/
└── src/
    └── index.ts
```

## Supporting Docs

- `docs/SYSTEM_OVERVIEW.md`: high-level project overview
- `docs/ARCHITECTURE.md`: package boundaries and execution model
- `docs/FOLDER_STRUCTURE.md`: annotated repository map
- `docs/RISKS_AND_LIMITATIONS.md`: known constraints and caveats
- `docs/IMPLEMENTATION_PLAN.md`: release and delivery plan
- `docs/permissions.md`: macOS automation permissions guidance