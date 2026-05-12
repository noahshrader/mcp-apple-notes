export {
  AppleNotesAdapter,
  createAppleNotesAdapter
} from "./adapter.js";
export {
  runAppleNotesDiagnostics
} from "./diagnostics.js";

export const notesAdapterPackage = {
  name: "@mcp-apple-notes/notes-adapter",
  phase: "adapter-mvp"
} as const;
export {
  AppleNotesAdapterError,
  createNotesError,
  isNotesErrorCode,
  toNotesError
} from "./errors.js";
export {
  normalizeNoteContent,
  normalizeNoteSummary,
  normalizeNotesSearchResults,
  stripHtml
} from "./normalization/notes.js";
export type {
  AppendNoteInput,
  AppendNoteResult,
  AppleNotesAdapterOptions,
  CreateNoteInput,
  CreateNoteResult,
  MutationPreview,
  NoteContent,
  NoteReference,
  NoteSummary,
  NotesDiagnostics,
  NotesError,
  NotesErrorCode,
  NotesResult,
  RawNoteRecord,
  ReadNoteInput,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptRunner,
  SearchNotesInput
} from "./types.js";
