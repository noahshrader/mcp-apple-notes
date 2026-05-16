/**
 * Planner checklist extraction.
 *
 * Parses a note body (plain text) into PlannerChecklist sections using
 * structured checklist data from NoteStore.sqlite to resolve accurate
 * checked/unchecked state where available.
 *
 * Text-based markers are also supported as a fallback:
 *   [x] / [ ]  — markdown-style
 *   ☑ / ☐      — Unicode checkbox symbols
 *   ✓           — check mark (treated as checked)
 */

import type { PlannerChecklist, PlannerChecklistItem } from "./types.js";

/** Minimal structured checklist item from the notes adapter. */
export interface StructuredChecklistItem {
  text: string;
  done: boolean;
}

// ─── Text-based marker patterns ───────────────────────────────────────────────

const TEXT_CHECKLIST_CHECKED = /^(?:\[x\]|☑|✓)\s+(.+)/i;
const TEXT_CHECKLIST_UNCHECKED = /^(?:\[\s\]|☐)\s+(.+)/;
const MD_CHECKLIST_CHECKED = /^[-*]\s+\[x\]\s+(.+)/i;
const MD_CHECKLIST_UNCHECKED = /^[-*]\s+\[\s\]\s+(.+)/;

interface TextChecklistMatch {
  text: string;
  checked: boolean;
}

function parseTextChecklistMarker(line: string): TextChecklistMatch | null {
  let m: RegExpMatchArray | null;

  m = line.match(MD_CHECKLIST_CHECKED);
  if (m) return { text: m[1]!.trim(), checked: true };

  m = line.match(MD_CHECKLIST_UNCHECKED);
  if (m) return { text: m[1]!.trim(), checked: false };

  m = line.match(TEXT_CHECKLIST_CHECKED);
  if (m) return { text: m[1]!.trim(), checked: true };

  m = line.match(TEXT_CHECKLIST_UNCHECKED);
  if (m) return { text: m[1]!.trim(), checked: false };

  return null;
}

function isHeadingLine(line: string, structuredTexts: Set<string>): boolean {
  if (!line) return false;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (parseTextChecklistMarker(line) !== null) return false;
  if (structuredTexts.has(line)) return false;
  return line.length <= 40 && !/[.!?]$/.test(line);
}

// ─── Main extraction ──────────────────────────────────────────────────────────

/**
 * Parse a note body into checklist sections.
 *
 * @param body            Plain-text note body.
 * @param structuredItems Checklist items from NoteStore.sqlite (accurate done state).
 */
export function extractPlannerChecklists(
  body: string,
  structuredItems: StructuredChecklistItem[],
): PlannerChecklist[] {
  const structuredMap = new Map<string, boolean>();
  const structuredTexts = new Set<string>();
  for (const item of structuredItems) {
    const t = item.text.trim();
    if (t) {
      structuredMap.set(t, item.done);
      structuredTexts.add(t);
    }
  }

  const lines = body.split("\n");
  const sections: PlannerChecklist[] = [];
  let currentHeading: string | null = null;
  let currentItems: PlannerChecklistItem[] = [];

  function flush(): void {
    if (currentItems.length > 0) {
      sections.push({ heading: currentHeading, items: currentItems });
      currentItems = [];
      currentHeading = null;
    }
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const displayLine = trimmed.replace(/^#{1,6}\s+/, "");

    const textMatch = parseTextChecklistMarker(trimmed);
    if (textMatch) {
      currentItems.push({ text: textMatch.text, checked: textMatch.checked });
      continue;
    }

    if (structuredTexts.has(displayLine)) {
      currentItems.push({
        text: displayLine,
        checked: structuredMap.get(displayLine) ?? false,
      });
      continue;
    }

    flush();
    currentHeading = isHeadingLine(trimmed, structuredTexts)
      ? displayLine
      : displayLine;
  }

  flush();
  return sections;
}

/**
 * Extract checklist items from the first "Habits" section.
 * Returns an empty array when no Habits section is found.
 */
export function extractHabitsChecklist(
  checklists: PlannerChecklist[],
): PlannerChecklistItem[] {
  const section = checklists.find(
    (c) => c.heading !== null && /habits/i.test(c.heading),
  );
  return section?.items ?? [];
}
