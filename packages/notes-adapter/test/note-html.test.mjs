import assert from "node:assert/strict";
import test from "node:test";

import { buildAppleNotesHtml } from "../dist/index.js";

test("title renders as h1", () => {
  const html = buildAppleNotesHtml([{ type: "title", text: "My Note" }]);
  assert.equal(html, "<h1>My Note</h1>");
});

test("heading renders as h2", () => {
  const html = buildAppleNotesHtml([{ type: "heading", text: "Section" }]);
  assert.equal(html, "<h2>Section</h2>");
});

test("subheading renders as h3", () => {
  const html = buildAppleNotesHtml([{ type: "subheading", text: "Sub" }]);
  assert.equal(html, "<h3>Sub</h3>");
});

test("body renders as div", () => {
  const html = buildAppleNotesHtml([{ type: "body", text: "Hello world" }]);
  assert.equal(html, "<div>Hello world</div>");
});

test("monospace renders as div tt", () => {
  const html = buildAppleNotesHtml([{ type: "monospace", text: "const x = 1;" }]);
  assert.equal(html, "<div><tt>const x = 1;</tt></div>");
});

test("bullet-list renders as ul", () => {
  const html = buildAppleNotesHtml([
    { type: "bullet-list", items: ["Alpha", "Beta", "Gamma"] }
  ]);
  assert.equal(html, "<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>");
});

test("dash-list renders as ul (Apple Notes ignores list-style via HTML)", () => {
  const html = buildAppleNotesHtml([
    { type: "dash-list", items: ["One", "Two"] }
  ]);
  assert.equal(html, "<ul><li>One</li><li>Two</li></ul>");
});

test("numbered-list renders as ol", () => {
  const html = buildAppleNotesHtml([
    { type: "numbered-list", items: ["First", "Second"] }
  ]);
  assert.equal(html, "<ol><li>First</li><li>Second</li></ol>");
});

test("blockquote renders as blockquote", () => {
  const html = buildAppleNotesHtml([{ type: "blockquote", text: "Notable" }]);
  assert.equal(html, "<blockquote>Notable</blockquote>");
});

test("checklist renders with unicode check prefix (native checkboxes not possible via JXA HTML)", () => {
  const html = buildAppleNotesHtml([
    {
      type: "checklist",
      items: [
        { text: "Done thing", checked: true },
        { text: "Pending thing", checked: false }
      ]
    }
  ]);
  assert.equal(
    html,
    "<ul><li>\u2611 Done thing</li><li>\u2610 Pending thing</li></ul>"
  );
});

test("table renders with headers and rows", () => {
  const html = buildAppleNotesHtml([
    {
      type: "table",
      headers: ["Name", "Status"],
      rows: [
        ["Alice", "Done"],
        ["Bob", "In progress"]
      ]
    }
  ]);
  assert.equal(
    html,
    "<table><tr><th>Name</th><th>Status</th></tr><tr><td>Alice</td><td>Done</td></tr><tr><td>Bob</td><td>In progress</td></tr></table>"
  );
});

test("table renders without headers", () => {
  const html = buildAppleNotesHtml([
    { type: "table", rows: [["A", "B"], ["C", "D"]] }
  ]);
  assert.equal(
    html,
    "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>"
  );
});

test("multiple blocks are concatenated", () => {
  const html = buildAppleNotesHtml([
    { type: "title", text: "Review" },
    { type: "heading", text: "Tasks" },
    { type: "checklist", items: [{ text: "Ship it", checked: true }] }
  ]);
  assert.equal(
    html,
    "<h1>Review</h1><h2>Tasks</h2><ul><li>\u2611 Ship it</li></ul>"
  );
});

test("HTML special characters are escaped", () => {
  const html = buildAppleNotesHtml([
    { type: "body", text: "a < b && c > d & 'quotes' \"here\"" }
  ]);
  assert.equal(
    html,
    "<div>a &lt; b &amp;&amp; c &gt; d &amp; &#39;quotes&#39; &quot;here&quot;</div>"
  );
});
