#!/usr/bin/env node
/**
 * chatport CLI.
 *
 *   chatport send-text <phone> <message...>
 *   chatport send-contact <phone> <contact_name> <contact_phone>
 *   chatport send-link <phone> <link> [caption...]
 *   chatport send-location <phone> <latitude> <longitude>
 *   chatport mcp
 *
 * GoWA base URL from WHATSAPP_API_URL (e.g. http://localhost:3000);
 * a missing value is an error before any request.
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
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

function usage(): never {
  console.error(`Usage:
  chatport send-text <phone> <message...>
  chatport send-contact <phone> <contact_name> <contact_phone>
  chatport send-link <phone> <link> [caption...]
  chatport send-location <phone> <latitude> <longitude>
  chatport mcp
  chatport --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const baseUrl = process.env[BASE_URL_ENV];
  const known = ["send-text", "send-contact", "send-link", "send-location"];
  if (!known.includes(cmd)) usage();
  try {
    let out: unknown;
    if (cmd === "send-text") {
      if (!rest[0] || !rest[1]) usage();
      out = await sendText(fetchFn, baseUrl, { phone: rest[0], message: rest.slice(1).join(" ") });
    } else if (cmd === "send-contact") {
      if (!rest[0] || !rest[1] || !rest[2]) usage();
      out = await sendContact(fetchFn, baseUrl, {
        phone: rest[0],
        contact_name: rest[1],
        contact_phone: rest[2],
      });
    } else if (cmd === "send-link") {
      if (!rest[0] || !rest[1]) usage();
      const caption = rest.slice(2).join(" ");
      out = await sendLink(fetchFn, baseUrl, {
        phone: rest[0],
        link: rest[1],
        ...(caption ? { caption } : {}),
      });
    } else {
      if (!rest[0] || !rest[1] || !rest[2]) usage();
      const latitude = Number(rest[1]);
      const longitude = Number(rest[2]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) usage();
      out = await sendLocation(fetchFn, baseUrl, { phone: rest[0], latitude, longitude });
    }
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
