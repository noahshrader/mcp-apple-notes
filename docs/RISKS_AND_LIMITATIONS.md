# Risks And Limitations

This project is intentionally local-first and macOS-specific. Those choices simplify Notes access, but they also create clear boundaries that should be explicit for users.

## Platform Limits

- macOS only. Apple Notes automation depends on `osascript` and JXA, so this project does not support Windows or Linux.
- Apple Notes availability depends on the local Notes app and the signed-in Apple account on that machine.
- Automation permissions are granted per host app, so a workflow may work from Terminal and fail from another client until macOS permissions are approved separately.

## Apple Events Performance

- Apple Events property access can be slow at scale.
- Naive per-note property reads can time out on large libraries.
- Folder-scoped and bulk property access patterns are strongly preferred when searching.

This means search quality is not just a query-design issue; implementation details materially affect responsiveness.

## Data Shape Limits

- The current adapter is optimized for text-oriented workflows.
- Rich text, attachments, tables, drawings, and embedded media may not round-trip cleanly.
- Note bodies may include HTML because Apple Notes exposes formatted content through its automation interface.
- Note identifiers are opaque account-scoped strings and should not be treated as portable across different iCloud contexts.

## Mutation Safety

- Create and append operations can modify real user notes.
- The adapter supports dry-run previews, but callers still need to decide when to expose or require preview-first flows.
- Future MCP clients should present write tools carefully because the underlying data is personal and often not version controlled.

## Operational Risks

- Timeouts are heuristics, not guarantees. A workflow that succeeds on one machine may need a longer timeout on another.
- Diagnostics currently depend on the same Apple automation path as normal operations, so failures may still require manual inspection.
- The MCP server package is not implemented yet, so current public functionality is limited to the adapter and CLI.

## Scope Limits

- There is no sync engine, change feed, or conflict resolution layer today.
- There is no completed local storage or caching layer yet.
- There is no guarantee that every Apple Notes structure is accessible or writable in a stable way through automation.

These are acceptable constraints for the current phase, but they should be treated as known limits rather than hidden edge cases.