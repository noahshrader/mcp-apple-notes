// ─── Checklist item / section ─────────────────────────────────────────────────

export interface NoteChecklistItem {
  text: string
  checked: boolean
}

export interface NoteChecklist {
  /** Section heading (e.g. "Habits", "Morning"), or null for top-level items. */
  heading: string | null
  items: NoteChecklistItem[]
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface NoteAttachment {
  identifier: string
  typeUti: string
  /** Full-resolution local path (only present when iCloud has downloaded it). */
  localPath?: string
  /** Path to the largest locally-cached preview thumbnail. */
  thumbnailPath?: string
  exported: boolean
  exportError?: string
}

// ─── Planner entry ────────────────────────────────────────────────────────────

export interface NoteEntry {
  /** Stable 16-char ID derived from noteId. */
  id: string
  /** x-coredata:// URI — stable Apple Notes reference. */
  noteId: string
  folderName: string
  title: string
  /** 4-digit year string extracted from folder name or note title. */
  year: string
  bodyText: string
  /** First 280 characters of bodyText, whitespace-normalised. */
  bodyPreview: string
  checklists: NoteChecklist[]
  /** Items from the first "Habits" checklist section. */
  habits: NoteChecklistItem[]
  attachments: NoteAttachment[]
  /** SHA-256(title + body + updatedAt) used to skip unchanged notes. */
  contentHash: string
  lastSyncedAt: string
}

// ─── Sync I/O ─────────────────────────────────────────────────────────────────

export interface NoteSyncStatus {
  lastSyncedAt: string | null
  entryCount: number
  errorCount: number
  /** Short error messages from the most recent sync run (capped at 20). */
  errors: string[]
}

export interface NoteSyncResult {
  synced: number
  skipped: number
  failed: number
  errors: string[]
  durationMs: number
}

export interface NoteSyncOptions {
  /**
   * Absolute path of the directory where `entries.json` and `status.json`
   * are persisted.  Created automatically if it does not exist.
   */
  cacheDir: string
  /**
   * Notes folders to read.  Each entry can carry an optional `titlePrefix`
   * to restrict which notes are included (useful for year-prefixed note
   * titles like "2026-01-15 Daily").
   */
  folders: Array<{ name: string; titlePrefix?: string }>
}
