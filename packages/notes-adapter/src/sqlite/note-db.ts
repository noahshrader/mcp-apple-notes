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
import { homedir } from "node:os";
import { join } from "node:path";
import { parseNoteStoreProto, type ChecklistItem, type ParsedNoteData } from "./proto-parser.js";
import type { NoteContent } from "../types.js";

// ─── Path ────────────────────────────────────────────────────────────────────

const NOTE_STORE_PATH = join(
  homedir(),
  "Library/Group Containers/group.com.apple.notes/NoteStore.sqlite"
);

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

      return {
        id,
        title: nr.ZTITLE1 ?? "(Untitled)",
        folder: folderName,
        ...(cdateToIso(nr.ZCREATIONDATE1) !== undefined && { createdAt: cdateToIso(nr.ZCREATIONDATE1)! }),
        ...(cdateToIso(nr.ZMODIFICATIONDATE1) !== undefined && { updatedAt: cdateToIso(nr.ZMODIFICATIONDATE1)! }),
        body,
        structured: { checklists, tags }
      };
    });
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

    return {
      id: `x-coredata://${storeUuid}/ICNote/p${notePk}`,
      title: nr.ZTITLE1 ?? "(Untitled)",
      ...(folderName !== undefined && { folder: folderName }),
      ...(cdateToIso(nr.ZCREATIONDATE1) !== undefined && { createdAt: cdateToIso(nr.ZCREATIONDATE1)! }),
      ...(cdateToIso(nr.ZMODIFICATIONDATE1) !== undefined && { updatedAt: cdateToIso(nr.ZMODIFICATIONDATE1)! }),
      body,
      structured: { checklists, tags }
    };
  } catch {
    return null;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}
