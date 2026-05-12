export const USAGE = `mcp-apple-notes <command> [options]

Commands:
  diagnostics
  search --query <text> [--folder <name>] [--account <name>] [--limit <n>]
  read --id <note-id>
  create-preview --title <title> --body <text> [--folder <name>] [--account <name>]
  create --title <title> --body <text> [--folder <name>] [--account <name>]
  append-preview --id <note-id> --content <text> [--separator <text>]
  append --id <note-id> --content <text> [--separator <text>]

Global options:
  --json       Print machine-readable JSON.
  --help, -h   Show this help.
`;

export function usageError(message: string): {
  code: "USAGE_ERROR";
  message: string;
  usage: string;
} {
  return {
    code: "USAGE_ERROR",
    message,
    usage: USAGE
  };
}
