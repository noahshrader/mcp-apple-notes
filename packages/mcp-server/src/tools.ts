import { createAppleNotesAdapter } from "@mcp-apple-notes/notes-adapter";
import type {
  AppleNotesAdapter,
  AppendNoteResult,
  AppendNoteInput,
  CreateNoteResult,
  CreateNoteInput,
  NoteContent,
  NoteSummary,
  NotesDiagnostics,
  NotesError,
  NotesResult,
  SearchNotesInput
} from "@mcp-apple-notes/notes-adapter";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toNotesToolErrorResult } from "./errors.js";
import {
  appendNoteInputSchema,
  createNoteInputSchema,
  diagnosticsInputSchema,
  readNoteInputSchema,
  searchNotesInputSchema
} from "./schemas.js";

export function registerAppleNotesTools(
  server: McpServer,
  adapter: AppleNotesAdapter = createAppleNotesAdapter()
): McpServer {
  server.registerTool(
    "search_notes",
    {
      title: "Search Notes",
      description: "Search Apple Notes by query, folder, account, and limit.",
      inputSchema: searchNotesInputSchema
    },
    async (input) =>
      toSuccessOrError("results", await adapter.searchNotes(toSearchNotesInput(input)))
  );

  server.registerTool(
    "read_note",
    {
      title: "Read Note",
      description: "Read a single Apple Note by its opaque identifier.",
      inputSchema: readNoteInputSchema
    },
    async (input) => toSuccessOrError("note", await adapter.readNote(input))
  );

  server.registerTool(
    "create_note",
    {
      title: "Create Note",
      description: "Create a new Apple Note or preview the mutation with dryRun.",
      inputSchema: createNoteInputSchema
    },
    async (input) =>
      toSuccessOrError("result", await adapter.createNote(toCreateNoteInput(input)))
  );

  server.registerTool(
    "append_note",
    {
      title: "Append Note",
      description: "Append content to an Apple Note or preview the mutation with dryRun.",
      inputSchema: appendNoteInputSchema
    },
    async (input) =>
      toSuccessOrError("result", await adapter.appendToNote(toAppendNoteInput(input)))
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

type ToolPayloadKey = "results" | "note" | "result" | "diagnostics";

type ToolValue =
  | NoteSummary[]
  | NoteContent
  | CreateNoteResult
  | AppendNoteResult
  | NotesDiagnostics;

type ToolSuccessPayload<T extends ToolValue> = {
  ok: true;
} & Record<ToolPayloadKey, T | undefined>;

function toSearchNotesInput(input: {
  query?: string | undefined;
  folder?: string | undefined;
  account?: string | undefined;
  limit?: number | undefined;
}): SearchNotesInput {
  const normalized: SearchNotesInput = {};

  if (input.query !== undefined) {
    normalized.query = input.query;
  }

  if (input.folder !== undefined) {
    normalized.folder = input.folder;
  }

  if (input.account !== undefined) {
    normalized.account = input.account;
  }

  if (input.limit !== undefined) {
    normalized.limit = input.limit;
  }

  return normalized;
}

function toCreateNoteInput(input: {
  title: string;
  body: string;
  folder?: string | undefined;
  account?: string | undefined;
  dryRun?: boolean | undefined;
}): CreateNoteInput {
  const normalized: CreateNoteInput = {
    title: input.title,
    body: input.body
  };

  if (input.folder !== undefined) {
    normalized.folder = input.folder;
  }

  if (input.account !== undefined) {
    normalized.account = input.account;
  }

  if (input.dryRun !== undefined) {
    normalized.dryRun = input.dryRun;
  }

  return normalized;
}

function toAppendNoteInput(input: {
  id: string;
  content: string;
  separator?: string | undefined;
  dryRun?: boolean | undefined;
}): AppendNoteInput {
  const normalized: AppendNoteInput = {
    id: input.id,
    content: input.content
  };

  if (input.separator !== undefined) {
    normalized.separator = input.separator;
  }

  if (input.dryRun !== undefined) {
    normalized.dryRun = input.dryRun;
  }

  return normalized;
}