import type { CliOutputResult } from "../types.js";

export function formatJson(result: CliOutputResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
