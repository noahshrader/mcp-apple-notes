import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { registerAppleNotesTools } from "./tools.js";

if (process.platform !== "darwin") {
  process.stderr.write(
    "@noahshrader/mcp-apple-notes requires macOS and Apple Notes.\n"
  );
  process.exit(1);
}

const MCP_SERVER_NAME = "mcp-apple-notes";
const MCP_SERVER_VERSION = "1.0.0";

export const mcpServerPackage = {
  name: MCP_SERVER_NAME,
  version: MCP_SERVER_VERSION,
} as const;

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION
    },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        "Apple Notes MCP server exposing search, read, create, append, diagnostics, and planner-sync tools over stdio."
    }
  );

  return registerAppleNotesTools(server);
}

export async function startMcpServer(server: McpServer = createMcpServer()): Promise<McpServer> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

function isDirectExecution(moduleUrl: string): boolean {
  const entryPath = process.argv[1];

  if (entryPath === undefined) {
    return false;
  }

  return fileURLToPath(moduleUrl) === entryPath;
}

if (isDirectExecution(import.meta.url)) {
  startMcpServer().catch((error) => {
    console.error("Failed to start MCP Apple Notes server.", error);
    process.exit(1);
  });
}
