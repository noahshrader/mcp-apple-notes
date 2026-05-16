import type {
  AppendNoteResult,
  CreateNoteResult,
  NoteContent,
  NoteSummary,
  NotesDiagnostics,
  NotesError,
  NotesResult,
  ReadFolderInput,
  SearchNotesInput,
  CreateNoteInput,
  AppendNoteInput
} from "@mcp-apple-notes/notes-adapter";

export type CliCommand =
  | "diagnostics"
  | "search"
  | "read"
  | "read-folder"
  | "create-preview"
  | "create"
  | "append-preview"
  | "append"
  | "help";

export type CliFormat = "text" | "json";

export type CliOptions = Record<string, string | boolean>;

export type CliRequest = {
  command: CliCommand;
  format: CliFormat;
  options: CliOptions;
};

export type CliParseResult =
  | {
      ok: true;
      request: CliRequest;
    }
  | {
      ok: false;
      format: CliFormat;
      exitCode: 2;
      error: CliUsageError;
    };

export type CliUsageError = {
  code: "USAGE_ERROR";
  message: string;
  usage: string;
};

export type CliSuccessData =
  | NotesDiagnostics
  | NoteSummary[]
  | NoteContent
  | NoteContent[]
  | CreateNoteResult
  | AppendNoteResult
  | undefined;

export type CliCommandResult =
  | {
      ok: true;
      exitCode: 0;
      command: CliCommand;
      data: CliSuccessData;
    }
  | {
      ok: false;
      exitCode: 1 | 2 | 3;
      command?: CliCommand;
      error: NotesError | CliUsageError;
    };

export type CliOutputResult =
  | {
      ok: true;
      command: CliCommand;
      data: CliSuccessData;
    }
  | {
      ok: false;
      command?: CliCommand;
      error: NotesError | CliUsageError;
    };

export type CliIO = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

export type AdapterLike = {
  diagnostics(): Promise<NotesResult<NotesDiagnostics>>;
  searchNotes(input?: SearchNotesInput): Promise<NotesResult<NoteSummary[]>>;
  readNote(input: { id: string }): Promise<NotesResult<NoteContent>>;
  readFolder(input: ReadFolderInput): Promise<NotesResult<NoteContent[]>>;
  createNote(input: CreateNoteInput): Promise<NotesResult<CreateNoteResult>>;
  appendToNote(input: AppendNoteInput): Promise<NotesResult<AppendNoteResult>>;
};
