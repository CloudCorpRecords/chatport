/**
 * chatport MCP server. Tools: whatsapp_send_text,
 * whatsapp_send_contact, whatsapp_send_link, whatsapp_send_location.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys that
 * are not in this tool's public spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod still
 * validates every tools/call argument set.
 *
 * The GoWA base URL is read from WHATSAPP_API_URL at call time;
 * a missing value errors cleanly before any request.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  BASE_URL_ENV,
  formatPayload,
  sendContact,
  sendLink,
  sendLocation,
  sendText,
  VERSION,
} from "./chatport.js";
import type { FetchFn } from "./types.js";

const SendTextArgs = z.object({
  phone: z.string(),
  message: z.string(),
});
const SendContactArgs = z.object({
  phone: z.string(),
  contact_name: z.string(),
  contact_phone: z.string(),
});
const SendLinkArgs = z.object({
  phone: z.string(),
  link: z.string(),
  caption: z.string().optional(),
});
const SendLocationArgs = z.object({
  phone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const TOOLS = [
  {
    name: "whatsapp_send_text",
    description: "Send text messages",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Recipient phone number." },
        message: { type: "string", description: "Text message to send." },
      },
      required: ["phone", "message"],
    },
  },
  {
    name: "whatsapp_send_contact",
    description: "Send contact cards",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Recipient phone number." },
        contact_name: { type: "string", description: "Name of the contact to send." },
        contact_phone: { type: "string", description: "Phone number of the contact to send." },
      },
      required: ["phone", "contact_name", "contact_phone"],
    },
  },
  {
    name: "whatsapp_send_link",
    description: "Send links with captions",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Recipient phone number." },
        link: { type: "string", description: "Link URL to send." },
        caption: { type: "string", description: "Optional caption for the link." },
      },
      required: ["phone", "link"],
    },
  },
  {
    name: "whatsapp_send_location",
    description: "Send location coordinates",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Recipient phone number." },
        latitude: { type: "number", description: "Latitude coordinate, between -90 and 90." },
        longitude: { type: "number", description: "Longitude coordinate, between -180 and 180." },
      },
      required: ["phone", "latitude", "longitude"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "chatport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const baseUrl = process.env[BASE_URL_ENV];
  try {
    let out: unknown;
    if (name === "whatsapp_send_text") {
      out = await sendText(fetchFn, baseUrl, SendTextArgs.parse(args ?? {}));
    } else if (name === "whatsapp_send_contact") {
      out = await sendContact(fetchFn, baseUrl, SendContactArgs.parse(args ?? {}));
    } else if (name === "whatsapp_send_link") {
      out = await sendLink(fetchFn, baseUrl, SendLinkArgs.parse(args ?? {}));
    } else if (name === "whatsapp_send_location") {
      out = await sendLocation(fetchFn, baseUrl, SendLocationArgs.parse(args ?? {}));
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
