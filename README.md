# chatport

chatport sends WhatsApp messages through a GoWA
(go-whatsapp-web-multidevice) service that you host yourself: plain
text messages, contact cards, links with an optional caption, and
location pins. One binary serves a command-line interface and a
stdio MCP server, and both faces talk to the same GoWA REST API.

chatport is a client, not a WhatsApp account. It needs a running
GoWA service paired with the WhatsApp account you want to send
from. Point it at that service with the `WHATSAPP_API_URL`
environment variable, for example `http://localhost:3000`. There is
no default: when the variable is missing, every send fails with a
clear error before any request is made, so a misconfigured client
never silently talks to the wrong host.

## Install

```bash
npx @reneturcios/chatport send-text 15551234567 "hello"
```

Or run the container image:

```bash
docker run -i -e WHATSAPP_API_URL=http://host.docker.internal:3000 ghcr.io/cloudcorprecords/chatport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

```bash
export WHATSAPP_API_URL=http://localhost:3000

chatport send-text 15551234567 "hello there"
chatport send-contact 15551234567 "Ada Lovelace" 15559876543
chatport send-link 15551234567 https://example.test/page "worth a look"
chatport send-location 15551234567 37.7749 -122.4194

chatport --version
```

Successful sends print the GoWA service's JSON response. Exit
codes: `0` on success, `1` when a send fails (including an upstream
API error or a missing `WHATSAPP_API_URL`), `2` for usage errors.

Phone numbers are passed through exactly as given; use the format
your GoWA service expects (typically international format, digits
only). Latitude must be between -90 and 90 and longitude between
-180 and 180; anything outside is rejected before a request is sent.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/chatport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "chatport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/chatport", "mcp"],
      "env": { "WHATSAPP_API_URL": "http://localhost:3000" }
    }
  }
}
```

### Tools

| Tool | Input | What it sends |
| --- | --- | --- |
| `whatsapp_send_text` | `phone`, `message` (both required) | A plain text message. |
| `whatsapp_send_contact` | `phone`, `contact_name`, `contact_phone` (all required) | A contact card for the named contact. |
| `whatsapp_send_link` | `phone`, `link` (required), `caption` (optional) | A link, with a caption when one is supplied. |
| `whatsapp_send_location` | `phone`, `latitude`, `longitude` (all required) | A location pin at the given coordinates. |

Each tool posts to the matching GoWA send endpoint under
`WHATSAPP_API_URL` (`/send/message`, `/send/contact`, `/send/link`,
`/send/location`) with the tool's arguments as the JSON body.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
