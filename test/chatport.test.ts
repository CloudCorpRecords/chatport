import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveBaseUrl,
  sendContact,
  sendLink,
  sendLocation,
  sendText,
} from "../src/chatport.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

interface Captured {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeFetch(captured: Captured, body: unknown = { code: 200, results: {} }): FetchFn {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    captured.url = url;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = init?.body;
    return jsonResponse(body);
  };
}

const BASE = "http://localhost:3000";

describe("base URL resolution", () => {
  it("missing or blank WHATSAPP_API_URL is an error", () => {
    assert.throws(() => resolveBaseUrl(undefined), /WHATSAPP_API_URL is not set/);
    assert.throws(() => resolveBaseUrl(""), /WHATSAPP_API_URL is not set/);
    assert.throws(() => resolveBaseUrl("   "), /WHATSAPP_API_URL is not set/);
  });

  it("strips trailing slashes from a supplied base URL", () => {
    assert.equal(resolveBaseUrl("http://localhost:3000/"), BASE);
    assert.equal(resolveBaseUrl(" http://example.test:8080// "), "http://example.test:8080");
  });

  it("missing env errors before any request is attempted", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(
      () => sendText(spy, undefined, { phone: "15551234567", message: "hi" }),
      /WHATSAPP_API_URL is not set/,
    );
    assert.equal(called, false);
  });
});

describe("send tools request shaping", () => {
  it("send_text POSTs phone and message to /send/message", async () => {
    const c: Captured = {};
    const out = (await sendText(fakeFetch(c), BASE, { phone: "15551234567", message: "hello there" })) as Record<string, unknown>;
    assert.equal(out.code, 200);
    assert.equal(c.url, `${BASE}/send/message`);
    assert.equal(c.method, "POST");
    assert.equal(c.headers?.["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), { phone: "15551234567", message: "hello there" });
  });

  it("send_contact POSTs the contact card to /send/contact", async () => {
    const c: Captured = {};
    await sendContact(fakeFetch(c), BASE, {
      phone: "15551234567",
      contact_name: "Ada Lovelace",
      contact_phone: "15559876543",
    });
    assert.equal(c.url, `${BASE}/send/contact`);
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      phone: "15551234567",
      contact_name: "Ada Lovelace",
      contact_phone: "15559876543",
    });
  });

  it("send_link POSTs link and caption to /send/link", async () => {
    const c: Captured = {};
    await sendLink(fakeFetch(c), BASE, {
      phone: "15551234567",
      link: "https://example.test/page",
      caption: "worth a look",
    });
    assert.equal(c.url, `${BASE}/send/link`);
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      phone: "15551234567",
      link: "https://example.test/page",
      caption: "worth a look",
    });
  });

  it("send_link omits the caption when none is given", async () => {
    const c: Captured = {};
    await sendLink(fakeFetch(c), BASE, { phone: "15551234567", link: "https://example.test" });
    const body = JSON.parse(c.body ?? "{}") as Record<string, unknown>;
    assert.equal("caption" in body, false);
    assert.equal(body.link, "https://example.test");
  });

  it("send_location POSTs numeric coordinates to /send/location", async () => {
    const c: Captured = {};
    await sendLocation(fakeFetch(c), BASE, {
      phone: "15551234567",
      latitude: 37.7749,
      longitude: -122.4194,
    });
    assert.equal(c.url, `${BASE}/send/location`);
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      phone: "15551234567",
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it("honours a custom base URL with a trailing slash", async () => {
    const c: Captured = {};
    await sendText(fakeFetch(c), "http://example.test:9000/", { phone: "1", message: "hi" });
    assert.equal(c.url, "http://example.test:9000/send/message");
  });
});

describe("validation", () => {
  it("rejects an empty phone or message before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(() => sendText(spy, BASE, { phone: " ", message: "hi" }), /phone/);
    await assert.rejects(() => sendText(spy, BASE, { phone: "1", message: "" }), /message/);
    assert.equal(called, false);
  });

  it("rejects a contact with an empty contact_phone", async () => {
    const f = fakeFetch({}, {});
    await assert.rejects(
      () => sendContact(f, BASE, { phone: "1", contact_name: "Ada", contact_phone: " " }),
      /contact_phone/,
    );
  });

  it("rejects out-of-range or non-finite coordinates before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(
      () => sendLocation(spy, BASE, { phone: "1", latitude: 91, longitude: 0 }),
      /latitude must be between -90 and 90/,
    );
    await assert.rejects(
      () => sendLocation(spy, BASE, { phone: "1", latitude: 0, longitude: -181 }),
      /longitude must be between -180 and 180/,
    );
    await assert.rejects(
      () => sendLocation(spy, BASE, { phone: "1", latitude: Number.NaN, longitude: 0 }),
      /latitude must be a finite number/,
    );
    assert.equal(called, false);
  });
});

describe("errors", () => {
  it("HTTP 500 surfaces status and upstream message", async () => {
    const failing: FetchFn = async () => jsonResponse({ message: "device not connected" }, 500, "Internal Server Error");
    await assert.rejects(
      () => sendText(failing, BASE, { phone: "1", message: "hi" }),
      /HTTP 500.*device not connected/,
    );
  });

  it("network failure is wrapped with context", async () => {
    const failing: FetchFn = async () => { throw new Error("connect ECONNREFUSED"); };
    await assert.rejects(
      () => sendText(failing, BASE, { phone: "1", message: "hi" }),
      /GoWA API request failed: connect ECONNREFUSED/,
    );
  });
});
