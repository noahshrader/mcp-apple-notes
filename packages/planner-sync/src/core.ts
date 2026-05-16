/**
 * Planner sync core — no Electron dependencies.
 *
 * Storage layout (under the caller-supplied `cacheDir`):
 *   entries.json   — Record<noteId, PlannerEntry>
 *   status.json    — PlannerSyncStatus
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getFolderNotes } from "@mcp-apple-notes/notes-adapter";
import type { NoteContent } from "@mcp-apple-notes/notes-adapter";
import {
  extractPlannerChecklists,
  extractHabitsChecklist,
} from "./checklist.js";
import type {
  PlannerEntry,
  PlannerSyncOptions,
  PlannerSyncResult,
  PlannerSyncStatus,
} from "./types.js";

// ─── Default cache location ───────────────────────────────────────────────────

export const DEFAULT_CACHE_DIR = join(
  homedir(),
  ".mcp-apple-notes",
  "planner-cache",
);

// ─── Persistence ──────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function loadEntries(cacheDir: string): Record<string, PlannerEntry> {
  try {
    const raw = readFileSync(join(cacheDir, "entries.json"), "utf-8");
    return JSON.parse(raw) as Record<string, PlannerEntry>;
  } catch {
    return {};
  }
}

export function loadEntriesList(cacheDir: string): PlannerEntry[] {
  return Object.values(loadEntries(cacheDir));
}

function saveEntries(
  cacheDir: string,
  entries: Record<string, PlannerEntry>,
): void {
  ensureDir(cacheDir);
  writeFileSync(
    join(cacheDir, "entries.json"),
    JSON.stringify(entries, null, 2),
    "utf-8",
  );
}

export function loadStatus(cacheDir: string): PlannerSyncStatus {
  try {
    const raw = readFileSync(join(cacheDir, "status.json"), "utf-8");
    return JSON.parse(raw) as PlannerSyncStatus;
  } catch {
    return { lastSyncedAt: null, entryCount: 0, errorCount: 0, errors: [] };
  }
}

function saveStatus(cacheDir: string, status: PlannerSyncStatus): void {
  ensureDir(cacheDir);
  writeFileSync(
    join(cacheDir, "status.json"),
    JSON.stringify(status, null, 2),
    "utf-8",
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contentHash(note: NoteContent): string {
  return createHash("sha256")
    .update(note.title)
    .update(note.body)
    .update(note.updatedAt ?? "")
    .digest("hex")
    .slice(0, 32);
}

const YEAR_RE = /\b(20\d{2})\b/;

function extractYear(folderName: string, noteTitle: string): string {
  const folderMatch = folderName.match(/^(20\d{2})$/);
  if (folderMatch) return folderMatch[1]!;

  const titleMatch = noteTitle.match(YEAR_RE);
  if (titleMatch) return titleMatch[1]!;

  return String(new Date().getFullYear());
}

function normalizeEntry(note: NoteContent, folderName: string): PlannerEntry {
  const structuredChecklists = note.structured?.checklists ?? [];
  const checklists = extractPlannerChecklists(note.body, structuredChecklists);
  const habits = extractHabitsChecklist(checklists);

  const attachments = (note.structured?.attachments ?? []).map((att) => ({
    identifier: att.identifier,
    typeUti: att.typeUti,
    ...(att.mediaPath !== undefined ? { localPath: att.mediaPath } : {}),
    ...(att.previewPath !== undefined ? { thumbnailPath: att.previewPath } : {}),
    exported: att.mediaPath !== undefined || att.previewPath !== undefined,
  }));

  const bodyPreview = note.body.slice(0, 280).replace(/\s+/g, " ").trim();
  const year = extractYear(folderName, note.title);

  return {
    id: createHash("sha256").update(note.id).digest("hex").slice(0, 16),
    noteId: note.id,
    folderName,
    title: note.title,
    year,
    bodyText: note.body,
    bodyPreview,
    checklists,
    habits,
    attachments,
    contentHash: contentHash(note),
    lastSyncedAt: new Date().toISOString(),
  };
}

// ─── Sync runner ──────────────────────────────────────────────────────────────

/**
 * Read the specified Apple Notes folders, normalise each note into a
 * PlannerEntry, skip unchanged notes, and persist the result.
 */
export async function runPlannerSync(
  options: PlannerSyncOptions,
): Promise<PlannerSyncResult> {
  const { cacheDir, folders } = options;
  const startMs = Date.now();
  const stored = loadEntries(cacheDir);
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  // Deduplicate folder list
  const seen = new Set<string>();
  const unique = folders.filter((f) => {
    const key = `${f.name}:${f.titlePrefix ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const { name: folderName, titlePrefix } of unique) {
    let notes: NoteContent[] | null;
    try {
      notes = getFolderNotes(folderName);
    } catch (err) {
      const msg = `Failed to read folder "${folderName}": ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      failed++;
      continue;
    }

    if (notes === null) continue; // folder not found or FDA not granted

    const filtered = titlePrefix
      ? notes.filter((n) => n.title.startsWith(titlePrefix))
      : notes;

    for (const note of filtered) {
      try {
        const existing = stored[note.id];
        const hash = contentHash(note);
        if (existing?.contentHash === hash) {
          skipped++;
          continue;
        }
        stored[note.id] = normalizeEntry(note, folderName);
        synced++;
      } catch (err) {
        const msg = `Note "${note.title}" in "${folderName}": ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        failed++;
      }
    }
  }

  saveEntries(cacheDir, stored);

  const status: PlannerSyncStatus = {
    lastSyncedAt: new Date().toISOString(),
    entryCount: Object.keys(stored).length,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  };
  saveStatus(cacheDir, status);

  return { synced, skipped, failed, errors, durationMs: Date.now() - startMs };
}
