import { spawn } from "node:child_process";
import { AppleNotesAdapterError, classifyScriptFailure, createNotesError } from "../errors.js";
import type { ScriptExecutionRequest, ScriptExecutionResult } from "../types.js";
import { normalizeTimeoutMs } from "./timeouts.js";

export async function runScript(
  request: ScriptExecutionRequest
): Promise<ScriptExecutionResult> {
  const language = request.language ?? "JavaScript";
  const timeoutMs = normalizeTimeoutMs(request.timeoutMs);

  return new Promise<ScriptExecutionResult>((resolve, reject) => {
    const child = spawn("/usr/bin/osascript", ["-l", language, "-e", request.script], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGTERM");
      reject(
        new AppleNotesAdapterError(
          createNotesError("TIMEOUT", "Apple Notes script timed out.", {
            remediation:
              "Retry with a narrower query or increase the adapter timeout.",
            details: { timeoutMs }
          })
        )
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(
        new AppleNotesAdapterError(
          createNotesError("SCRIPT_EXECUTION_FAILED", "Unable to run osascript.", {
            remediation:
              "Confirm this is running on macOS and that /usr/bin/osascript exists.",
            details: error.message
          })
        )
      );
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      const result: ScriptExecutionResult = {
        stdout,
        stderr,
        exitCode: exitCode ?? 0
      };

      if (result.exitCode !== 0) {
        reject(new AppleNotesAdapterError(classifyScriptFailure(stderr, stdout)));
        return;
      }

      resolve(result);
    });
  });
}
