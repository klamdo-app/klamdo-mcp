#!/usr/bin/env node
/**
 * Klamdo MCP Server — Streamable HTTP transport
 *
 * Runs as a hosted service on mark-mini-s, exposed via Cloudflare Tunnel at:
 *   https://mcp.klamdo.app
 *
 * Each request is stateless. API key is read from Authorization: Bearer <key> header.
 * Users get their key from https://klamdo.app/profile
 *
 * Smithery URL: https://mcp.klamdo.app/mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { registerHandlers } from "./tools.js";

const PORT = parseInt(process.env.PORT ?? "3838", 10);
const HOST = process.env.HOST ?? "127.0.0.1";

function extractApiKey(req: IncomingMessage): string {
  const auth = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  // Also allow x-api-key header for clients that don't support Bearer
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string") return xApiKey.trim();
  return "";
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createMcpServer(apiKey: string): Server {
  const server = new Server(
    { name: "klamdo", version: "1.4.0" },
    { capabilities: { tools: {}, resources: {} } }
  );
  registerHandlers(server, () => apiKey);
  return server;
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "klamdo-mcp", version: "1.4.0" }));
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, mcp-session-id"
    });
    res.end();
    return;
  }

  // MCP endpoint
  if (url.pathname === "/mcp") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-api-key, mcp-session-id");

    const apiKey = extractApiKey(req);

    // Require auth — return 401 so Smithery knows OAuth is expected
    if (!apiKey) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="Klamdo MCP", error="missing_token"'
      });
      res.end(JSON.stringify({
        error: "missing_api_key",
        message: "Get your API key at https://klamdo.app/profile"
      }));
      return;
    }

    try {
      const body = req.method === "POST" ? await readBody(req) : undefined;

      // Stateless: new server+transport per request
      const mcpServer = createMcpServer(apiKey);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined // stateless mode
      });

      await mcpServer.connect(transport);

      await transport.handleRequest(req, res, body ? JSON.parse(body.toString()) : undefined);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_error", message: String(err) }));
      }
    }
    return;
  }

  // Root — basic info page
  if (url.pathname === "/" || url.pathname === "") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      service: "Klamdo MCP Server",
      version: "1.4.0",
      mcpEndpoint: "/mcp",
      docs: "https://klamdo.app/answers",
      getApiKey: "https://klamdo.app/profile"
    }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

httpServer.listen(PORT, HOST, () => {
  process.stdout.write(`[klamdo-mcp:http] Listening on http://${HOST}:${PORT}/mcp\n`);
});

httpServer.on("error", (err) => {
  process.stderr.write(`[klamdo-mcp:http] Server error: ${err}\n`);
  process.exit(1);
});
