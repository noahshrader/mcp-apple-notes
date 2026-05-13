/**
 * Extracts the first JSON line from osascript stdout.
 *
 * When JXA writes JSON via Foundation NSFileHandle, osascript may append an
 * implicit rendering of the last expression on subsequent lines. This helper
 * returns the first line that looks like JSON so callers can parse it cleanly
 * regardless of trailing output.
 */
export function firstJsonLine(stdout: string): string {
  const trimmed = stdout.trim();
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";

  if (firstLine.startsWith("{") || firstLine.startsWith("[")) {
    return firstLine;
  }

  return trimmed;
}
