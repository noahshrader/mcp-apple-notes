/**
 * Direct NoteStore.sqlite reader.
 *
 * Provides structured note content (checklists, tags) by reading the SQLite
 * database that Apple Notes maintains locally, bypassing JXA where possible.
 *
 * Requires Full Disk Access (TCC). All public functions return null / [] on
 * any error rather than throwing, so callers degrade gracefully.
 *
 * Uses the native node:sqlite module (Node.js 22.5+, no extra dependencies).
 */

import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseNoteStoreProto, type ChecklistItem, type ParsedNoteData } from "./proto-parser.js";
import type { NoteContent, NoteAttachment, NoteSummary, SearchNotesInput } from "../types.js";

// ─── Paths ───────────────────────────────────────────────────────────────────

const NOTE_STORE_PATH = join(
  homedir(),
  "Library/Group Containers/group.com.apple.notes/NoteStore.sqlite"
);

const NOTES_ACCOUNTS_DIR = join(
  homedir(),
  "Library/Group Containers/group.com.apple.notes/Accounts"
);

// ─── Attachment path resolution ──────────────────────────────────────────────

/** Returns all UUID-named account directories under the Notes group container. */
function listAccountPaths(): string[] {
  try {
    return readdirSync(NOTES_ACCOUNTS_DIR)
      .filter((name) => /^[0-9A-F-]{36}$/i.test(name))
      .map((name) => join(NOTES_ACCOUNTS_DIR, name));
  } catch {
    return [];
  }
}

/**
 * Given an attachment ZIDENTIFIER UUID, find the locally cached preview
 * (largest available PNG thumbnail) and full-resolution media path.
 *
 * Preview thumbnails live at:
 *   Accounts/<acct>/Previews/<identifier>-<v>-<WxH>-<i>.png
 *
 * Full-res originals live at:
 *   Accounts/<acct>/Media/<identifier>/<generation>/<filename>
 * and are only present when iCloud has downloaded the file locally.
 */
function resolveAttachmentPaths(identifier: string): Pick<NoteAttachment, "previewPath" | "mediaPath"> {
  for (const accountPath of listAccountPaths()) {
    let previewPath: string | undefined;
    try {
      const previews = readdirSync(join(accountPath, "Previews"))
        .filter((f) => f.startsWith(identifier + "-") && f.endsWith(".png"));
      if (previews.length > 0) {
        // Pick the highest-resolution preview
        previews.sort((a, b) => {
          const res = (f: string) => {
            const m = f.match(/-(\d+)x(\d+)-/);
            return m ? parseInt(m[1]!) * parseInt(m[2]!) : 0;
          };
          return res(b) - res(a);
        });
        previewPath = join(accountPath, "Previews", previews[0]!);
      }
    } catch { /* no previews directory or not accessible */ }

    let mediaPath: string | undefined;
    try {
      const gens = readdirSync(join(accountPath, "Media", identifier));
      outer: for (const gen of gens) {
        const files = readdirSync(join(accountPath, "Media", identifier, gen));
        for (const file of files) {
          mediaPath = join(accountPath, "Media", identifier, gen, file);
          break outer;
        }
      }
    } catch { /* not cached locally */ }

    if (previewPath !== undefined || mediaPath !== undefined) {
      return {
        ...(previewPath !== undefined && { previewPath }),
        ...(mediaPath !== undefined && { mediaPath }),
      };
    }
  }
  return {};
}

// ─── ID helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the integer SQLite primary key from a JXA note id.
 *
 * JXA returns ids like `x-coredata://UUID/ICNote/p6221`.
 * The trailing `/p<number>` is the ZICCLOUDSYNCINGOBJECT.Z_PK.
 */
export function extractNotePkFromId(noteId: string): number | null {
  const match = /\/p(\d+)$/.exec(noteId);
  if (!match) return null;
  const pk = parseInt(match[1]!, 10);
  return Number.isFinite(pk) ? pk : null;
}

// ─── DB open ─────────────────────────────────────────────────────────────────

function openDb(): DatabaseSync | null {
  try {
    // Open read-only via URI immutable flag so WAL journal is safe to skip
    const db = new DatabaseSync(NOTE_STORE_PATH as string);
    // Prevent any accidental writes
    db.exec("PRAGMA query_only = ON;");
    return db;
  } catch {
    return null;
  }
}

