import type { NotesError, NotesErrorCode } from "./types.js";

const NOTES_ERROR_CODES = new Set<NotesErrorCode>([
  "NOTES_PERMISSION_DENIED",
  "NOTES_APP_UNAVAILABLE",
  "SCRIPT_EXECUTION_FAILED",
  "NOTE_NOT_FOUND",
  "AMBIGUOUS_NOTE_REFERENCE",
  "FOLDER_NOT_FOUND",
  "VALIDATION_ERROR",
  "UNSUPPORTED_OPERATION",
  "TIMEOUT",
  "UNKNOWN_ERROR"
]);

export class AppleNotesAdapterError extends Error {
  readonly code: NotesErrorCode;
  readonly remediation: string | undefined;
  readonly details: unknown;

  constructor(error: NotesError) {
    super(error.message);
    this.name = "AppleNotesAdapterError";
    this.code = error.code;
    this.remediation = error.remediation;
    this.details = error.details;
  }

  toJSON(): NotesError {
    return createNotesError(
      this.code,
      this.message,
      optionalErrorOptions(this.remediation, this.details)
    );
  }
}

export function isNotesErrorCode(value: unknown): value is NotesErrorCode {
  return typeof value === "string" && NOTES_ERROR_CODES.has(value as NotesErrorCode);
}

export function createNotesError(
  code: NotesErrorCode,
  message: string,
  options: {
    remediation?: string;
    details?: unknown;
  } = {}
): NotesError {
  const error: NotesError = {
    code,
    message
  };

  if (options.remediation !== undefined) {
    error.remediation = options.remediation;
  }

  if (options.details !== undefined) {
    error.details = options.details;
  }

  return error;
}

export function toNotesError(error: unknown): NotesError {
  if (error instanceof AppleNotesAdapterError) {
    return error.toJSON();
  }

  if (isRecord(error)) {
    const code = isNotesErrorCode(error.code) ? error.code : "UNKNOWN_ERROR";
    const message =
      typeof error.message === "string"
        ? error.message
        : "Apple Notes adapter failed.";

    return createNotesError(
      code,
      message,
      optionalErrorOptions(
        typeof error.remediation === "string" ? error.remediation : undefined,
        error.details
      )
    );
  }

  return createNotesError("UNKNOWN_ERROR", "Apple Notes adapter failed.", {
    details: String(error)
  });
}

export function classifyScriptFailure(stderr: string, stdout = ""): NotesError {
  const output = `${stderr}\n${stdout}`.toLowerCase();

  if (
    output.includes("not authorized") ||
    output.includes("not authorised") ||
    output.includes("not allowed") ||
    output.includes("automation") ||
    output.includes("privacy")
  ) {
    return createNotesError(
      "NOTES_PERMISSION_DENIED",
      "macOS denied automation access to Apple Notes.",
      {
        remediation:
          "Open System Settings > Privacy & Security > Automation and allow the terminal or agent client to control Notes.",
        details: { stderr, stdout }
      }
    );
  }

  if (
    output.includes("application isn't running") ||
    output.includes("application is not running") ||
    output.includes("can't get application \"notes\"") ||
    output.includes("application notes got an error")
  ) {
    return createNotesError("NOTES_APP_UNAVAILABLE", "Apple Notes is unavailable.", {
      remediation: "Open Notes once, then retry the operation.",
      details: { stderr, stdout }
    });
  }

  return createNotesError("SCRIPT_EXECUTION_FAILED", "Apple Notes script failed.", {
    details: { stderr, stdout }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalErrorOptions(
  remediation: string | undefined,
  details: unknown
): {
  remediation?: string;
  details?: unknown;
} {
  const options: {
    remediation?: string;
    details?: unknown;
  } = {};

  if (remediation !== undefined) {
    options.remediation = remediation;
  }

  if (details !== undefined) {
    options.details = details;
  }

  return options;
}
