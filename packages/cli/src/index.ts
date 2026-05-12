#!/usr/bin/env node

import { notesAdapterPackage } from "@mcp-apple-notes/notes-adapter";
import { storagePackage } from "@mcp-apple-notes/storage";

export const cliPackage = {
  name: "@mcp-apple-notes/cli",
  phase: "foundation",
  dependencies: [
    notesAdapterPackage.name,
    storagePackage.name
  ]
} as const;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("mcp-apple-notes workspace foundation is installed.");
}
