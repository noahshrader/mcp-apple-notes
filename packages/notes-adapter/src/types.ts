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

export type NoteContent = NoteSummary & {
  body: string;
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
  query?: string;
  folder?: string;
  account?: string;
  limit?: number;
};

export type SearchTagsInput = {
  query?: string;
  folder?: string;
  account?: string;
  limit?: number;
  maxNotes?: number;
  timeBudgetMs?: number;
};

export type ReadNoteInput = {
  id: string;
};

export type CreateNoteInput = {
  title: string;
  body: string;
  folder?: string;
  account?: string;
  dryRun?: boolean;
};

export type AppendNoteInput = {
  id: string;
  content: string;
  separator?: string;
  dryRun?: boolean;
};

export type MutationPreview = {
  operation: "create" | "append";
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
};
