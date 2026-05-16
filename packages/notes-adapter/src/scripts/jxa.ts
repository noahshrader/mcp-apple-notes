import type {
  AppendNoteInput,
  CreateNoteInput,
  ReadFolderInput,
  ReadNoteInput,
  ReplaceNoteInput,
  SearchNotesInput,
  SearchTagsInput
} from "../types.js";

export function buildSearchNotesScript(input: SearchNotesInput): string {
  return wrapJxa("searchNotes", input);
}

export function buildSearchTagsScript(input: SearchTagsInput): string {
  return wrapJxa("searchTags", input);
}

export function buildReadNoteScript(input: ReadNoteInput): string {
  return wrapJxa("readNote", input);
}

export function buildReadFolderScript(input: ReadFolderInput): string {
  return wrapJxa("readFolder", input);
}

export function buildCreateNoteScript(input: CreateNoteInput): string {
  return wrapJxa("createNote", input);
}

export function buildAppendNoteScript(input: AppendNoteInput): string {
  return wrapJxa("appendNote", input);
}

export function buildReplaceNoteScript(input: ReplaceNoteInput): string {
  return wrapJxa("replaceNote", input);
}

export function buildDiagnosticsScript(): string {
  return wrapJxa("diagnostics", {});
}

function wrapJxa(operation: string, input: unknown): string {
  return `
const input = ${JSON.stringify(input)};
ObjC.import("Foundation");

function writeStdout(value) {
  const text = String(value) + "\\n";
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $(text).dataUsingEncoding($.NSUTF8StringEncoding)
  );
}

function safeRead(read, fallback) {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function asText(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

function dateToIso(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  try {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (_) {}
  return String(value);
}

function app() {
  const notes = Application("Notes");
  notes.includeStandardAdditions = true;
  return notes;
}

function allNotes(notes) {
  return safeRead(function () {
    return notes.notes();
  }, []);
}

function noteRecord(note, includeBody) {
  const body = includeBody ? asText(safeRead(function () { return note.body(); }, "")) : undefined;
  const folder = safeRead(function () { return note.container().name(); }, undefined);
  const account = safeRead(function () { return note.container().container().name(); }, undefined);
  const record = {
    id: asText(safeRead(function () { return note.id(); }, undefined)),
    title: asText(safeRead(function () { return note.name(); }, "Untitled")),
    folder: asText(folder),
    account: asText(account),
    createdAt: dateToIso(safeRead(function () { return note.creationDate(); }, undefined)),
    updatedAt: dateToIso(safeRead(function () { return note.modificationDate(); }, undefined))
  };

  if (includeBody) {
    record.body = body || "";
  } else if (body) {
    record.excerpt = body.slice(0, 240);
  }

  return record;
}

function textIncludes(value, query) {
  if (!query) {
    return true;
  }
  return String(value || "").toLowerCase().indexOf(query) !== -1;
}

function matchesOptional(value, expected) {
  if (!expected) {
    return true;
  }
  return String(value || "").toLowerCase() === String(expected).toLowerCase();
}

function findNoteById(notes, id) {
  try {
    const note = notes.notes.byId(id);
    // Access a property to confirm the note exists (throws if not found)
    note.id();
    return note;
  } catch (_) {
    return undefined;
  }
}

function findFolder(notes, folderName, accountName) {
  const accounts = safeRead(function () { return notes.accounts(); }, []);
  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
    const account = accounts[accountIndex];
    const currentAccountName = asText(safeRead(function () { return account.name(); }, ""));
    if (accountName && currentAccountName.toLowerCase() !== String(accountName).toLowerCase()) {
      continue;
    }

    const folders = safeRead(function () { return account.folders(); }, []);
    for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
      const folder = folders[folderIndex];
      const currentFolderName = asText(safeRead(function () { return folder.name(); }, ""));
      if (currentFolderName.toLowerCase() === String(folderName).toLowerCase()) {
        return folder;
      }
    }
  }
  return undefined;
}

function searchNotes() {
  const notes = app();
  const query = input.query ? String(input.query).toLowerCase() : "";
  const limit = input.limit ? Math.max(1, Number(input.limit)) : Infinity;
  if (input.folder) {
    return searchFolderNotes(notes, query, limit);
  }

  const results = [];
  const candidates = allNotes(notes);

  for (let index = 0; index < candidates.length && results.length < limit; index += 1) {
    const note = candidates[index];
    const record = noteRecord(note, false);

    if (!matchesOptional(record.account, input.account)) {
      continue;
    }

    if (!query || textIncludes(record.title, query)) {
      results.push(record);
      continue;
    }

    const body = asText(safeRead(function () { return note.body(); }, "")) || "";
    if (!textIncludes(body, query)) {
      continue;
    }

    if (body) {
      record.excerpt = body.slice(0, 240);
    }

    results.push(record);
  }

  return results;
}

function searchFolderNotes(notes, query, limit) {
  const folder = findFolder(notes, input.folder, input.account);
  if (!folder) {
    return [];
  }

  const folderName = asText(safeRead(function () { return folder.name(); }, input.folder));
  const accountName = asText(safeRead(function () { return folder.container().name(); }, input.account));
  const titles = safeRead(function () { return folder.notes.name(); }, []);
  const ids = safeRead(function () { return folder.notes.id(); }, []);
  const createdAt = safeRead(function () { return folder.notes.creationDate(); }, []);
  const updatedAt = safeRead(function () { return folder.notes.modificationDate(); }, []);
  const results = [];
  let folderNotes;

  function noteAt(index) {
    if (folderNotes === undefined) {
      folderNotes = safeRead(function () { return folder.notes(); }, []);
    }
    return folderNotes[index];
  }

  for (let index = 0; index < titles.length && results.length < limit; index += 1) {
    const title = asText(titles[index]) || "Untitled";
    const record = {
      id: asText(ids[index]),
      title,
      folder: folderName,
      account: accountName,
      createdAt: dateToIso(createdAt[index]),
      updatedAt: dateToIso(updatedAt[index])
    };

    if (!query || textIncludes(title, query)) {
      results.push(record);
    }
  }

  if (!query || results.length > 0) {
    return results;
  }

  for (let index = 0; index < titles.length && results.length < limit; index += 1) {
    const title = asText(titles[index]) || "Untitled";
    const record = {
      id: asText(ids[index]),
      title,
      folder: folderName,
      account: accountName,
      createdAt: dateToIso(createdAt[index]),
      updatedAt: dateToIso(updatedAt[index])
    };

    const note = noteAt(index);
    const body = asText(safeRead(function () { return note.body(); }, "")) || "";
    if (!textIncludes(body, query)) {
      continue;
    }

    if (body) {
      record.excerpt = body.slice(0, 240);
    }

    results.push(record);
  }

  return results;
}

function normalizedTagQuery() {
  if (!input.query) {
    return "";
  }
  return String(input.query).replace(/^#+/, "").toLowerCase();
}

function tagCharacter(value) {
  return /[A-Za-z0-9_-]/.test(value) || value.charCodeAt(0) > 127;
}

function extractTags(value, query, counts) {
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "#") {
      continue;
    }

    const previous = index > 0 ? text[index - 1] : "";
    if (previous && tagCharacter(previous)) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < text.length && tagCharacter(text[cursor])) {
      cursor += 1;
    }

    if (cursor === index + 1) {
      continue;
    }

    const rawName = text.slice(index + 1, cursor);
    if (query && rawName.toLowerCase().indexOf(query) === -1) {
      continue;
    }

    const tagName = "#" + rawName;
    const key = tagName.toLowerCase();
    if (!counts[key]) {
      counts[key] = {
        name: tagName,
        count: 0
      };
    }
    counts[key].count += 1;
    index = cursor - 1;
  }
}

function searchTags() {
  const notes = app();
  const query = normalizedTagQuery();
  const limit = input.limit ? Math.max(1, Number(input.limit)) : 250;
  const maxNotes = input.maxNotes ? Math.max(1, Number(input.maxNotes)) : Infinity;
  const timeBudgetMs = input.timeBudgetMs ? Math.max(1000, Number(input.timeBudgetMs)) : 25000;
  const deadline = Date.now() + timeBudgetMs;
  const counts = {};
  const candidates = input.folder ? notesForFolder(notes) : allNotes(notes);
  const totalNoteCount = candidates.length;
  let scannedNoteCount = 0;
  let truncated = false;

  for (let index = 0; index < candidates.length; index += 1) {
    if (scannedNoteCount >= maxNotes || Date.now() >= deadline) {
      truncated = true;
      break;
    }

    const note = candidates[index];
    const title = asText(safeRead(function () { return note.name(); }, "")) || "";
    extractTags(title, query, counts);

    const body = asText(safeRead(function () { return note.body(); }, "")) || "";
    extractTags(body, query, counts);
    scannedNoteCount += 1;
  }

  const tags = Object.keys(counts)
    .map(function (key) {
      return counts[key];
    })
    .sort(function (left, right) {
      const countDifference = right.count - left.count;
      if (countDifference !== 0) {
        return countDifference;
      }
      return left.name.toLowerCase() < right.name.toLowerCase() ? -1 : 1;
    })
    .slice(0, limit);

  return {
    tags,
    scannedNoteCount,
    totalNoteCount,
    truncated
  };
}

function notesForFolder(notes) {
  const folder = findFolder(notes, input.folder, input.account);
  if (!folder) {
    return [];
  }
  return safeRead(function () { return folder.notes(); }, []);
}

function readNote() {
  const notes = app();
  const note = findNoteById(notes, input.id);
  if (!note) {
    throw new Error("NOTE_NOT_FOUND");
  }
  return noteRecord(note, true);
}

function readFolder() {
  var notes = app();
  var folder = findFolder(notes, input.folder, input.account);
  if (!folder) {
    throw new Error("FOLDER_NOT_FOUND");
  }
  var folderName = asText(safeRead(function () { return folder.name(); }, input.folder));
  var accountName = asText(safeRead(function () { return folder.container().name(); }, input.account));
  var folderNotes = safeRead(function () { return folder.notes(); }, []);
  var results = [];
  for (var i = 0; i < folderNotes.length; i += 1) {
    var note = folderNotes[i];
    results.push({
      id: asText(safeRead(function () { return note.id(); }, undefined)),
      title: asText(safeRead(function () { return note.name(); }, "Untitled")),
      folder: folderName,
      account: accountName,
      createdAt: dateToIso(safeRead(function () { return note.creationDate(); }, undefined)),
      updatedAt: dateToIso(safeRead(function () { return note.modificationDate(); }, undefined)),
      body: asText(safeRead(function () { return note.plaintext(); }, "")) || ""
    });
  }
  return results;
}

function createNote() {
  const notes = app();
  // When a body is provided, let Apple Notes derive the note name from the
  // first line of body content (typically an <h1> title block). Setting both
  // name and body with an <h1> causes the title to appear twice in the note.
  // Fall back to name-only when no body is given.
  const config = input.body ? { body: input.body } : { name: input.title };
  const note = notes.Note(config);

  if (input.folder) {
    const folder = findFolder(notes, input.folder, input.account);
    if (!folder) {
      throw new Error("FOLDER_NOT_FOUND");
    }
    folder.notes.push(note);
  } else {
    notes.notes.push(note);
  }

  return noteRecord(note, true);
}

function appendNote() {
  const notes = app();
  const note = findNoteById(notes, input.id);
  if (!note) {
    throw new Error("NOTE_NOT_FOUND");
  }

  const existingBody = asText(safeRead(function () { return note.body(); }, "")) || "";
  const separator = input.separator === undefined ? "\\n\\n" : String(input.separator);
  note.body = existingBody + separator + String(input.content || "");

  return noteRecord(note, true);
}

function replaceNote() {
  const notes = app();
  const note = findNoteById(notes, input.id);
  if (!note) {
    throw new Error("NOTE_NOT_FOUND");
  }

  note.body = String(input.body || "");
  if (input.title) {
    note.name = String(input.title);
  }

  return noteRecord(note, true);
}

function diagnostics() {
  const notes = app();
  return {
    notesCount: allNotes(notes).length
  };
}

function run() {
  switch (${JSON.stringify(operation)}) {
    case "searchNotes":
      return searchNotes();
    case "searchTags":
      return searchTags();
    case "readNote":
      return readNote();
    case "readFolder":
      return readFolder();
    case "createNote":
      return createNote();
    case "appendNote":
      return appendNote();
    case "replaceNote":
      return replaceNote();
    case "diagnostics":
      return diagnostics();
    default:
      throw new Error("UNSUPPORTED_OPERATION");
  }
}

(function () {
  try {
    writeStdout(JSON.stringify({ ok: true, value: run() }));
  } catch (error) {
    writeStdout(JSON.stringify({
      ok: false,
      error: {
        message: String(error && error.message ? error.message : error),
        name: String(error && error.name ? error.name : "Error"),
        stack: String(error && error.stack ? error.stack : "")
      }
    }));
  }

  "";
})();
`;
}
