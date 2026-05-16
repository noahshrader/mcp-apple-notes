/**
 * Apple Notes HTML formatter.
 *
 * Builds the HTML body string that Apple Notes accepts when creating or
 * appending a note via JXA.
 *
 * ## Block fidelity (verified against NoteStoreProto style_type values)
 *
 * | Block          | HTML emitted     | style_type stored | Notes                            |
 * |----------------|------------------|-------------------|----------------------------------|
 * | title          | `<h1>`           | -1 (body)         | Visual only — see title note     |
 * | heading        | `<h2>`           | -1 (body)         | Visual only — renders at h2 size |
 * | subheading     | `<h3>`           | -1 (body)         | Visual only — renders at h3 size |
 * | body           | `<div>`          | -1 (body)         | ✅ Correct                       |
 * | monospace      | `<div><tt>`      | 4 (monospaced)    | ✅ Correct                       |
 * | bullet-list    | `<ul><li>`       | 100 (dotted)      | ✅ Correct                       |
 * | dash-list      | `<ul><li>`       | 100 (dotted)      | ⚠️ No dash style via HTML        |
 * | numbered-list  | `<ol><li>`       | 102 (numbered)    | ✅ Correct                       |
 * | blockquote     | `<blockquote>`   | -1 (body)         | Visual indent only               |
 * | checklist      | `<ul><li>` ☐/☑  | 100 (dotted)      | ⚠️ Not tappable — see note       |
 * | table          | `<table>`        | native table obj  | ✅ Correct                       |
 *
 * ### Why headings are visual-only
 * The JXA `note.body` setter and getter use asymmetric HTML parsers. Apple
 * Notes exports heading paragraphs as `<h1>`/`<h2>`/`<h3>`, but its setter
 * does not map any HTML heading tag back to style_type 0/1/2. Even the exact
 * HTML Apple Notes itself exports (`<div><b><h2>`) stores as style_type -1
 * when written back. This was verified by writing test notes and reading their
 * NoteStoreProto directly from NoteStore.sqlite.
 *
 * The only styles the JXA body setter reliably creates are: body (-1),
 * monospaced (4), dotted list (100), and numbered list (102).
 *
 * ### Title block
 * Include a `title` block as the FIRST block. Do NOT also pass the same text
 * as `CreateNoteInput.title` — the JXA adapter derives the note name from the
 * first line of the body when body is present, so passing both causes the
 * title to appear twice.
 *
 * ### Checklist limitation
 * style_type 103 (native tappable checkbox) cannot be created via HTML body
 * injection. The checklist block uses ☐/☑ unicode prefixes on bullet items so
 * the intent is visually clear, but items are stored as dotted list (100).
 */

// ─── HTML escape ─────────────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Block types ─────────────────────────────────────────────────────────────

export type TitleBlock = {
  type: "title";
  /**
   * Plain text for the note title, rendered as `<h1>` in the body.
   *
   * Include this as the FIRST block. Do NOT also pass the same text as
   * `CreateNoteInput.title` — the adapter derives the note name from the
   * first body line when body is provided, passing both causes duplication.
   *
   * Stored as style_type -1 (body) by the JXA HTML parser; visual rendering
   * is correct (h1 size) but the Notes format inspector will show "Body".
   */
  text: string;
};

export type HeadingBlock = {
  type: "heading";
  /**
   * Plain text rendered as `<h2>`.
   * Stored as style_type -1 (body) — visual h2 size, but the Notes format
   * inspector shows "Body". True style_type 1 (Heading) cannot be set via
   * JXA HTML injection.
   */
  text: string;
};

export type SubheadingBlock = {
  type: "subheading";
  /**
   * Plain text rendered as `<h3>`.
   * Stored as style_type -1 (body) — visual h3 size, but the Notes format
   * inspector shows "Body". True style_type 2 (Subheading) cannot be set via
   * JXA HTML injection.
   */
  text: string;
};

export type BodyBlock = {
  type: "body";
  /** Plain text rendered as a normal paragraph. */
  text: string;
};

export type MonospaceBlock = {
  type: "monospace";
  /**
   * Plain text rendered in monospace via `<tt>` (maps to Apple Notes
   * style_type 4). Using `<tt>` rather than `<pre>` avoids unintended
   * whitespace preservation for single-line code.
   */
  text: string;
};

export type BulletListBlock = {
  type: "bullet-list";
  /** Plain text items rendered as a dotted bullet list (style_type 100). */
  items: string[];
};

export type DashListBlock = {
  type: "dash-list";
  /** Plain text items rendered as a dashed list (style_type 101). */
  items: string[];
};

export type NumberedListBlock = {
  type: "numbered-list";
  /** Plain text items rendered as a numbered list (style_type 102). */
  items: string[];
};

export type BlockquoteBlock = {
  type: "blockquote";
  /** Plain text rendered as an indented block quote. */
  text: string;
};

export type ChecklistItem = {
  text: string;
  checked: boolean;
};

