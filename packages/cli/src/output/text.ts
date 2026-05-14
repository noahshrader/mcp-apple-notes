import type {
  AppendNoteResult,
  CreateNoteResult,
  MutationPreview,
  NoteContent,
  NoteSummary,
  NotesDiagnostics
} from "@mcp-apple-notes/notes-adapter";
import type { CliOutputResult, CliSuccessData } from "../types.js";
import { USAGE } from "../usage.js";

export function formatText(result: CliOutputResult): string {
  if (!result.ok) {
    const lines = [
      `Error: ${result.error.message}`
    ];

    if ("code" in result.error) {
      lines.push(`Code: ${result.error.code}`);
    }

    if ("remediation" in result.error && result.error.remediation !== undefined) {
      lines.push(`Remediation: ${result.error.remediation}`);
    }

    if ("usage" in result.error) {
      lines.push("", result.error.usage);
    }

    return `${lines.join("\n")}\n`;
  }

  if (result.command === "help") {
    return USAGE;
  }

  return `${formatSuccess(result.command, result.data)}\n`;
}

function formatSuccess(command: string, data: CliSuccessData): string {
  switch (command) {
    case "diagnostics":
      return formatDiagnostics(data as NotesDiagnostics);
    case "search":
      return formatSearchResults(data as NoteSummary[]);
    case "read":
      return formatNoteContent(data as NoteContent);
    case "read-folder":
      return formatFolderNotes(data as NoteContent[]);
    case "create-preview":
    case "append-preview":
      return formatPreview((data as CreateNoteResult | AppendNoteResult).preview);
    case "create":
    case "append":
      return formatMutationResult(data as CreateNoteResult | AppendNoteResult);
    default:
      return "Done.";
  }
}

function formatDiagnostics(data: NotesDiagnostics): string {
  const lines = [
    "Apple Notes diagnostics",
    `Platform: ${data.platform}`,
    `osascript: ${data.osascriptAvailable ? "available" : "unavailable"}`,
    `Notes: ${data.notesReachable ? "reachable" : "unreachable"}`,
    `Automation: ${data.automationPermission}`,
    `Message: ${data.message}`
  ];

  if (data.notesCount !== undefined) {
    lines.splice(4, 0, `Notes count: ${data.notesCount}`);
  }

  return lines.join("\n");
}

function formatSearchResults(results: NoteSummary[]): string {
  if (results.length === 0) {
    return "No notes found.";
  }

  return results.map((note, index) => {
    const lines = [
      `${index + 1}. ${note.title}`,
      `   id: ${note.id}`
    ];

    if (note.folder !== undefined) {
      lines.push(`   folder: ${note.folder}`);
    }

    if (note.account !== undefined) {
      lines.push(`   account: ${note.account}`);
    }

    if (note.updatedAt !== undefined) {
      lines.push(`   updated: ${note.updatedAt}`);
    }

    if (note.excerpt !== undefined) {
      lines.push(`   excerpt: ${note.excerpt}`);
    }

    return lines.join("\n");
  }).join("\n\n");
}

function formatNoteContent(note: NoteContent): string {
  const lines = [
    note.title,
    `id: ${note.id}`
  ];

  if (note.folder !== undefined) {
    lines.push(`folder: ${note.folder}`);
  }

  if (note.account !== undefined) {
    lines.push(`account: ${note.account}`);
  }

  lines.push("", note.body);
  return lines.join("\n");
}

function formatFolderNotes(notes: NoteContent[]): string {
  if (notes.length === 0) {
    return "No notes found in folder.";
  }

  const folderName = notes.find((n) => n.folder !== undefined)?.folder ?? "unknown";
  const header = `${notes.length} note${notes.length === 1 ? "" : "s"} in "${folderName}"\n`;

  const body = notes.map((note, index) => {
    const divider = `--- ${index + 1}. ${note.title} ---`;
    return [divider, note.body].join("\n");
  }).join("\n\n");

  return header + "\n" + body;
}

function formatMutationResult(result: CreateNoteResult | AppendNoteResult): string {
  if (result.note === undefined) {
    return "Mutation completed, but no note was returned.";
  }

  return [
    "Mutation completed.",
    `Title: ${result.note.title}`,
    `ID: ${result.note.id}`
  ].join("\n");
}

function formatPreview(preview: MutationPreview | undefined): string {
  if (preview === undefined) {
    return "No preview returned.";
  }

  const lines = [
    `Preview: ${preview.operation}`
  ];

  if (preview.target !== undefined) {
    lines.push(`Target: ${preview.target.title}`);
    lines.push(`Target ID: ${preview.target.id}`);
  }

  if (preview.proposedTitle !== undefined) {
    lines.push(`Proposed title: ${preview.proposedTitle}`);
  }

  if (preview.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of preview.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (preview.proposedBody !== undefined) {
    lines.push("", preview.proposedBody);
  }

  return lines.join("\n");
}
