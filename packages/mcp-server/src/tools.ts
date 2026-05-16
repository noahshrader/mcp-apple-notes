import { createAppleNotesAdapter } from "@mcp-apple-notes/notes-adapter";
import {
  DEFAULT_NOTE_CACHE_DIR,
  loadNoteEntries,
  loadNoteSyncStatus,
  runNoteSync,
} from "@mcp-apple-notes/note-sync";
import type {
  AppleNotesAdapter,
  AppendNoteResult,
  CreateNoteResult,
  NoteContent,
  NoteSummary,
  NotesDiagnostics,
  NotesResult,
  SearchTagsResult
} from "@mcp-apple-notes/notes-adapter";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toNotesToolErrorResult } from "./errors.js";
import {
  appendNoteInputSchema,
  createNoteInputSchema,
  diagnosticsInputSchema,
  noteGetInputSchema,
  noteListInputSchema,
  noteStatusInputSchema,
  noteSyncInputSchema,
  readFolderInputSchema,
  readNoteInputSchema,
  searchNotesInputSchema,
  searchTagsInputSchema,
} from "./schemas.js";

export function registerAppleNotesTools(
  server: McpServer,
  adapter: AppleNotesAdapter = createAppleNotesAdapter()
): McpServer {
  registerNoteSyncTools(server);
  server.registerTool(
    "search_notes",
    {
      title: "Search Notes",
      description: "Search Apple Notes by query, folder, account, and limit.",
      inputSchema: searchNotesInputSchema
    },
    async (input) =>
      toSuccessOrError("results", await adapter.searchNotes(input))
  );

  server.registerTool(
    "search_tags",
    {
      title: "Search Tags",
      description: "Search hashtags used in Apple Notes. When Full Disk Access is granted, uses a fast direct SQLite query returning all tags with occurrence counts. Falls back to a JXA body-text scan when Full Disk Access is unavailable.",
      inputSchema: searchTagsInputSchema
    },
    async (input) => toSuccessOrError("result", await adapter.searchTags(input))
  );

  server.registerTool(
    "read_note",
    {
      title: "Read Note",
      description: "Read a single Apple Note by its opaque identifier. When Full Disk Access is granted, the response includes a `structured` field with `checklists` (each item has `text` and `done` boolean) and `tags` (hashtags attached to the note).",
      inputSchema: readNoteInputSchema
    },
    async (input) => toSuccessOrError("note", await adapter.readNote(input))
  );

  server.registerTool(
    "read_folder",
    {
      title: "Read Folder",
      description: "Read the full plain-text body of every note in an Apple Notes folder in a single call. Returns an array of notes sorted by the order Apple Notes stores them. When Full Disk Access is granted, each note includes a `structured` field with `checklists` (items with `text` and `done`) and `tags` (hashtags). Suitable for bulk analysis without per-note round-trips.",
      inputSchema: readFolderInputSchema
    },
    async (input) =>
      toSuccessOrError("notes", await adapter.readFolder(input))
  );

  server.registerTool(
    "create_note",
    {
      title: "Create Note",
      description: "Create a new Apple Note or preview the mutation with dryRun.",
      inputSchema: createNoteInputSchema
    },
    async (input) =>
      toSuccessOrError("result", await adapter.createNote(input))
  );

  server.registerTool(
    "append_note",
    {
      title: "Append Note",
      description: "Append content to an Apple Note or preview the mutation with dryRun.",
      inputSchema: appendNoteInputSchema
    },
    async (input) =>
      toSuccessOrError("result", await adapter.appendToNote(input))
  );

  server.registerTool(
    "diagnostics",
    {
      title: "Diagnostics",
      description: "Check Apple Notes reachability, permissions, and platform diagnostics.",
      inputSchema: diagnosticsInputSchema
    },
    async () => toSuccessOrError("diagnostics", await adapter.diagnostics())
  );

  return server;
}

function toSuccessOrError<T extends ToolValue>(
  key: ToolPayloadKey,
  result: NotesResult<T>
): CallToolResult {
  if (result.ok) {
    const structuredContent: ToolSuccessPayload<T> = {
      ok: true,
      [key]: result.value
    } as ToolSuccessPayload<T>;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  }

  return toNotesToolErrorResult(result.error);
}

type ToolPayloadKey = "results" | "note" | "notes" | "result" | "diagnostics";

type ToolValue =
  | NoteSummary[]
  | NoteContent[]
  | SearchTagsResult
  | NoteContent
  | CreateNoteResult
  | AppendNoteResult
  | NotesDiagnostics;

type ToolSuccessPayload<T extends ToolValue> = {
  ok: true;
} & Record<ToolPayloadKey, T | undefined>;

// ─── Note sync tools ──────────────────────────────────────────────────────────

function registerNoteSyncTools(server: McpServer): void {
  server.registerTool(
    "note_sync",
    {
      title: "Note Sync",
      description:
        "Sync Apple Notes folders into a local JSON cache. " +
        "Pass any folder names you want indexed (e.g. \"Journal\", \"2025\", \"Projects\"). " +
        "Checklists and attachments are extracted automatically. " +
        "Unchanged notes are skipped.",
      inputSchema: noteSyncInputSchema,
    },
    async (input) => {
      const cacheDir = input.cache_dir ?? DEFAULT_NOTE_CACHE_DIR;
      const folders = input.folder_names.map((name) => ({ name }));
      const result = await runNoteSync({ cacheDir, folders });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "note_list",
    {
      title: "Note List",
      description:
        "List cached note entries from a previously synced folder, optionally filtered by year. " +
        "Returns each entry's title, year, bodyPreview, checklists, and attachment paths.",
      inputSchema: noteListInputSchema,
    },
    (input) => {
      const cacheDir = input.cache_dir ?? DEFAULT_NOTE_CACHE_DIR;
      let entries = loadNoteEntries(cacheDir);
      if (input.year !== undefined) {
        entries = entries.filter((e) => e.year === input.year);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      };
    },
  );

  server.registerTool(
    "note_get",
    {
      title: "Note Get",
      description:
        "Retrieve a single cached note entry by its Apple Notes note ID " +
        "(x-coredata:// URI). Returns the full entry including all checklists and attachments.",
      inputSchema: noteGetInputSchema,
    },
    (input) => {
      const cacheDir = input.cache_dir ?? DEFAULT_NOTE_CACHE_DIR;
      const entries = loadNoteEntries(cacheDir);
      const entry = entries.find((e) => e.noteId === input.note_id);
      if (!entry) {
        return {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: "Entry not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
      };
    },
  );

  server.registerTool(
    "note_sync_status",
    {
      title: "Note Sync Status",
      description:
        "Return the status of the most recent note sync: last sync time, " +
        "entry count, error count, and any error messages.",
      inputSchema: noteStatusInputSchema,
    },
    (input) => {
      const cacheDir = input.cache_dir ?? DEFAULT_NOTE_CACHE_DIR;
      const status = loadNoteSyncStatus(cacheDir);
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
