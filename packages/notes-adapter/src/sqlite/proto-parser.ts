/**
 * Minimal zero-dependency protobuf parser for Apple Notes NoteStoreProto.
 *
 * Structure (from threeplanetssoftware/apple_cloud_notes_parser):
 *   NoteStoreProto { document = 2 }
 *   Document      { version = 2, note = 3 }
 *   Note          { note_text = 2, attribute_run = 5 }
 *   AttributeRun  { length = 1, paragraph_style = 2 }
 *   ParagraphStyle{ style_type = 1, checklist = 5 }
 *   Checklist     { uuid = 1, done = 2 }
 *
 * Style type constants (AppleNote.rb):
 *   -1  = default, 0 = title, 1 = heading, 2 = subheading
 *   4   = monospaced, 100 = dotted list, 101 = dashed list
 *   102 = numbered list, 103 = checkbox
 */

export type ChecklistItem = {
  text: string;
  done: boolean;
};

export type ParsedNoteData = {
  text: string;
  checklists: ChecklistItem[];
};

// ─── Varint decoder ──────────────────────────────────────────────────────────

function readVarint(buf: Uint8Array, pos: number): [value: number, nextPos: number] {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++]!;
    result |= (b & 0x7f) << shift;
    shift += 7;
    if (!(b & 0x80)) return [result, pos];
  }
  throw new RangeError("proto-parser: truncated varint");
}

// ─── Field iterator ──────────────────────────────────────────────────────────

type WireType0 = { field: number; wireType: 0; value: number };
type WireType2 = { field: number; wireType: 2; value: Uint8Array };
type ProtoField = WireType0 | WireType2;

function* iterFields(buf: Uint8Array, start = 0, end = buf.length): Generator<ProtoField> {
  let pos = start;
  while (pos < end) {
    let tag: number;
    [tag, pos] = readVarint(buf, pos);
    const field = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      let value: number;
      [value, pos] = readVarint(buf, pos);
      yield { field, wireType: 0, value };
    } else if (wireType === 2) {
      let length: number;
      [length, pos] = readVarint(buf, pos);
      yield { field, wireType: 2, value: buf.subarray(pos, pos + length) };
      pos += length;
    } else if (wireType === 1) {
      pos += 8; // 64-bit fixed
    } else if (wireType === 5) {
      pos += 4; // 32-bit fixed
    } else {
      return; // unknown wire type — stop parsing this message
    }
  }
}

function firstBytesField(buf: Uint8Array, fieldNum: number): Uint8Array | null {
  for (const f of iterFields(buf)) {
    if (f.field === fieldNum && f.wireType === 2) return f.value;
  }
  return null;
}

// ─── Note parser ─────────────────────────────────────────────────────────────

const STYLE_CHECKBOX = 103;
const decoder = new TextDecoder("utf-8", { fatal: false });

type RunInfo = {
  length: number;
  styleType: number;
  checklistDone: boolean | null;
};

function parseAttributeRun(runBuf: Uint8Array): RunInfo {
  let length = 0;
  let styleType = -1;
  let checklistDone: boolean | null = null;

  for (const rf of iterFields(runBuf)) {
    if (rf.field === 1 && rf.wireType === 0) {
      length = rf.value;
    } else if (rf.field === 2 && rf.wireType === 2) {
      // ParagraphStyle
      for (const sf of iterFields(rf.value)) {
        if (sf.field === 1 && sf.wireType === 0) {
          styleType = sf.value;
        } else if (sf.field === 5 && sf.wireType === 2) {
          // Checklist sub-message: field 2 = done
          for (const cf of iterFields(sf.value)) {
            if (cf.field === 2 && cf.wireType === 0) {
              checklistDone = cf.value === 1;
            }
          }
        }
      }
    }
  }

  return { length, styleType, checklistDone };
}

/**
 * Parse a gzip-decompressed NoteStoreProto buffer into structured note data.
 * Returns empty defaults if the buffer cannot be parsed.
 */
export function parseNoteStoreProto(buf: Uint8Array): ParsedNoteData {
  try {
    // NoteStoreProto → Document (field 2)
    const documentBuf = firstBytesField(buf, 2);
    if (!documentBuf) return { text: "", checklists: [] };

    // Document → Note (field 3)
    const noteBuf = firstBytesField(documentBuf, 3);
    if (!noteBuf) return { text: "", checklists: [] };

    // Collect note_text (field 2) and all attribute_runs (field 5)
    let noteText = "";
    const runs: RunInfo[] = [];

    for (const f of iterFields(noteBuf)) {
      if (f.field === 2 && f.wireType === 2) {
        noteText = decoder.decode(f.value);
      } else if (f.field === 5 && f.wireType === 2) {
        runs.push(parseAttributeRun(f.value));
      }
    }

    // Walk runs to build checklist items, flushing on newlines
    const checklists: ChecklistItem[] = [];
    let charPos = 0;
    let pendingText = "";
    let pendingDone: boolean | null = null;

    for (const run of runs) {
      const runText = noteText.slice(charPos, charPos + run.length);
      charPos += run.length;

      if (run.styleType === STYLE_CHECKBOX) {
        const done = run.checklistDone === true;

        // If done state changed mid-accumulation (shouldn't happen but be safe)
        if (pendingDone !== null && pendingDone !== done) {
          const trimmed = pendingText.replace(/\n+$/, "");
          if (trimmed) checklists.push({ text: trimmed, done: pendingDone });
          pendingText = "";
          pendingDone = null;
        }

        if (pendingDone === null) pendingDone = done;
        pendingText += runText;

        // Flush complete lines (checkbox items end with \n)
        const nlIdx = pendingText.indexOf("\n");
        if (nlIdx !== -1) {
          const line = pendingText.slice(0, nlIdx);
          if (line.trim()) checklists.push({ text: line, done: pendingDone });
          pendingText = pendingText.slice(nlIdx + 1);
          pendingDone = null;
        }
      } else {
        if (pendingText.trim() && pendingDone !== null) {
          checklists.push({ text: pendingText.replace(/\n+$/, ""), done: pendingDone });
        }
        pendingText = "";
        pendingDone = null;
      }
    }

    // Final flush for any remaining item without trailing newline
    if (pendingText.trim() && pendingDone !== null) {
      checklists.push({ text: pendingText.replace(/\n+$/, ""), done: pendingDone });
    }

    return { text: noteText, checklists };
  } catch {
    return { text: "", checklists: [] };
  }
}