export type ChecklistBlock = {
  type: "checklist";
  /**
   * Checklist items rendered as a bullet list with ☐/☑ unicode prefixes.
   *
   * **Limitation**: the JXA HTML body API cannot create native Apple Notes
   * checkbox items (style_type 103). Items are rendered as a `<ul>` with
   * visual indicators only — they will NOT be tappable checkboxes in the app.
   */
  items: ChecklistItem[];
};

export type TableBlock = {
  type: "table";
  /**
   * Optional header row. When provided, cells are rendered as <th>.
   */
  headers?: string[];
  /** Data rows. Each inner array is one row; cells are rendered as <td>. */
  rows: string[][];
};

export type NoteBlock =
  | TitleBlock
  | HeadingBlock
  | SubheadingBlock
  | BodyBlock
  | MonospaceBlock
  | BulletListBlock
  | DashListBlock
  | NumberedListBlock
  | BlockquoteBlock
  | ChecklistBlock
  | TableBlock;

// ─── Renderer ────────────────────────────────────────────────────────────────

function renderBlock(block: NoteBlock): string {
  switch (block.type) {
    // h1/h2/h3 give the correct visual size in Apple Notes' rendering engine,
    // but the JXA body setter does not map them to style_type 0/1/2. They are
    // stored as style_type -1 (body). The Notes format inspector will show
    // "Body" when clicking these lines — this is a hard JXA API limitation.
    case "title":
      return `<h1>${esc(block.text)}</h1>`;

    case "heading":
      return `<h2>${esc(block.text)}</h2>`;

    case "subheading":
      return `<h3>${esc(block.text)}</h3>`;

    case "body": {
      const trimmed = block.text.trim();
      if (!trimmed) {
        return "<div><br></div>";
      }
      if (/^https?:\/\/\S+$/i.test(trimmed)) {
        return `<div><a href="${esc(trimmed)}">${esc(trimmed)}</a></div>`;
      }
      return `<div>${esc(block.text)}</div>`;
    }

    case "monospace":
      // <tt> maps to Apple Notes style_type 4 (monospaced) without the
      // whitespace-preservation side-effect of <pre>.
      return `<div><tt>${esc(block.text)}</tt></div>`;

    case "bullet-list": {
      const items = block.items.map((item) => `<li>${esc(item)}</li>`).join("");
      return `<ul>${items}</ul>`;
    }

    case "dash-list": {
      // Apple Notes does not honour list-style-type via HTML body injection;
      // all <ul> items render as bullets. Dash lists are indistinguishable
      // from bullet lists at the HTML level when writing via JXA.
      const items = block.items.map((item) => `<li>${esc(item)}</li>`).join("");
      return `<ul>${items}</ul>`;
    }

    case "numbered-list": {
      const items = block.items.map((item) => `<li>${esc(item)}</li>`).join("");
      return `<ol>${items}</ol>`;
    }

    case "blockquote":
      return `<blockquote>${esc(block.text)}</blockquote>`;

    case "checklist": {
      // Native Apple Notes checkboxes (style_type 103) cannot be created via
      // JXA HTML body assignment. Apple Notes exports its own checkbox items
      // as plain <ul><li> with no class or attribute, making the write path
      // indistinguishable from a bullet list. We use ☐/☑ unicode prefixes so
      // the checked/unchecked intent is visually preserved in the note text.
      const items = block.items
        .map((item) => {
          const marker = item.checked ? "\u2611" : "\u2610"; // ☑ / ☐
          return `<li>${marker} ${esc(item.text)}</li>`;
        })
        .join("");
      return `<ul>${items}</ul>`;
    }

    case "table": {
      let html = "<table>";
      if (block.headers && block.headers.length > 0) {
        const cells = block.headers.map((h) => `<th>${esc(h)}</th>`).join("");
        html += `<tr>${cells}</tr>`;
      }
      for (const row of block.rows) {
        const cells = row.map((cell) => `<td>${esc(cell)}</td>`).join("");
        html += `<tr>${cells}</tr>`;
      }
      html += "</table>";
      return html;
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Converts an array of structured blocks into the HTML string that Apple Notes
 * expects as a note body. Pass the result directly to `CreateNoteInput.body`
 * or `AppendNoteInput.content`.
 *
 * @example
 * ```ts
 * const html = buildAppleNotesHtml([
 *   { type: "title", text: "Weekly Review" },
 *   { type: "heading", text: "Done" },
 *   { type: "checklist", items: [
 *     { text: "Ship the feature", checked: true },
 *     { text: "Write tests", checked: false },
 *   ]},
 *   { type: "heading", text: "Notes" },
 *   { type: "body", text: "Carry over the table items next week." },
 *   { type: "table", headers: ["Item", "Owner", "Status"], rows: [
 *     ["Fix login bug", "Alice", "Done"],
 *     ["Update docs", "Bob", "In progress"],
 *   ]},
 * ]);
 * ```
 */
export function buildAppleNotesHtml(blocks: NoteBlock[]): string {
  return blocks.map(renderBlock).join("");
}
