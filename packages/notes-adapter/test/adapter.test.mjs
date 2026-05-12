import assert from "node:assert/strict";
import test from "node:test";

import { createAppleNotesAdapter } from "../dist/index.js";

test("searchNotes can run through an injected script runner", async () => {
  const adapter = createAppleNotesAdapter({
    runner: async () => ({
      stdout: JSON.stringify({
        ok: true,
        value: [
          {
            id: "note-1",
            title: "Injected",
            body: "Found without touching Apple Notes"
          }
        ]
      }),
      stderr: "",
      exitCode: 0
    })
  });

  const result = await adapter.searchNotes({ query: "Injected" });

  assert.equal(result.ok, true);
  assert.equal(result.value[0].title, "Injected");
});

test("createNote dry-run does not invoke the script runner", async () => {
  let runnerCalled = false;
  const adapter = createAppleNotesAdapter({
    runner: async () => {
      runnerCalled = true;
      throw new Error("runner should not be called");
    }
  });

  const result = await adapter.createNote({
    title: "Preview",
    body: "Draft",
    dryRun: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.dryRun, true);
  assert.equal(result.value.preview.operation, "create");
  assert.equal(runnerCalled, false);
});

test("appendToNote dry-run reads the note before previewing the mutation", async () => {
  const adapter = createAppleNotesAdapter({
    runner: async () => ({
      stdout: JSON.stringify({
        ok: true,
        value: {
          id: "note-1",
          title: "Log",
          body: "Existing"
        }
      }),
      stderr: "",
      exitCode: 0
    })
  });

  const result = await adapter.appendToNote({
    id: "note-1",
    content: "New section",
    dryRun: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.preview.proposedBody, "Existing\n\nNew section");
  assert.deepEqual(result.value.preview.target, {
    id: "note-1",
    title: "Log"
  });
});

test("validation errors are returned instead of thrown", async () => {
  const adapter = createAppleNotesAdapter();
  const result = await adapter.readNote({ id: "" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});
