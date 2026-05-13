#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { notesAdapterPackage } from "@mcp-apple-notes/notes-adapter";
import { fileURLToPath } from "node:url";
import { registerAppleNotesTools } from "./tools.js";

const MCP_SERVER_NAME = "mcp-apple-notes";
const MCP_SERVER_VERSION = "0.1.0";

export const mcpServerPackage = {
  name: "@mcp-apple-notes/mcp-server",
  phase: "tools-defined",
  version: MCP_SERVER_VERSION,
  dependencies: [
    notesAdapterPackage.name
  ]
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
        "Apple Notes MCP server exposing search, read, create, append, and diagnostics tools over stdio."
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
