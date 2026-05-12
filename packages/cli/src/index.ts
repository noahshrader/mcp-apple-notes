#!/usr/bin/env node

import { createAppleNotesAdapter, notesAdapterPackage } from "@mcp-apple-notes/notes-adapter";
import { storagePackage } from "@mcp-apple-notes/storage";
import { parseCliArgs } from "./args.js";
import { executeCommand } from "./commands/execute.js";
import { formatJson } from "./output/json.js";
import { formatText } from "./output/text.js";
import type { CliIO } from "./types.js";

export const cliPackage = {
  name: "@mcp-apple-notes/cli",
  phase: "cli-mvp",
  dependencies: [
    notesAdapterPackage.name,
    storagePackage.name
  ]
} as const;

export async function main(argv: string[], io: CliIO = defaultIo): Promise<number> {
  const parsed = parseCliArgs(argv);

  if (!parsed.ok) {
    const output = parsed.format === "json"
      ? formatJson({
          ok: false,
          error: parsed.error
        })
      : formatText({
          ok: false,
          error: parsed.error
        });

    io.stderr.write(output);
    return parsed.exitCode;
  }

  if (parsed.request.command === "help") {
    io.stdout.write(formatText({ ok: true, command: "help", data: undefined }));
    return 0;
  }

  const adapter = createAppleNotesAdapter();
  const result = await executeCommand(parsed.request, adapter);
  const output = parsed.request.format === "json" ? formatJson(result) : formatText(result);
  const stream = result.ok ? io.stdout : io.stderr;
  stream.write(output);
  return result.exitCode;
}

const defaultIo: CliIO = {
  stdout: process.stdout,
  stderr: process.stderr
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
