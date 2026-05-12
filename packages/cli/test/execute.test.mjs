import assert from "node:assert/strict";
import test from "node:test";

import { executeCommand } from "../dist/commands/execute.js";

const fakeAdapter = {
  async diagnostics() {
    return {
      ok: true,
      value: {
        platform: "darwin",
        osascriptAvailable: true,
        notesReachable: true,
        automationPermission: "granted",
        notesCount: 7,
        message: "ok"
      }
    };
  },
  async searchNotes(input) {
    return {
      ok: true,
      value: [
        {
          id: "note-1",
          title: input.query ?? "Untitled"
        }
      ]
    };
  },
  async readNote(input) {
    return {
      ok: true,
      value: {
        id: input.id,
        title: "Read note",
        body: "Body"
      }
    };
  },
  async createNote(input) {
    return {
      ok: true,
      value: input.dryRun
        ? {
            dryRun: true,
            preview: {
              operation: "create",
              proposedTitle: input.title,
              proposedBody: input.body,
              warnings: []
            }
          }
        : {
            dryRun: false,
            note: {
              id: "created",
              title: input.title,
              body: input.body
            }
          }
    };
  },
  async appendToNote(input) {
    return {
      ok: true,
      value: input.dryRun
        ? {
            dryRun: true,
            preview: {
              operation: "append",
              target: {
                id: input.id,
                title: "Target"
              },
              proposedBody: input.content,
              warnings: []
            }
          }
        : {
            dryRun: false,
            note: {
              id: input.id,
              title: "Target",
              body: input.content
            }
          }
    };
  }
};

test("executes diagnostics through the adapter", async () => {
  const result = await executeCommand(
    {
      command: "diagnostics",
      format: "text",
      options: {}
    },
    fakeAdapter
  );

  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.notesCount, 7);
});

test("builds search input and returns adapter results", async () => {
  const result = await executeCommand(
    {
      command: "search",
      format: "json",
      options: {
        query: "topic",
        limit: "3"
      }
    },
    fakeAdapter
  );

  assert.equal(result.ok, true);
  assert.equal(result.data[0].title, "topic");
});

test("returns usage failures for missing required options", async () => {
  const result = await executeCommand(
    {
      command: "read",
      format: "text",
      options: {}
    },
    fakeAdapter
  );

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.error.code, "USAGE_ERROR");
});

test("create-preview passes dryRun to the adapter", async () => {
  const result = await executeCommand(
    {
      command: "create-preview",
      format: "text",
      options: {
        title: "Draft",
        body: "Body"
      }
    },
    fakeAdapter
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.dryRun, true);
  assert.equal(result.data.preview.operation, "create");
});
