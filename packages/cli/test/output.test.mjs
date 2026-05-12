import assert from "node:assert/strict";
import test from "node:test";

import { formatJson } from "../dist/output/json.js";
import { formatText } from "../dist/output/text.js";

test("formats successful JSON output", () => {
  const output = formatJson({
    ok: true,
    command: "search",
    data: [
      {
        id: "note-1",
        title: "One"
      }
    ]
  });

  assert.match(output, /"ok": true/);
  assert.match(output, /"title": "One"/);
});

test("formats search results as readable text", () => {
  const output = formatText({
    ok: true,
    command: "search",
    data: [
      {
        id: "note-1",
        title: "One",
        folder: "Projects"
      }
    ]
  });

  assert.match(output, /1\. One/);
  assert.match(output, /folder: Projects/);
});

test("formats usage errors with help text", () => {
  const output = formatText({
    ok: false,
    error: {
      code: "USAGE_ERROR",
      message: "Command is required.",
      usage: "usage goes here"
    }
  });

  assert.match(output, /Error: Command is required\./);
  assert.match(output, /usage goes here/);
});