// ─── Structured note content ─────────────────────────────────────────────────

/**
 * Read and parse the ZDATA blob for a note to extract checklist items.
 *
 * @param notePk  ZICCLOUDSYNCINGOBJECT.Z_PK (from extractNotePkFromId)
 */
export function getNoteParsedData(notePk: number): ParsedNoteData | null {
  const db = openDb();
  if (!db) return null;

  try {
    const row = db
      .prepare("SELECT ZDATA FROM ZICNOTEDATA WHERE ZNOTE = ?")
      .get(notePk) as { ZDATA: Buffer | Uint8Array | null } | undefined;

    if (!row?.ZDATA) return null;

    const compressed = Buffer.isBuffer(row.ZDATA)
      ? row.ZDATA
      : Buffer.from(row.ZDATA as Uint8Array);

    const decompressed = gunzipSync(compressed);
    return parseNoteStoreProto(decompressed);
  } catch {
    return null;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

// ─── Hashtag query ───────────────────────────────────────────────────────────

type HashtagRow = { ZALTTEXT: string };
type TagCount = { tag: string; count: number };

/**
 * Get all hashtags (#word) for a single note.
 * Tags are stored as embedded objects in ZICCLOUDSYNCINGOBJECT with
 * ZALTTEXT = '#name'.
 */
export function getNoteHashtags(notePk: number): string[] {
  const db = openDb();
  if (!db) return [];

  try {
    const rows = db
      .prepare(
        `SELECT ZALTTEXT
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE ZNOTE1 = ? AND ZALTTEXT LIKE '#%'`
      )
      .all(notePk) as HashtagRow[];

    return rows.map((r) => r.ZALTTEXT);
  } catch {
    return [];
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

/**
 * Count all hashtags across the entire notes store, optionally filtered.
 * This is used to power a fast SQLite-backed searchTags implementation.
 *
 * Returns `null` when NoteStore.sqlite cannot be opened (FDA not granted).
 * Returns an empty array when the DB is readable but no matching tags exist.
 *
 * @param query  Optional case-insensitive substring to match against tag names.
 * @param limit  Maximum number of results (default 200).
 */
export function getAllTagCounts(query?: string, limit = 200): TagCount[] | null {
  const db = openDb();
  if (!db) return null;

  try {
    const rows = db
      .prepare(
        `SELECT ZALTTEXT AS tag, COUNT(*) AS cnt
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE ZALTTEXT LIKE '#%' AND ZNOTE1 IS NOT NULL
         GROUP BY ZALTTEXT
         ORDER BY cnt DESC
         LIMIT ?`
      )
      .all(limit) as Array<{ tag: string; cnt: number }>;

    const lowerQuery = query ? query.toLowerCase().replace(/^#/, "") : undefined;
    return rows
      .filter((r) => !lowerQuery || r.tag.toLowerCase().includes(lowerQuery))
      .map((r) => ({ tag: r.tag, count: Number(r.cnt) }));
  } catch {
    return [];
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

// ─── Attachment lookup ────────────────────────────────────────────────────────

type AttachmentRow = { ZIDENTIFIER: string | null; ZTYPEUTI: string | null };
type AttachmentBatchRow = AttachmentRow & { ZNOTE: number };

/**
 * Return all attachments (images, PDFs, etc.) for a single note.
 * Paths are resolved against the local Notes group container.
 * Returns an empty array when FDA is unavailable or no attachments exist.
 */
export function getNoteAttachments(notePk: number): NoteAttachment[] {
  const db = openDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        "SELECT ZIDENTIFIER, ZTYPEUTI FROM ZICCLOUDSYNCINGOBJECT WHERE Z_ENT = 5 AND ZNOTE = ?"
      )
      .all(notePk) as AttachmentRow[];
    return rowsToAttachments(rows);
  } catch {
    return [];
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

function rowsToAttachments(rows: AttachmentRow[]): NoteAttachment[] {
  return rows
    .filter((r) => r.ZIDENTIFIER !== null)
    .map((r): NoteAttachment => ({
      identifier: r.ZIDENTIFIER!,
      typeUti: r.ZTYPEUTI ?? "application/octet-stream",
      ...resolveAttachmentPaths(r.ZIDENTIFIER!),
    }));
}

/**
 * Check whether the NoteStore.sqlite is readable (i.e. Full Disk Access is
 * granted). Returns true if a test query succeeds.
 */
export function isNoteStoreReadable(): boolean {
  const db = openDb();
  if (!db) return false;
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

export type { ChecklistItem, ParsedNoteData };

// ─── Core Data epoch helpers ───────────────────────────────────────────────────

/** Core Data timestamps are seconds since 2001-01-01. Unix is seconds since 1970-01-01. */
const CORE_DATA_EPOCH_OFFSET = 978307200;

function cdateToIso(cdate: number | null): string | undefined {
  if (cdate == null) return undefined;
  return new Date((cdate + CORE_DATA_EPOCH_OFFSET) * 1000).toISOString();
}

// ─── Folder notes fast path ───────────────────────────────────────────────────

type MetaRow = { Z_UUID: string };
type FolderRow = { Z_PK: number };
type NoteRow = {
  Z_PK: number;
  ZTITLE1: string | null;
  ZCREATIONDATE1: number | null;
  ZMODIFICATIONDATE1: number | null;
};
type SearchRow = NoteRow & { ZFOLDER: number | null; folderName: string | null };
type ZdataRow = { ZNOTE: number; ZDATA: Buffer | Uint8Array | null };
type TagRow = { ZNOTE1: number; ZALTTEXT: string };

/**
 * Read all notes in a named folder directly from NoteStore.sqlite, bypassing JXA.
 *
 * Returns `null` when:
 * - Full Disk Access is not granted (DB unreadable), OR
 * - The named folder does not exist in the DB.
 *
 * Returns an empty array when the folder is found but contains no notes.
 *
 * Each returned `NoteContent` already has `structured` populated (checklists + tags).
 * The note `id` is a proper `x-coredata://` URI compatible with JXA-based mutation tools.
 */
export function getFolderNotes(folderName: string): NoteContent[] | null {
  const db = openDb();
  if (!db) return null;

  try {
    // Persistent-store UUID needed to construct x-coredata:// IDs
    const meta = db.prepare("SELECT Z_UUID FROM Z_METADATA LIMIT 1").get() as MetaRow | undefined;
    const storeUuid = meta?.Z_UUID ?? "";

    // Resolve folder Z_PK  (ICFolder = Z_ENT 15, name in ZTITLE2)
    const folderRow = db
      .prepare(
        "SELECT Z_PK FROM ZICCLOUDSYNCINGOBJECT WHERE Z_ENT = 15 AND ZTITLE2 = ? LIMIT 1"
      )
      .get(folderName) as FolderRow | undefined;

    if (!folderRow) return null; // folder not found

    // All non-deleted notes in the folder  (ICNote = Z_ENT 12)
    const noteRows = db
      .prepare(
        `SELECT Z_PK, ZTITLE1, ZCREATIONDATE1, ZMODIFICATIONDATE1
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE Z_ENT = 12
           AND ZFOLDER = ?
           AND (ZMARKEDFORDELETION = 0 OR ZMARKEDFORDELETION IS NULL)
         ORDER BY ZMODIFICATIONDATE1 DESC`
      )
      .all(folderRow.Z_PK) as NoteRow[];

    if (noteRows.length === 0) return [];

    const pks = noteRows.map((r) => r.Z_PK);
    const placeholders = pks.map(() => "?").join(",");

    // Batch-load ZDATA blobs (one row per note)
    const zdataRows = db
      .prepare(
        `SELECT ZNOTE, ZDATA FROM ZICNOTEDATA WHERE ZNOTE IN (${placeholders})`
      )
      .all(...pks) as ZdataRow[];

    const zdataByPk = new Map<number, Buffer | Uint8Array>();
    for (const r of zdataRows) {
      if (r.ZDATA) zdataByPk.set(r.ZNOTE, r.ZDATA);
    }

    // Batch-load hashtags (inline attachments whose ZALTTEXT starts with '#')
    const tagRows = db
      .prepare(
        `SELECT ZNOTE1, ZALTTEXT
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE ZNOTE1 IN (${placeholders}) AND ZALTTEXT LIKE '#%'`
      )
      .all(...pks) as TagRow[];

    const tagsByPk = new Map<number, string[]>();
    for (const r of tagRows) {
      const list = tagsByPk.get(r.ZNOTE1) ?? [];
      list.push(r.ZALTTEXT);
      tagsByPk.set(r.ZNOTE1, list);
    }

    // Batch-load attachments (ICAttachment = Z_ENT 5, FK column ZNOTE)
    const attachmentRows = db
      .prepare(
        `SELECT ZNOTE, ZIDENTIFIER, ZTYPEUTI
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE Z_ENT = 5 AND ZNOTE IN (${placeholders})`
      )
      .all(...pks) as AttachmentBatchRow[];

    const attachmentsByPk = new Map<number, NoteAttachment[]>();
    for (const r of attachmentRows) {
      if (r.ZIDENTIFIER === null) continue;
      const attachment: NoteAttachment = {
        identifier: r.ZIDENTIFIER,
        typeUti: r.ZTYPEUTI ?? "application/octet-stream",
        ...resolveAttachmentPaths(r.ZIDENTIFIER),
      };
      const list = attachmentsByPk.get(r.ZNOTE) ?? [];
      list.push(attachment);
      attachmentsByPk.set(r.ZNOTE, list);
    }

    return noteRows.map((nr): NoteContent => {
      const id = `x-coredata://${storeUuid}/ICNote/p${nr.Z_PK}`;

      let body = "";
      let checklists: ChecklistItem[] = [];
      const compressed = zdataByPk.get(nr.Z_PK);
      if (compressed) {
        try {
          const buf = Buffer.isBuffer(compressed)
            ? compressed
            : Buffer.from(compressed as Uint8Array);
          const parsed = parseNoteStoreProto(gunzipSync(buf));
          body = parsed.text;
          checklists = parsed.checklists;
        } catch { /* leave body empty */ }
      }

      const tags = tagsByPk.get(nr.Z_PK) ?? [];
      const attachments = attachmentsByPk.get(nr.Z_PK) ?? [];

      return {
        id,
        title: nr.ZTITLE1 ?? "(Untitled)",
        folder: folderName,
        ...(cdateToIso(nr.ZCREATIONDATE1) !== undefined && { createdAt: cdateToIso(nr.ZCREATIONDATE1)! }),
        ...(cdateToIso(nr.ZMODIFICATIONDATE1) !== undefined && { updatedAt: cdateToIso(nr.ZMODIFICATIONDATE1)! }),
        body,
        structured: { checklists, tags, attachments }
      };
    });
  } catch {
    return null;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

/**
 * Search notes directly from NoteStore.sqlite.
 *
 * This avoids JXA for the common case and is dramatically faster on large
 * libraries. We currently support:
 * - global searches with no account filter
 * - folder-scoped searches when only `folder` is provided
 *
 * Returns `null` when the DB is unavailable or when the query shape requires a
 * fallback to JXA (for example, account-scoped searches).
 */
export function searchSqliteNotes(input: SearchNotesInput = {}): NoteSummary[] | null {
  if (input.account) {
    return null;
  }

  if (input.folder) {
    const notes = getFolderNotes(input.folder);
    if (notes === null) return null;
    return filterFolderNotes(notes, input.query, input.limit);
  }

  const db = openDb();
  if (!db) return null;

  try {
    const meta = db.prepare("SELECT Z_UUID FROM Z_METADATA LIMIT 1").get() as MetaRow | undefined;
    const storeUuid = meta?.Z_UUID ?? "";
    const query = (input.query ?? "").trim().toLowerCase();
    const limit = clampSearchLimit(input.limit);
    const titleLike = `%${escapeLike(query)}%`;

    const titleRows = db
      .prepare(
        `SELECT
           n.Z_PK,
           n.ZTITLE1,
           n.ZCREATIONDATE1,
           n.ZMODIFICATIONDATE1,
           n.ZFOLDER,
           f.ZTITLE2 AS folderName
         FROM ZICCLOUDSYNCINGOBJECT n
         LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON f.Z_PK = n.ZFOLDER
         WHERE n.Z_ENT = 12
           AND (n.ZMARKEDFORDELETION = 0 OR n.ZMARKEDFORDELETION IS NULL)
           AND (? = '' OR LOWER(COALESCE(n.ZTITLE1, '')) LIKE ? ESCAPE '\\')
         ORDER BY n.ZMODIFICATIONDATE1 DESC
         LIMIT ?`
      )
      .all(query, titleLike, limit) as SearchRow[];

    const results = new Map<number, NoteSummary>();
    for (const row of titleRows) {
      results.set(row.Z_PK, searchSummaryFromRow(row, storeUuid));
    }

    if (!query || results.size >= limit) {
      return Array.from(results.values()).slice(0, limit);
    }

    const bodyScanLimit = Math.max(limit * 30, 500);
    const candidateRows = db
      .prepare(
        `SELECT
           n.Z_PK,
           n.ZTITLE1,
           n.ZCREATIONDATE1,
           n.ZMODIFICATIONDATE1,
           n.ZFOLDER,
           f.ZTITLE2 AS folderName
         FROM ZICCLOUDSYNCINGOBJECT n
         LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON f.Z_PK = n.ZFOLDER
         WHERE n.Z_ENT = 12
           AND (n.ZMARKEDFORDELETION = 0 OR n.ZMARKEDFORDELETION IS NULL)
         ORDER BY n.ZMODIFICATIONDATE1 DESC
         LIMIT ?`
      )
      .all(bodyScanLimit) as SearchRow[];

    const unmatchedRows = candidateRows.filter((row) => !results.has(row.Z_PK));
    if (unmatchedRows.length === 0) {
      return Array.from(results.values()).slice(0, limit);
    }

    const pks = unmatchedRows.map((row) => row.Z_PK);
    const placeholders = pks.map(() => "?").join(",");
    const zdataRows = db
      .prepare(`SELECT ZNOTE, ZDATA FROM ZICNOTEDATA WHERE ZNOTE IN (${placeholders})`)
      .all(...pks) as ZdataRow[];

    const zdataByPk = new Map<number, Buffer | Uint8Array>();
    for (const row of zdataRows) {
      if (row.ZDATA) zdataByPk.set(row.ZNOTE, row.ZDATA);
    }

    for (const row of unmatchedRows) {
      if (results.size >= limit) break;
      const body = parsePlaintext(zdataByPk.get(row.Z_PK));
      if (!body || !body.toLowerCase().includes(query)) {
        continue;
      }

      results.set(row.Z_PK, {
        ...searchSummaryFromRow(row, storeUuid),
        excerpt: buildExcerpt(body),
      });
    }

    return Array.from(results.values()).slice(0, limit);
  } catch {
    return null;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

// ─── Single-note fast path ────────────────────────────────────────────────────

type SingleNoteRow = NoteRow & { ZFOLDER: number | null };
type FolderNameRow = { ZTITLE2: string | null };
type SingleTagRow = { ZALTTEXT: string };

/**
 * Read one note by its SQLite Z_PK directly from NoteStore.sqlite.
 *
 * Used by `readNote()` as a fast path when Full Disk Access is granted,
 * avoiding a round-trip through JXA/AppleScript entirely.
 *
 * Returns `null` when:
 * - Full Disk Access is not granted (DB unreadable), OR
 * - No note with the given Z_PK exists.
 */
export function getSqliteNote(notePk: number): NoteContent | null {
  const db = openDb();
  if (!db) return null;

  try {
    const meta = db.prepare("SELECT Z_UUID FROM Z_METADATA LIMIT 1").get() as MetaRow | undefined;
    const storeUuid = meta?.Z_UUID ?? "";

    const nr = db
      .prepare(
        `SELECT Z_PK, ZTITLE1, ZCREATIONDATE1, ZMODIFICATIONDATE1, ZFOLDER
         FROM ZICCLOUDSYNCINGOBJECT
         WHERE Z_ENT = 12 AND Z_PK = ?`
      )
      .get(notePk) as SingleNoteRow | undefined;

    if (!nr) return null;

    // Resolve folder name
    let folderName: string | undefined;
    if (nr.ZFOLDER != null) {
      const folder = db
        .prepare("SELECT ZTITLE2 FROM ZICCLOUDSYNCINGOBJECT WHERE Z_PK = ?")
        .get(nr.ZFOLDER) as FolderNameRow | undefined;
      if (folder?.ZTITLE2) folderName = folder.ZTITLE2;
    }

    // Parse ZDATA blob
    let body = "";
    let checklists: ChecklistItem[] = [];
    const zdataRow = db
      .prepare("SELECT ZDATA FROM ZICNOTEDATA WHERE ZNOTE = ?")
      .get(notePk) as { ZDATA: Buffer | Uint8Array | null } | undefined;

    if (zdataRow?.ZDATA) {
      try {
        const buf = Buffer.isBuffer(zdataRow.ZDATA)
          ? zdataRow.ZDATA
          : Buffer.from(zdataRow.ZDATA as Uint8Array);
        const parsed = parseNoteStoreProto(gunzipSync(buf));
        body = parsed.text;
        checklists = parsed.checklists;
      } catch { /* leave empty */ }
    }

    // Tags
    const tagRows = db
      .prepare(
        "SELECT ZALTTEXT FROM ZICCLOUDSYNCINGOBJECT WHERE ZNOTE1 = ? AND ZALTTEXT LIKE '#%'"
      )
      .all(notePk) as SingleTagRow[];
    const tags = tagRows.map((r) => r.ZALTTEXT);

    // Attachments
    const attachmentRows = db
      .prepare(
        "SELECT ZIDENTIFIER, ZTYPEUTI FROM ZICCLOUDSYNCINGOBJECT WHERE Z_ENT = 5 AND ZNOTE = ?"
      )
      .all(notePk) as AttachmentRow[];
    const attachments = rowsToAttachments(attachmentRows);

    return {
      id: `x-coredata://${storeUuid}/ICNote/p${notePk}`,
      title: nr.ZTITLE1 ?? "(Untitled)",
      ...(folderName !== undefined && { folder: folderName }),
      ...(cdateToIso(nr.ZCREATIONDATE1) !== undefined && { createdAt: cdateToIso(nr.ZCREATIONDATE1)! }),
      ...(cdateToIso(nr.ZMODIFICATIONDATE1) !== undefined && { updatedAt: cdateToIso(nr.ZMODIFICATIONDATE1)! }),
      body,
      structured: { checklists, tags, attachments }
    };
  } catch {
    return null;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

function filterFolderNotes(
  notes: NoteContent[],
  rawQuery: string | undefined,
  rawLimit: number | undefined,
): NoteSummary[] {
  const query = (rawQuery ?? "").trim().toLowerCase();
  const limit = clampSearchLimit(rawLimit);
  const filtered = query
    ? notes.filter((note) =>
      note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query))
    : notes;

  return filtered.slice(0, limit).map((note) => ({
    id: note.id,
    title: note.title,
    ...(note.folder ? { folder: note.folder } : {}),
    ...(note.createdAt ? { createdAt: note.createdAt } : {}),
    ...(note.updatedAt ? { updatedAt: note.updatedAt } : {}),
    ...(note.body ? { excerpt: buildExcerpt(note.body) } : {}),
  }));
}

function searchSummaryFromRow(row: SearchRow, storeUuid: string): NoteSummary {
  return {
    id: `x-coredata://${storeUuid}/ICNote/p${row.Z_PK}`,
    title: row.ZTITLE1 ?? "(Untitled)",
    ...(row.folderName ? { folder: row.folderName } : {}),
    ...(cdateToIso(row.ZCREATIONDATE1) !== undefined && { createdAt: cdateToIso(row.ZCREATIONDATE1)! }),
    ...(cdateToIso(row.ZMODIFICATIONDATE1) !== undefined && { updatedAt: cdateToIso(row.ZMODIFICATIONDATE1)! }),
  };
}

function parsePlaintext(compressed: Buffer | Uint8Array | undefined): string {
  if (!compressed) return "";

  try {
    const buf = Buffer.isBuffer(compressed)
      ? compressed
      : Buffer.from(compressed);
    return parseNoteStoreProto(gunzipSync(buf)).text;
  } catch {
    return "";
  }
}

function buildExcerpt(body: string, maxLength = 240): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function clampSearchLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return 25;
  }
  return Math.min(Math.floor(limit), 100);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
