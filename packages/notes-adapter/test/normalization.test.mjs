import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeNoteContent,
  normalizeNoteSummary,
  normalizeNotesSearchResults,
  stripHtml
} from "../dist/index.js";

test("normalizes a note summary from raw Apple Notes output", () => {
  const summary = normalizeNoteSummary({
    id: "x-coredata://note/1",
    name: "Project Log",
    folder: "Projects",
    account: "iCloud",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z",
    body: "<div>First line<br>Second line</div>"
  });

  assert.deepEqual(summary, {
    id: "x-coredata://note/1",
    title: "Project Log",
    folder: "Projects",
    account: "iCloud",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z",
    excerpt: "First line\nSecond line"
  });
});

test("normalizes note content with an empty body fallback", () => {
  const content = normalizeNoteContent({
    id: "note-2",
    title: "Empty"
  });

  assert.equal(content.id, "note-2");
  assert.equal(content.title, "Empty");
  assert.equal(content.body, "");
});

test("normalizes arrays returned by search", () => {
  const results = normalizeNotesSearchResults([
    {
      id: "note-1",
      title: "One"
    },
    {
      id: "note-2",
      title: "Two"
    }
  ]);

  assert.equal(results.length, 2);
  assert.equal(results[0].title, "One");
  assert.equal(results[1].id, "note-2");
});

test("strips simple Notes HTML into readable plain text", () => {
  assert.equal(
    stripHtml("<p>Research &amp; notes</p><p>Next&nbsp;step</p>"),
    "Research & notes\nNext step"
  );
});

test("throws a structured error when a record is missing an id", () => {
  assert.throws(
    () => normalizeNoteSummary({ title: "No id" }),
    (error) => error.code === "SCRIPT_EXECUTION_FAILED"
  );
});
