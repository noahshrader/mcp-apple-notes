import assert from "node:assert/strict";
import test from "node:test";

import { parseCliArgs } from "../dist/args.js";

test("parses search command with text output by default", () => {
  const parsed = parseCliArgs([
    "search",
    "--query",
    "project memory",
    "--folder",
    "Projects",
    "--limit",
    "5"
  ]);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.command, "search");
  assert.equal(parsed.request.format, "text");
  assert.equal(parsed.request.options.query, "project memory");
  assert.equal(parsed.request.options.folder, "Projects");
  assert.equal(parsed.request.options.limit, "5");
});

test("parses global JSON flag", () => {
  const parsed = parseCliArgs(["diagnostics", "--json"]);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.command, "diagnostics");
  assert.equal(parsed.request.format, "json");
});

test("supports inline flag values", () => {
  const parsed = parseCliArgs(["read", "--id=note-1"]);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.options.id, "note-1");
});

test("returns usage errors for unknown commands", () => {
  const parsed = parseCliArgs(["unknown"]);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.exitCode, 2);
  assert.equal(parsed.error.code, "USAGE_ERROR");
});
