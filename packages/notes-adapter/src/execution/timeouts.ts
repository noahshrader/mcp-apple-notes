export const DEFAULT_SCRIPT_TIMEOUT_MS = 15_000;

export function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_SCRIPT_TIMEOUT_MS;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_SCRIPT_TIMEOUT_MS;
  }

  return Math.min(timeoutMs, 120_000);
}
