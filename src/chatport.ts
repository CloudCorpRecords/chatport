/**
 * chatport core: four WhatsApp send tools backed by a GoWA
 * (go-whatsapp-web-multidevice) REST service.
 *
 *   whatsapp_send_text     POST /send/message
 *   whatsapp_send_contact  POST /send/contact
 *   whatsapp_send_link     POST /send/link
 *   whatsapp_send_location POST /send/location
 *
 * The endpoint mapping and JSON body field names are a documented
 * reconstruction from the GoWA REST API pattern: request bodies
 * carry the tool's argument names, and the optional link caption is
 * sent only when supplied.
 *
 * The GoWA base URL comes from WHATSAPP_API_URL (for example
 * http://localhost:3000). There is no default: a missing or blank
 * value is an error raised before any request is attempted. All
 * HTTP goes through an injected FetchFn so everything is testable
 * offline.
 */
import type {
  FetchFn,
  SendContactOptions,
  SendLinkOptions,
  SendLocationOptions,
  SendTextOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const BASE_URL_ENV = "WHATSAPP_API_URL";

/**
 * Resolve the GoWA base URL. Unlike keyless read APIs this service
 * is self-hosted, so there is no sensible default: a missing or
 * blank value throws before any request. Trailing slashes are
 * stripped from a supplied value.
 */
export function resolveBaseUrl(value?: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) {
    throw new Error(
      `${BASE_URL_ENV} is not set: set it to the base URL of your GoWA service (e.g. http://localhost:3000)`,
    );
  }
  return v.replace(/\/+$/, "");
}

function requireNonEmpty(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function requireCoordinate(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  if (value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

function optionalParam(value: unknown): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function callApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `${resolveBaseUrl(baseUrl)}${path}`;
  let response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `GoWA API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        if (typeof payload.message === "string" && payload.message) {
          detail = `: ${payload.message}`;
        } else if (typeof payload.error === "string" && payload.error) {
          detail = `: ${payload.error}`;
        }
      }
    } catch {
      // A non-JSON error body still reports its HTTP status below.
    }
    throw new Error(
      `GoWA API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("GoWA API returned a response that was not valid JSON");
  }
}

/** Send a text message. */
export async function sendText(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  options: SendTextOptions,
): Promise<unknown> {
  const phone = requireNonEmpty(options.phone, "phone");
  const message = requireNonEmpty(options.message, "message");
  return callApi(fetchFn, baseUrl, "/send/message", { phone, message });
}

/** Send a contact card. */
export async function sendContact(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  options: SendContactOptions,
): Promise<unknown> {
  const phone = requireNonEmpty(options.phone, "phone");
  const contact_name = requireNonEmpty(options.contact_name, "contact_name");
  const contact_phone = requireNonEmpty(options.contact_phone, "contact_phone");
  return callApi(fetchFn, baseUrl, "/send/contact", { phone, contact_name, contact_phone });
}

/** Send a link, with an optional caption. */
export async function sendLink(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  options: SendLinkOptions,
): Promise<unknown> {
  const phone = requireNonEmpty(options.phone, "phone");
  const link = requireNonEmpty(options.link, "link");
  const body: Record<string, unknown> = { phone, link };
  const caption = optionalParam(options.caption);
  if (caption) body.caption = caption;
  return callApi(fetchFn, baseUrl, "/send/link", body);
}

/** Send location coordinates. */
export async function sendLocation(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  options: SendLocationOptions,
): Promise<unknown> {
  const phone = requireNonEmpty(options.phone, "phone");
  const latitude = requireCoordinate(options.latitude, "latitude", -90, 90);
  const longitude = requireCoordinate(options.longitude, "longitude", -180, 180);
  return callApi(fetchFn, baseUrl, "/send/location", { phone, latitude, longitude });
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
