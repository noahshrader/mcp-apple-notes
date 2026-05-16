import { defineConfig } from "tsup";
import { readFileSync, writeFileSync } from "node:fs";

export default defineConfig([
  // Main MCP server binary (shebang, no types, bundles workspace deps)
  {
    entry: { index: "src/index.ts" },
    outDir: "dist",
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    dts: false,
    clean: true,
    external: ["@modelcontextprotocol/sdk", "zod"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    onSuccess: async () => {
      // esbuild strips the "node:" prefix when externalizing built-in modules
      // (e.g. "node:sqlite" → "sqlite"). Classic built-ins (fs, path, os, zlib)
      // are still importable without the prefix, but node:sqlite is only
      // accessible via the prefix. Restore it in the bundle output.
      const outFile = "dist/index.js";
      const content = readFileSync(outFile, "utf8");
      const fixed = content.replace(/from "sqlite"/g, 'from "node:sqlite"');
      writeFileSync(outFile, fixed);
    },
  },
  // notes-adapter sub-path export for programmatic consumers (e.g. Electron)
  {
    entry: { "notes-adapter": "../notes-adapter/src/index.ts" },
    outDir: "dist",
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    dts: { only: false },
    tsconfig: "tsconfig.bundle.json",
    external: [],
    onSuccess: async () => {
      const outFile = "dist/notes-adapter.js";
      const content = readFileSync(outFile, "utf8");
      const fixed = content.replace(/from "sqlite"/g, 'from "node:sqlite"');
      writeFileSync(outFile, fixed);
    },
  },
  // note-sync sub-path export for programmatic consumers (e.g. Electron)
  {
    entry: { "note-sync": "../note-sync/src/index.ts" },
    outDir: "dist",
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    dts: { only: false },
    tsconfig: "tsconfig.bundle.json",
    external: [],
    onSuccess: async () => {
      const outFile = "dist/note-sync.js";
      const content = readFileSync(outFile, "utf8");
      const fixed = content.replace(/from "sqlite"/g, 'from "node:sqlite"');
      writeFileSync(outFile, fixed);
    },
  },
]);
