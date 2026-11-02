# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `chatport send-text|send-contact|send-link|send-location`
  and `chatport mcp`.
- MCP server (`chatport mcp`, stdio) with four tools:
  `whatsapp_send_text`, `whatsapp_send_contact`,
  `whatsapp_send_link`, and `whatsapp_send_location`.
- Sends go to a self-hosted GoWA service under the base URL from
  `WHATSAPP_API_URL` (no default; a missing value errors before any
  request) via the `/send/message`, `/send/contact`, `/send/link`,
  and `/send/location` endpoints.
- HTTP failures surface the status plus the upstream `message` or
  `error` when present.
- All HTTP goes through an injectable fetch function, so the test
  suite runs entirely on hand-written fixtures with no network access.
