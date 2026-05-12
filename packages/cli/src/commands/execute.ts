import type {
  AppendNoteInput,
  CreateNoteInput,
  NotesError,
  SearchNotesInput
} from "@mcp-apple-notes/notes-adapter";
import type {
  AdapterLike,
  CliCommandResult,
  CliOptions,
  CliRequest,
  CliSuccessData
} from "../types.js";
import { usageError } from "../usage.js";

export async function executeCommand(
  request: CliRequest,
  adapter: AdapterLike
): Promise<CliCommandResult> {
  try {
    switch (request.command) {
      case "diagnostics":
        return fromAdapterResult(request.command, await adapter.diagnostics());
      case "search":
        return fromAdapterResult(
          request.command,
          await adapter.searchNotes(buildSearchInput(request.options))
        );
      case "read":
        return fromAdapterResult(
          request.command,
          await adapter.readNote({
            id: requiredOption(request.options, "id")
          })
        );
      case "create-preview":
        return fromAdapterResult(
          request.command,
          await adapter.createNote({
            ...buildCreateInput(request.options),
            dryRun: true
          })
        );
      case "create":
        return fromAdapterResult(
          request.command,
          await adapter.createNote({
            ...buildCreateInput(request.options),
            dryRun: false
          })
        );
      case "append-preview":
        return fromAdapterResult(
          request.command,
          await adapter.appendToNote({
            ...buildAppendInput(request.options),
            dryRun: true
          })
        );
      case "append":
        return fromAdapterResult(
          request.command,
          await adapter.appendToNote({
            ...buildAppendInput(request.options),
            dryRun: false
          })
        );
      case "help":
        return {
          ok: true,
          exitCode: 0,
          command: "help",
          data: undefined
        };
    }
  } catch (error) {
    if (error instanceof UsageFailure) {
      return {
        ok: false,
        exitCode: 2,
        command: request.command,
        error: usageError(error.message)
      };
    }

    return {
      ok: false,
      exitCode: 3,
      command: request.command,
      error: {
        code: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function fromAdapterResult(
  command: CliRequest["command"],
  result: { ok: true; value: CliSuccessData } | { ok: false; error: NotesError }
): CliCommandResult {
  if (!result.ok) {
    return {
      ok: false,
      exitCode: 1,
      command,
      error: result.error
    };
  }

  return {
    ok: true,
    exitCode: 0,
    command,
    data: result.value
  };
}

function buildSearchInput(options: CliOptions): SearchNotesInput {
  const input: SearchNotesInput = {};
  assignOptionalString(input, "query", optionString(options, "query"));
  assignOptionalString(input, "folder", optionString(options, "folder"));
  assignOptionalString(input, "account", optionString(options, "account"));

  const limit = optionString(options, "limit");
  if (limit !== undefined) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new UsageFailure("--limit must be a positive integer.");
    }
    input.limit = parsed;
  }

  return input;
}

function buildCreateInput(options: CliOptions): CreateNoteInput {
  const input: CreateNoteInput = {
    title: requiredOption(options, "title"),
    body: requiredOption(options, "body")
  };
  assignOptionalString(input, "folder", optionString(options, "folder"));
  assignOptionalString(input, "account", optionString(options, "account"));
  return input;
}

function buildAppendInput(options: CliOptions): AppendNoteInput {
  const input: AppendNoteInput = {
    id: requiredOption(options, "id"),
    content: requiredOption(options, "content")
  };
  assignOptionalString(input, "separator", optionString(options, "separator"));
  return input;
}

function requiredOption(options: CliOptions, name: string): string {
  const value = optionString(options, name);
  if (value === undefined || value.trim().length === 0) {
    throw new UsageFailure(`--${name} is required.`);
  }

  return value;
}

function optionString(options: CliOptions, name: string): string | undefined {
  const value = options[name];
  return typeof value === "string" ? value : undefined;
}

function assignOptionalString<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: string | undefined
): void {
  if (value !== undefined) {
    target[key] = value as T[keyof T];
  }
}

class UsageFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageFailure";
  }
}
