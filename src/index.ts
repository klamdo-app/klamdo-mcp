#!/usr/bin/env node
/**
 * Klamdo MCP Server — stdio transport (for Claude Desktop local use)
 *
 * Setup in Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "klamdo": {
 *       "command": "npx",
 *       "args": ["klamdo-mcp"],
 *       "env": { "KLAMDO_API_KEY": "<your-key-from-klamdo.app/profile>" }
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerHandlers } from "./tools.js";

const API_KEY = process.env.KLAMDO_API_KEY ?? "";

if (!API_KEY) {
  process.stderr.write(
    "[klamdo-mcp] Warning: KLAMDO_API_KEY is not set. Set it in your MCP client config.\n"
  );
}

async function main() {
  const server = new Server(
    { name: "klamdo", version: "1.4.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  registerHandlers(server, () => API_KEY);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[klamdo-mcp] Running via stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[klamdo-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
