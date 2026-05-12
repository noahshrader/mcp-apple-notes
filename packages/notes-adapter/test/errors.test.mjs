import assert from "node:assert/strict";
import test from "node:test";

import {
  AppleNotesAdapterError,
  createNotesError,
  isNotesErrorCode,
  toNotesError
} from "../dist/index.js";

test("creates stable structured errors", () => {
  const error = createNotesError("VALIDATION_ERROR", "title is required.", {
    remediation: "Provide a title."
  });

  assert.deepEqual(error, {
    code: "VALIDATION_ERROR",
    message: "title is required.",
    remediation: "Provide a title."
  });
});

test("converts adapter errors back to plain structured errors", () => {
  const original = createNotesError("NOTE_NOT_FOUND", "Note was not found.", {
    details: { id: "missing" }
  });
  const wrapped = new AppleNotesAdapterError(original);

  assert.deepEqual(toNotesError(wrapped), original);
});

test("recognizes known adapter error codes", () => {
  assert.equal(isNotesErrorCode("NOTES_PERMISSION_DENIED"), true);
  assert.equal(isNotesErrorCode("SOMETHING_ELSE"), false);
});

test("normalizes unknown thrown values", () => {
  assert.deepEqual(toNotesError("boom"), {
    code: "UNKNOWN_ERROR",
    message: "Apple Notes adapter failed.",
    details: "boom"
  });
});
