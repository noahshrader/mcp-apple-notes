export {
  AppleNotesAdapter,
  createAppleNotesAdapter
} from "./adapter.js";
export {
  buildAppleNotesHtml
} from "./formatting/note-html.js";
export type {
  BlockquoteBlock,
  BulletListBlock,
  BodyBlock,
  ChecklistBlock,
  ChecklistItem as NoteChecklistItem,
  DashListBlock,
  HeadingBlock,
  MonospaceBlock,
  NoteBlock,
  NumberedListBlock,
  SubheadingBlock,
  TableBlock,
  TitleBlock
} from "./formatting/note-html.js";
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
export {
  extractNotePkFromId,
  getAllTagCounts,
  getFolderNotes,
  getNoteAttachments,
  getNoteHashtags,
  getNoteParsedData,
  getSqliteNote,
  isNoteStoreReadable,
  parseNoteStoreProto
} from "./sqlite/index.js";
export type {
  AppendNoteInput,
  AppendNoteResult,
  AppleNotesAdapterOptions,
  ChecklistItem,
  CreateNoteInput,
  CreateNoteResult,
  MutationPreview,
  NoteContent,
  NoteReference,
  NoteStructuredContent,
  NoteSummary,
  NotesDiagnostics,
  NotesError,
  NotesErrorCode,
  NotesResult,
  RawNoteRecord,
  ReadFolderInput,
  ReadNoteInput,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptRunner,
  SearchNotesInput,
  SearchTagsInput,
  SearchTagsResult,
  TagSummary
} from "./types.js";
