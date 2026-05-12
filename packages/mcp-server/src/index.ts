import { notesAdapterPackage } from "@mcp-apple-notes/notes-adapter";
import { storagePackage } from "@mcp-apple-notes/storage";

export const mcpServerPackage = {
  name: "@mcp-apple-notes/mcp-server",
  phase: "foundation",
  dependencies: [
    notesAdapterPackage.name,
    storagePackage.name
  ]
} as const;
