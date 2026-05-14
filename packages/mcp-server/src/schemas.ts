import { z } from "zod";

export const searchNotesInputSchema = {
  query: z.string().optional().describe("Text to match against note titles and bodies."),
  folder: z.string().optional().describe("Folder name to scope the search to."),
  account: z.string().optional().describe("Account name to scope the search to."),
  limit: z.number().int().positive().optional().describe("Maximum number of notes to return.")
};

export const searchTagsInputSchema = {
  query: z.string().optional().describe("Tag text to match, with or without a leading #."),
  folder: z.string().optional().describe("Folder name to scope the tag search to."),
  account: z.string().optional().describe("Account name to scope the tag search to."),
  limit: z.number().int().positive().optional().describe("Maximum number of tags to return."),
  maxNotes: z.number().int().positive().optional().describe("Maximum number of notes to scan."),
  timeBudgetMs: z.number().int().positive().optional().describe("Maximum scan time before returning partial results.")
};

export const readNoteInputSchema = {
  id: z.string().trim().min(1).describe("Opaque Apple Notes note identifier.")
};

export const readFolderInputSchema = {
  folder: z.string().trim().min(1).describe("Folder name to read all notes from."),
  account: z.string().optional().describe("Account name to scope the folder lookup to.")
};

export const createNoteInputSchema = {
  title: z.string().trim().min(1).describe("Title for the new note."),
  body: z.string().trim().min(1).describe("Body content for the new note."),
  folder: z.string().optional().describe("Folder to create the note in."),
  account: z.string().optional().describe("Account to create the note in."),
  dryRun: z.boolean().optional().describe("Return a preview without mutating Notes.")
};

export const appendNoteInputSchema = {
  id: z.string().trim().min(1).describe("Opaque Apple Notes note identifier."),
  content: z.string().trim().min(1).describe("Content to append to the note body."),
  separator: z.string().optional().describe("Separator inserted before appended content."),
  dryRun: z.boolean().optional().describe("Return a preview without mutating Notes.")
};

export const diagnosticsInputSchema = {};

export const notesToolInputSchemas = {
  searchNotes: searchNotesInputSchema,
  searchTags: searchTagsInputSchema,
  readNote: readNoteInputSchema,
  createNote: createNoteInputSchema,
  appendNote: appendNoteInputSchema,
  diagnostics: diagnosticsInputSchema
} as const;
