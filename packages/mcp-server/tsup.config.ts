import { defineConfig } from "tsup";
import { readFileSync, writeFileSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  platform: "node",
  bundle: true,
  dts: false,
  clean: true,
  // Keep real npm dependencies external; bundle all workspace-local packages.
  external: ["@modelcontextprotocol/sdk", "zod"],
  banner: {
    // Emit shebang so the published bin is directly executable.
    // src/index.ts's own shebang comment is stripped by esbuild during
    // bundling, so this banner provides the single authoritative shebang.
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
});
