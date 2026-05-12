import { AppleNotesAdapterError, createNotesError } from "../errors.js";
import type { NoteContent, NoteSummary, RawNoteRecord } from "../types.js";

const EXCERPT_LENGTH = 240;

export function normalizeNotesSearchResults(raw: unknown): NoteSummary[] {
  if (!Array.isArray(raw)) {
    throw new AppleNotesAdapterError(
      createNotesError("SCRIPT_EXECUTION_FAILED", "Expected Apple Notes search to return an array.", {
        details: raw
      })
    );
  }

  return raw.map((record) => normalizeNoteSummary(record));
}

export function normalizeNoteSummary(raw: unknown): NoteSummary {
  const record = asRawNoteRecord(raw);
  const id = requiredString(record.id, "id");
  const title = stringValue(record.title) ?? stringValue(record.name) ?? "Untitled";
  const body = stringValue(record.body);
  const explicitExcerpt = stringValue(record.excerpt);

  const summary: NoteSummary = {
    id,
    title
  };

  assignOptionalString(summary, "folder", record.folder);
  assignOptionalString(summary, "account", record.account);
  assignOptionalString(summary, "createdAt", record.createdAt);
  assignOptionalString(summary, "updatedAt", record.updatedAt);

  const excerpt = explicitExcerpt ?? (body === undefined ? undefined : buildExcerpt(body));
  if (excerpt !== undefined) {
    summary.excerpt = excerpt;
  }

  return summary;
}

export function normalizeNoteContent(raw: unknown): NoteContent {
  const record = asRawNoteRecord(raw);
  const summary = normalizeNoteSummary(record);

  return {
    ...summary,
    body: stringValue(record.body) ?? ""
  };
}

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function buildExcerpt(body: string): string | undefined {
  const text = stripHtml(body);

  if (text.length === 0) {
    return undefined;
  }

  if (text.length <= EXCERPT_LENGTH) {
    return text;
  }

  return `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}...`;
}

function asRawNoteRecord(raw: unknown): RawNoteRecord {
  if (typeof raw !== "object" || raw === null) {
    throw new AppleNotesAdapterError(
      createNotesError("SCRIPT_EXECUTION_FAILED", "Expected Apple Notes record to be an object.", {
        details: raw
      })
    );
  }

  return raw as RawNoteRecord;
}

function requiredString(value: unknown, fieldName: string): string {
  const normalized = stringValue(value);

  if (normalized === undefined || normalized.length === 0) {
    throw new AppleNotesAdapterError(
      createNotesError("SCRIPT_EXECUTION_FAILED", `Apple Notes record is missing ${fieldName}.`, {
        details: { fieldName }
      })
    );
  }

  return normalized;
}

function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function assignOptionalString<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: unknown
): void {
  const normalized = stringValue(value);

  if (normalized !== undefined && normalized.length > 0) {
    target[key] = normalized as T[keyof T];
  }
}
