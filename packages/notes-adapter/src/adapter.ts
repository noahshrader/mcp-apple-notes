import { createNotesError, toNotesError } from "./errors.js";
import { runScript } from "./execution/run-script.js";
import { DEFAULT_SCRIPT_TIMEOUT_MS } from "./execution/timeouts.js";
import { runAppleNotesDiagnostics } from "./diagnostics.js";
import {
  buildAppendNoteScript,
  buildCreateNoteScript,
  buildReadNoteScript,
  buildSearchNotesScript
} from "./scripts/jxa.js";
import {
  normalizeNoteContent,
  normalizeNotesSearchResults
} from "./normalization/notes.js";
import type {
  AppendNoteInput,
  AppendNoteResult,
  AppleNotesAdapterOptions,
  CreateNoteInput,
  CreateNoteResult,
  MutationPreview,
  NoteContent,
  NoteSummary,
  NotesResult,
  NotesDiagnostics,
  RawNoteRecord,
  ReadNoteInput,
  ScriptRunner,
  SearchNotesInput
} from "./types.js";

type JxaSuccess<T> = {
  ok: true;
  value: T;
};

type JxaFailure = {
  ok: false;
  error?: {
    message?: string;
    name?: string;
    stack?: string;
  };
};

export class AppleNotesAdapter {
  private readonly runner: ScriptRunner;
  private readonly timeoutMs: number;

  constructor(options: AppleNotesAdapterOptions = {}) {
    this.runner = options.runner ?? runScript;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS;
  }

  async searchNotes(input: SearchNotesInput = {}): Promise<NotesResult<NoteSummary[]>> {
    const validationError = validateSearchInput(input);
    if (validationError !== undefined) {
      return validationError;
    }

    return this.capture(async () => {
      const payload = await this.runJxa<RawNoteRecord[]>(buildSearchNotesScript(input));
      return normalizeNotesSearchResults(payload);
    });
  }

  async readNote(input: ReadNoteInput): Promise<NotesResult<NoteContent>> {
    const validationError = validateRequiredString<NoteContent>(input.id, "id");
    if (validationError !== undefined) {
      return validationError;
    }

    return this.capture(async () => {
      const payload = await this.runJxa<RawNoteRecord>(buildReadNoteScript(input));
      return normalizeNoteContent(payload);
    });
  }

  async createNote(input: CreateNoteInput): Promise<NotesResult<CreateNoteResult>> {
    const validationError =
      validateRequiredString<CreateNoteResult>(input.title, "title") ??
      validateRequiredString<CreateNoteResult>(input.body, "body");

    if (validationError !== undefined) {
      return validationError;
    }

    if (input.dryRun === true) {
      const preview: MutationPreview = {
        operation: "create",
        proposedTitle: input.title,
        proposedBody: input.body,
        warnings: mutationWarnings(input)
      };

      return {
        ok: true,
        value: {
          dryRun: true,
          preview
        }
      };
    }

    return this.capture(async () => {
      const payload = await this.runJxa<RawNoteRecord>(buildCreateNoteScript(input));
      return {
        dryRun: false,
        note: normalizeNoteContent(payload)
      };
    });
  }

  async appendToNote(input: AppendNoteInput): Promise<NotesResult<AppendNoteResult>> {
    const validationError =
      validateRequiredString<AppendNoteResult>(input.id, "id") ??
      validateRequiredString<AppendNoteResult>(input.content, "content");

    if (validationError !== undefined) {
      return validationError;
    }

    if (input.dryRun === true) {
      const existing = await this.readNote({ id: input.id });
      if (!existing.ok) {
        return existing;
      }

      const separator = input.separator ?? "\n\n";
      const proposedBody = `${existing.value.body}${separator}${input.content}`;
      const preview: MutationPreview = {
        operation: "append",
        target: {
          id: existing.value.id,
          title: existing.value.title
        },
        proposedBody,
        warnings: mutationWarnings(input)
      };

      return {
        ok: true,
        value: {
          dryRun: true,
          preview
        }
      };
    }

    return this.capture(async () => {
      const payload = await this.runJxa<RawNoteRecord>(buildAppendNoteScript(input));
      return {
        dryRun: false,
        note: normalizeNoteContent(payload)
      };
    });
  }

  async diagnostics(): Promise<NotesResult<NotesDiagnostics>> {
    return runAppleNotesDiagnostics({
      runner: this.runner,
      timeoutMs: this.timeoutMs
    });
  }

  private async runJxa<T>(script: string): Promise<T> {
    const result = await this.runner({
      script,
      language: "JavaScript",
      timeoutMs: this.timeoutMs
    });

    const parsed = parseJxaResponse<T>(result.stdout.trim());

    if (!parsed.ok) {
      throw mapJxaError(parsed);
    }

    return parsed.value;
  }

  private async capture<T>(operation: () => Promise<T>): Promise<NotesResult<T>> {
    try {
      return {
        ok: true,
        value: await operation()
      };
    } catch (error) {
      return {
        ok: false,
        error: toNotesError(error)
      };
    }
  }
}

export function createAppleNotesAdapter(
  options: AppleNotesAdapterOptions = {}
): AppleNotesAdapter {
  return new AppleNotesAdapter(options);
}

function parseJxaResponse<T>(stdout: string): JxaSuccess<T> | JxaFailure {
  try {
    return JSON.parse(stdout) as JxaSuccess<T> | JxaFailure;
  } catch (error) {
    throw createNotesError("SCRIPT_EXECUTION_FAILED", "Unable to parse Apple Notes script output.", {
      details: {
        stdout,
        parseError: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

function mapJxaError(payload: JxaFailure): ReturnType<typeof createNotesError> {
  const message = payload.error?.message ?? "Apple Notes script failed.";

  if (message === "NOTE_NOT_FOUND") {
    return createNotesError("NOTE_NOT_FOUND", "Apple Notes note was not found.");
  }

  if (message === "FOLDER_NOT_FOUND") {
    return createNotesError("FOLDER_NOT_FOUND", "Apple Notes folder was not found.");
  }

  if (message === "UNSUPPORTED_OPERATION") {
    return createNotesError("UNSUPPORTED_OPERATION", "Unsupported Apple Notes operation.");
  }

  return createNotesError("SCRIPT_EXECUTION_FAILED", "Apple Notes script failed.", {
    details: payload.error
  });
}

function validateSearchInput(
  input: SearchNotesInput
): NotesResult<NoteSummary[]> | undefined {
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return {
      ok: false,
      error: createNotesError("VALIDATION_ERROR", "Search limit must be a positive integer.")
    };
  }

  return undefined;
}

function validateRequiredString<T>(
  value: string | undefined,
  fieldName: string
): NotesResult<T> | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      error: createNotesError("VALIDATION_ERROR", `${fieldName} is required.`)
    };
  }

  return undefined;
}

function mutationWarnings(input: CreateNoteInput | AppendNoteInput): string[] {
  const warnings: string[] = [];

  if ("body" in input && input.body.trim().length === 0) {
    warnings.push("Proposed note body is empty.");
  }

  if ("content" in input && input.content.trim().length === 0) {
    warnings.push("Proposed append content is empty.");
  }

  return warnings;
}
