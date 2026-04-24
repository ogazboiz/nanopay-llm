#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "nanopay-llm", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "stream_chat",
      description: "Stream a chat completion with per-token USDC billing on Arc.",
      inputSchema: {
        type: "object",
        properties: {
          model: { type: "string", description: "e.g. gemini-3-flash-preview" },
          prompt: { type: "string" },
          maxUsd: { type: "number", description: "Max spend cap in USD" },
        },
        required: ["model", "prompt", "maxUsd"],
      },
    },
    {
      name: "list_models",
      description: "List LLM endpoints registered in the on-chain ServiceRegistry.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "list_models") {
    return { content: [{ type: "text", text: "TODO: query ServiceRegistry on Arc" }] };
  }
  if (req.params.name === "stream_chat") {
    return { content: [{ type: "text", text: "TODO: proxy to @nanopay/server /stream" }] };
  }
  throw new Error(`Unknown tool: ${req.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
