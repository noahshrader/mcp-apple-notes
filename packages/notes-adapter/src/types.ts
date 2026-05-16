import type { NoteBlock } from "./formatting/note-html.js";

export type NotesErrorCode =
  | "NOTES_PERMISSION_DENIED"
  | "NOTES_APP_UNAVAILABLE"
  | "SCRIPT_EXECUTION_FAILED"
  | "NOTE_NOT_FOUND"
  | "AMBIGUOUS_NOTE_REFERENCE"
  | "FOLDER_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_OPERATION"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

export type NotesError = {
  code: NotesErrorCode;
  message: string;
  remediation?: string;
  details?: unknown;
};

export type NotesResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: NotesError;
    };

export type NoteReference = {
  id: string;
  title: string;
};

export type NoteSummary = {
  id: string;
  title: string;
  folder?: string;
  account?: string;
  createdAt?: string;
  updatedAt?: string;
  excerpt?: string;
};

export type ChecklistItem = {
  /** Plain text of the checklist item, without leading markers. */
  text: string;
  /** Whether the item is checked (done). */
  done: boolean;
};

export type NoteAttachment = {
  /** ZIDENTIFIER from ICAttachment — stable UUID for this attachment. */
  identifier: string;
  /** UTI of the original file (e.g. `'public.heic'`, `'public.png'`). */
  typeUti: string;
  /**
   * Path to the largest locally-cached preview thumbnail (PNG).
   * Present when the attachment has been downloaded or a preview has been generated.
   */
  previewPath?: string;
  /**
   * Path to the full-resolution original file.
   * Only present when iCloud has downloaded the file to this machine.
   */
  mediaPath?: string;
};

export type NoteStructuredContent = {
  /**
   * Checklist / to-do items extracted from the note via protobuf parsing.
   * Requires Full Disk Access; empty array when unavailable.
   */
  checklists: ChecklistItem[];
  /**
   * Hashtags attached to this note (e.g. `#work`, `#idea`).
   * Requires Full Disk Access; empty array when unavailable.
   */
  tags: string[];
  /**
   * Attachments (images, PDFs, etc.) embedded in the note.
   * Requires Full Disk Access; empty array when unavailable.
   */
  attachments: NoteAttachment[];
};

export type NoteContent = NoteSummary & {
  body: string;
  /**
   * Structured content parsed directly from NoteStore.sqlite.
   * Present when Full Disk Access is granted; undefined otherwise.
   */
  structured?: NoteStructuredContent;
};

export type TagSummary = {
  name: string;
  count: number;
};

export type SearchTagsResult = {
  tags: TagSummary[];
  scannedNoteCount: number;
  totalNoteCount?: number;
  truncated: boolean;
};

export type RawNoteRecord = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  folder?: unknown;
  account?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  body?: unknown;
  excerpt?: unknown;
};

export type SearchNotesInput = {
  query?: string | undefined;
  folder?: string | undefined;
  account?: string | undefined;
  limit?: number | undefined;
};

export type SearchTagsInput = {
  query?: string | undefined;
  folder?: string | undefined;
  account?: string | undefined;
  limit?: number | undefined;
  maxNotes?: number | undefined;
  timeBudgetMs?: number | undefined;
};

export type ReadNoteInput = {
  id: string;
};

export type ReadFolderInput = {
  folder: string;
  account?: string | undefined;
};

export type CreateNoteInput = {
  title: string;
  body: string;
  folder?: string | undefined;
  account?: string | undefined;
  dryRun?: boolean | undefined;
};

export type AppendNoteInput = {
  id: string;
  content: string;
  separator?: string | undefined;
  dryRun?: boolean | undefined;
};

export type ReplaceNoteInput = {
  id: string;
  body: string;
  title?: string | undefined;
  dryRun?: boolean | undefined;
};

export type MutationPreview = {
  operation: "create" | "append" | "replace";
  target?: NoteReference;
  proposedTitle?: string;
  proposedBody?: string;
  warnings: string[];
};

export type CreateNoteResult = {
  dryRun: boolean;
  preview?: MutationPreview;
  note?: NoteContent;
};

export type AppendNoteResult = {
  dryRun: boolean;
  preview?: MutationPreview;
  note?: NoteContent;
};

export type ReplaceNoteResult = {
  dryRun: boolean;
  preview?: MutationPreview;
  note?: NoteContent;
};

export type NotesDiagnostics = {
  platform: string;
  osascriptAvailable: boolean;
  notesReachable: boolean;
  automationPermission: "granted" | "denied" | "unknown";
  notesCount?: number;
  message: string;
  details?: unknown;
};

export type ScriptExecutionRequest = {
  script: string;
  language?: "JavaScript" | "AppleScript";
  timeoutMs?: number;
};

export type ScriptExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type ScriptRunner = (
  request: ScriptExecutionRequest
) => Promise<ScriptExecutionResult>;

export type AppleNotesAdapterOptions = {
  runner?: ScriptRunner;
  timeoutMs?: number;
  preferSqliteFastPath?: boolean;
};
