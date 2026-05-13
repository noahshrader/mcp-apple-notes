import { createNotesError, toNotesError } from "./errors.js";
import { firstJsonLine } from "./execution/parse-output.js";
import { runScript } from "./execution/run-script.js";
import { DEFAULT_SCRIPT_TIMEOUT_MS } from "./execution/timeouts.js";
import { buildDiagnosticsScript } from "./scripts/jxa.js";
import type {
  AppleNotesAdapterOptions,
  NotesDiagnostics,
  NotesResult,
  ScriptRunner
} from "./types.js";

type DiagnosticsPayload = {
  notesCount?: unknown;
};

export async function runAppleNotesDiagnostics(
  options: AppleNotesAdapterOptions = {}
): Promise<NotesResult<NotesDiagnostics>> {
  const runner: ScriptRunner = options.runner ?? runScript;

  if (process.platform !== "darwin") {
    return {
      ok: false,
      error: createNotesError(
        "UNSUPPORTED_OPERATION",
        "Apple Notes diagnostics require macOS.",
        {
          details: { platform: process.platform }
        }
      )
    };
  }

  try {
    const result = await runner({
      script: buildDiagnosticsScript(),
      language: "JavaScript",
      timeoutMs: options.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS
    });
    const parsed = JSON.parse(firstJsonLine(result.stdout)) as {
      ok: boolean;
      value?: DiagnosticsPayload;
      error?: unknown;
    };

    if (!parsed.ok) {
      return {
        ok: true,
        value: {
          platform: process.platform,
          osascriptAvailable: true,
          notesReachable: false,
          automationPermission: "unknown",
          message: "osascript ran, but Notes did not return diagnostics.",
          details: parsed.error
        }
      };
    }

    const notesCount =
      typeof parsed.value?.notesCount === "number" ? parsed.value.notesCount : undefined;

    const diagnostics: NotesDiagnostics = {
      platform: process.platform,
      osascriptAvailable: true,
      notesReachable: true,
      automationPermission: "granted",
      message: "Apple Notes is reachable through osascript."
    };

    if (notesCount !== undefined) {
      diagnostics.notesCount = notesCount;
    }

    return {
      ok: true,
      value: diagnostics
    };
  } catch (error) {
    const notesError = toNotesError(error);

    return {
      ok: true,
      value: {
        platform: process.platform,
        osascriptAvailable: notesError.code !== "SCRIPT_EXECUTION_FAILED",
        notesReachable: false,
        automationPermission:
          notesError.code === "NOTES_PERMISSION_DENIED" ? "denied" : "unknown",
        message: notesError.message,
        details: notesError
      }
    };
  }
}
