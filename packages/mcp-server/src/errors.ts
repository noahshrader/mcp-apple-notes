import type { NotesError, NotesErrorCode } from "@mcp-apple-notes/notes-adapter";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const ERROR_CODE_META_KEY = "mcp-apple-notes/errorCode";

export function toNotesToolErrorResult(error: NotesError): CallToolResult {
  const structuredContent: NotesToolErrorContent = {
    ok: false,
    code: error.code,
    message: error.message
  };

  if (error.remediation !== undefined) {
    structuredContent.remediation = error.remediation;
  }

  if (error.details !== undefined) {
    structuredContent.details = error.details;
  }

  return {
    content: [
      {
        type: "text",
        text: formatNotesToolError(error)
      }
    ],
    structuredContent,
    _meta: {
      [ERROR_CODE_META_KEY]: error.code
    },
    isError: true
  };
}

export type NotesToolErrorContent = {
  ok: false;
  code: NotesErrorCode;
  message: string;
  remediation?: string;
  details?: unknown;
};

function formatNotesToolError(error: NotesError): string {
  const lines = [`${error.code}: ${error.message}`];

  if (error.remediation !== undefined) {
    lines.push(`Remediation: ${error.remediation}`);
  }

  return lines.join("\n");
}