# Wajo Fo integration evidence

Inspected live on **October 17, 2026**. No booking, call, message, or purchase was attempted.

## What was verified

`https://mcp.api.wajo.ai/fo` accepted a JSON-RPC `initialize` request with protocol `2025-03-26` and returned a `text/event-stream` response. The server identifies itself as `wajo-fo`, version `0.1.0`. Public `tools/list` discovery returned these schemas:

| Tool                    | Actual input                                                       | Actual output                                                                          |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `ask_fo`                | Required `message`; optional `conversationId` OR `newConversation` | Required `status`, `conversationId`; optional `response`, `progress`, `elapsedSeconds` |
| `get_fo_reply`          | Optional `conversationId`, `waitSeconds` (integer 0–40)            | Required `response`, `status`, `conversationId`; optional `progress`, `elapsedSeconds` |
| `get_fo_conversation`   | Required `conversationId`                                          | `conversation` metadata and optional recent `turns`                                    |
| `list_fo_conversations` | Empty object                                                       | Optional `conversations` array                                                         |
| `start_fo_call`         | Empty object                                                       | Required `joinUrl`, `expiresAt`                                                        |

Task statuses are `working`, `complete`, `failed`. A conversation identifier is a server-issued internal handle; it is never guessed or returned through the public booking serializer. `complete` means a Fo turn completed. **No discovered field provides structured reservation confirmation evidence.** DayMade therefore maps a completed turn to `requires_user_action`, even if its free-form text says “confirmed.”

## Authentication evidence

Calling the read-only `list_fo_conversations` tool without a credential returned:

```text
HTTP 401
WWW-Authenticate: Bearer resource_metadata="https://mcp.api.wajo.ai/.well-known/oauth-protected-resource/fo"
{"error":"missing api key"}
```

The advertised [protected resource metadata](https://mcp.api.wajo.ai/.well-known/oauth-protected-resource/fo) lists the `mcp` scope, header bearer authentication, and `https://mcp.api.wajo.ai` as its authorization server. The error wording does **not** establish how to obtain a standalone API key; DayMade does not invent a `WAJO_API_KEY` variable.

The [OAuth authorization server metadata](https://mcp.api.wajo.ai/.well-known/oauth-authorization-server) advertises:

- Authorization endpoint: `/oauth/authorize`
- Dynamic client registration: `/oauth/register`
- Token endpoint: `/oauth/token`
- Grants: `authorization_code`, `refresh_token`
- Response type: `code`
- PKCE: `S256`
- Token endpoint authentication method: `none`

DayMade implements the advertised OAuth 2.1 flow using the official MCP SDK. The browser's consent applies to general Fo MCP account access; DayMade separately gates business actions behind exact user approvals.

## Implemented flow

- `/connections/fo` starts dynamic client registration and PKCE S256. The callback consumes an expiring, guest-bound state once and validates the registered return origin. Production requires `DAYMADE_APP_URL` as a fixed HTTPS origin; localhost HTTP is development-only.
- Supabase stores per-guest credentials encrypted with AES-256-GCM, using the guest owner hash as authenticated data. `FO_TOKEN_ENCRYPTION_KEY` stays on the server and must remain stable. Tokens, code verifiers, and client registration details never enter public responses.
- The MCP/OAuth transport pins requests to `mcp.api.wajo.ai`, rejects redirects for credential-bearing requests, and supports refresh tokens. The interactive sign-in flow cannot begin from a booking request.
- `POST /api/fo/check` invokes authenticated `list_fo_conversations` and discards the result contents. No business is contacted.
- The approval dialog selects one venue, shows exact date/time/party/address, optional reservation name and callback number, and a $0 maximum spend. A checkbox and separate submit action authorize only this request.
- A database transaction locks the owner action stream and the reviewed itinerary before saving the approval. Uniqueness prevents retries with new keys from resending an action. Approved itineraries cannot be edited. Another owner action cannot start while a prior action is working or has an uncertain outcome without a conversation identifier.
- Only after the approval commit does the adapter call `ask_fo` with `newConversation: true`. The prompt asks Fo to call the business if necessary, identify itself as an AI assistant, request the specified reservation, and stop for anything beyond the approved details. No payment, deposit, purchase, cancellation, or other personal-data sharing is authorized.
- `Check Fo’s progress` explicitly calls `get_fo_reply` with `waitSeconds: 0`. There is no automatic repeated polling, and no automatic follow-up message. Completed responses require manual review. Follow-up questions and additional approvals are handled in Wajo.
- Network uncertainty is recorded and never retried automatically. A crash between the durable claim and external submission leaves a requested record for manual review, rather than risking a duplicate.
- Disconnect deletes the local encrypted credentials. It does not cancel an external task or revoke Wajo-side consent; users may also revoke DayMade in Wajo.

## Setup and verification

Apply `supabase/migrations/001_daymade.sql`, then `002_fo_oauth_and_action_locking.sql`. Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), and `FO_TOKEN_ENCRYPTION_KEY`. See `.env.example`.

Live Wajo OAuth consent, the callback token exchange, and the authenticated read-only connection check passed in the browser on October 17, 2026. No calls or reservation requests were made.

Both migrations were applied to the configured project. `node --env-file=.env.local scripts/verify-storage.mjs` passed live checks for concurrent deduplication, stale approvals, owner isolation, plan locking, and a single active request. Its isolated temporary records were removed. It never calls Fo.

Run `npm run fo:inspect` for public tool discovery. A real phone call or reservation remains a separate, explicit user-approved test. Arbitrary booking-platform support, telephone reachability, provider-side limitations, refresh-token rotation under concurrent requests, and a structured confirmation-evidence contract still need validation. Do not expose `confirmed` based on free-form Fo text.
