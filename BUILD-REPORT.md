# chatport — Build Report

MCP Rebuild 1000, Tranche Batch 4 (builder 1 of 8). Clean-room
rebuild of samihalawa/whatsapp-go-mcp (candidate
ai.smithery/samihalawa-whatsapp-go-mcp, rank 120, 6 stars, tier C),
built from the public README spec captured in
`harness/fixtures/whatsapp-go-mcp-tools-original.json`. That
fixture is docs-derived: the README's "Available MCP Tools"
section documents exactly 4 tools with one-line descriptions and
no argument schemas, so the schemas in the fixture are documented
reconstructions, labelled exactly that in the fixture `_source`.
Parity proves the rebuild matches this program's defined spec,
labelled docs-derived. Local build only — nothing pushed or
published.

Identity: repo `chatport`, npm `@reneturcios/chatport`,
MCP name `io.github.CloudCorpRecords/chatport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `chatport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "WhatsApp messaging via a GoWA REST
  service: send text, contacts, links, and locations." = **86 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/chatport:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/chatport"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`send-text`, `send-contact`,
  `send-link`, `send-location`, `mcp`, `--version`; exit 2 usage /
  1 API error), `src/mcp.ts`, `src/types.ts`, `src/chatport.ts`
  (core logic, `VERSION = "0.1.0"`)
- `test/chatport.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to chatport)

## Tools implemented (4)

`whatsapp_send_text`, `whatsapp_send_contact`,
`whatsapp_send_link`, `whatsapp_send_location` — the full
documented set, as recorded in the fixture `_source`, with the
reconstructed schemas:

- `whatsapp_send_text`: `{phone: string (req), message: string (req)}`
- `whatsapp_send_contact`: `{phone: string (req), contact_name: string (req), contact_phone: string (req)}`
- `whatsapp_send_link`: `{phone: string (req), link: string (req), caption: string (optional)}`
- `whatsapp_send_location`: `{phone: string (req), latitude: number (req), longitude: number (req)}`

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the defined spec
  and break exact schema parity. Zod still validates every
  `tools/call`. Tool descriptions in tools/list are the README's
  one-line descriptions verbatim ("Send text messages", etc.).
- Upstream is a self-hosted GoWA (go-whatsapp-web-multidevice)
  REST service. The base URL comes from `WHATSAPP_API_URL`
  (e.g. `http://localhost:3000`, trailing slashes stripped). There
  is deliberately **no default**: a missing or blank value throws a
  named error before any request is attempted, in both the core
  functions and (via the same path) the CLI/MCP faces.
- **Endpoint mapping is a documented reconstruction** from the
  GoWA REST API pattern (the original README does not document
  endpoints): each tool POSTs a JSON body carrying its argument
  names —
  `POST /send/message` `{phone, message}`;
  `POST /send/contact` `{phone, contact_name, contact_phone}`;
  `POST /send/link` `{phone, link, caption?}` (caption key sent
  only when a non-blank caption is supplied);
  `POST /send/location` `{phone, latitude, longitude}`.
  GoWA deployments differ in some payload details (e.g. address-book
  field naming); those variants are unverified — see Gaps.
- Validation runs before any request: required strings must be
  non-blank; latitude must be a finite number in [-90, 90] and
  longitude a finite number in [-180, 180].
- Successful calls return the GoWA service's JSON response payload
  as-is. HTTP failures surface the status plus the upstream
  `message` or `error` string when present; network failures are
  wrapped with context.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written GoWA-shaped
  JSON fixtures; no live call is made anywhere in this build.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
(verified from the run's own process log) `dist/` produced,
including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 14
ℹ pass 14
ℹ fail 0
```
Covers: missing/blank `WHATSAPP_API_URL` rejected by
`resolveBaseUrl`; trailing-slash stripping; missing-env error
raised before any request (spy fetch never called); request
shaping per tool (URL, POST method, JSON content type, exact body)
for text, contact, link with caption, link without caption (key
omitted), and location with numeric coordinates; custom base URL;
validation errors (blank phone, blank message, blank
contact_phone, latitude 91, longitude -181, NaN latitude — all
before any request); HTTP 500 surfacing the upstream message;
network failure wrapping.

### 3. CLI / MCP smoke
`node dist/cli.js --version` → `0.1.0` (exit 0); unknown command
exits 2 with Usage; `send-text` with `WHATSAPP_API_URL` empty exits
1 with `error: WHATSAPP_API_URL is not set: ...`. MCP behaviour is
exercised by the parity harness below (initialize + tools/list
over stdio). No live GoWA call was made in smoke — no GoWA service
exists in this environment, and no live result is claimed.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/whatsapp-go-mcp-tools-original.json \
    --rebuild "stdio:node .../builds/chatport/dist/cli.js mcp" \
    --out .../builds/chatport/parity-out
verdict=PASS parity_pct=100.0 original_tools=4 rebuild_tools=4 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 4/4.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was generated clean via Route 3: a temp dir
(`/tmp/chatport-lock/`) holding only `package.json` (no
`node_modules`), offline
`npm install --package-lock-only --ignore-scripts`, verified after
generation — parses as JSON, top-level `name` is
`@reneturcios/chatport`, version `0.1.0`, `lockfileVersion` 3,
**128 package entries** — then only the lockfile was copied back
(sha256 prefix of the temp and copied files match:
`98550cc56b77584d`). Local `node_modules` is a sibling copy
(fxrates) used only for the local build/test; it is not part of
the lockfile generation.

## Gaps / honest notes

- Docs-derived spec: the README documents tool names and one-line
  descriptions only. The argument schemas, the GoWA endpoint
  mapping (`/send/message`, `/send/contact`, `/send/link`,
  `/send/location`), and the JSON body field names are documented
  reconstructions from the program spec and the GoWA REST API
  pattern — no original whatsapp-go-mcp server was probed, so
  parity proves the rebuild matches this program's defined spec,
  not a hand-probed original.
- No live call was made: every endpoint is fake-fetch tested only,
  so live GoWA payload/response-shape drift (including any auth
  header or device-id requirements a particular GoWA deployment
  may impose) is unverified until the publish wave.
- Phone-number format is passed through exactly as given; any
  normalisation a GoWA deployment expects (country code, JID
  suffixes) is the caller's responsibility and is stated in the
  README.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
