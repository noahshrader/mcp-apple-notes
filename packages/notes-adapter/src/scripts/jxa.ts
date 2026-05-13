import type { AppendNoteInput, CreateNoteInput, ReadNoteInput, SearchNotesInput } from "../types.js";

export function buildSearchNotesScript(input: SearchNotesInput): string {
  return wrapJxa("searchNotes", input);
}

export function buildReadNoteScript(input: ReadNoteInput): string {
  return wrapJxa("readNote", input);
}

export function buildCreateNoteScript(input: CreateNoteInput): string {
  return wrapJxa("createNote", input);
}

export function buildAppendNoteScript(input: AppendNoteInput): string {
  return wrapJxa("appendNote", input);
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
  const limit = Math.max(1, Math.min(Number(input.limit || 25), 100));
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

function readNote() {
  const notes = app();
  const note = findNoteById(notes, input.id);
  if (!note) {
    throw new Error("NOTE_NOT_FOUND");
  }
  return noteRecord(note, true);
}

function createNote() {
  const notes = app();
  const note = notes.Note({
    name: input.title,
    body: input.body
  });

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
    case "readNote":
      return readNote();
    case "createNote":
      return createNote();
    case "appendNote":
      return appendNote();
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
