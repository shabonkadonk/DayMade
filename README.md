# DayMade

**Describe your perfect day. We’ll help make it happen.**

DayMade turns a natural-language idea into a researched, structured day plan. Claude researches places with web search, assembles an itinerary, and checks the schedule against the requested time window and total party budget. An interactive timeline supports individual replacements, removals, and conversational refinement. Real-world arrangements are a separate, explicitly approved workflow through Wajo Fo.

Built for the **October 17–19, 2026 Wajo GSD Hackathon**, supported by Anthropic. The supplied submission deadline is October 19 at 10:15 AM Pacific; submission is a quote-post on Wajo’s MCP launch announcement on X. No submission or deployment is automated by this project.

## Status: what actually works

| Capability                                                                                 | Status                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Responsive homepage, prompt suggestions, preference controls                               | Implemented                                                                                                                         |
| Private itinerary workspace, timeline, budget/travel summaries, source links               | Implemented                                                                                                                         |
| Claude venue research and structured planning                                              | Implemented; live planning verified against Anthropic with the Madison vegetarian-meal request on October 17, 2026                  |
| Targeted activity replacement, whole-plan refinement, removal                              | Implemented; AI changes require credentials; removal does not call AI                                                               |
| Schedule, travel-gap, budget, and output validation                                        | Implemented and tested                                                                                                              |
| Approval review, immutable action snapshot, no-payment authorization, duplicate protection | Implemented and tested with controlled doubles                                                                                      |
| Wajo transport and actual tool discovery                                                   | Verified against the live endpoint on October 17, 2026                                                                              |
| Authenticated Wajo action and status adapter                                               | Wired into owner-scoped routes with explicit approval and durable deduplication                                                     |
| Wajo per-user OAuth, refresh-token storage, live booking execution                         | Live OAuth and authenticated read-only check passed; encrypted tokens and approval-gated execution implemented; no real call placed |
| Supabase persistence and distributed rate-limit function                                   | Both migrations applied; live owner/locking/deduplication checks passed                                                             |
| Development persistence                                                                    | Explicit, process-local memory; expires after 24 hours or server restart; never enabled in production                               |
| Mapbox map and temporary address geocoding                                                 | Implemented; requires public token; only high-confidence address matches plotted; live token not tested here                        |
| Purchases, deposits, cancellations, automatic confirmed bookings                           | Unsupported; no payment is authorized or executed                                                                                   |
| Mystery reveals, verified routes/hours, calendar sync, user accounts                       | Planned                                                                                                                             |

**There are no hardcoded itineraries in application code.** Missing configuration returns a structured error. Mock venues exist only in `tests/` and the explicitly launched test provider. A completed Fo task is never treated as a confirmed reservation.

## Stack

Next.js App Router and TypeScript; React; Tailwind CSS v4; locally owned Radix/shadcn-style Button and Dialog primitives, with `components.json` configured for future shadcn additions; Lucide; Motion for React; official Anthropic TypeScript SDK; official MCP SDK; Zod; Mapbox GL JS; Supabase PostgreSQL; Vitest. Exact installed versions are recorded in `package-lock.json`.

Typography pairs a self-hosted Geist font with an editorial system serif. Images are local editorial inspiration photography, not representations of a generated venue or evidence of availability.

## Local setup

Use Node.js **22.18+** (or a current supported LTS) and npm. The Node version is relevant to the optional TypeScript-based test provider.

```bash
npm ci
cp .env.example .env.local
# Fill ANTHROPIC_API_KEY and ANTHROPIC_MODEL in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The interface can be explored without credentials; generating a plan will show a configuration-required state. Do not paste secrets into the browser.

If an existing npm cache has root-owned files, use `npm ci --cache /tmp/daymade-npm-cache` instead of changing global ownership. Original root-owned starter directories encountered during initialization were preserved under ignored `.daymade-backup-*` names; they are not part of the application or build.

## Environment variables

Copy `.env.example`. Never commit `.env.local`.

| Variable                          | Purpose                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`               | Required server-only Claude API key                                                              |
| `ANTHROPIC_MODEL`                 | Required explicit model ID; choose one available in your Console                                 |
| `FO_TOKEN_ENCRYPTION_KEY`         | Required 32-byte encryption key as 64 hex characters; keep stable and server-only                |
| `DAYMADE_APP_URL`                 | Required canonical HTTPS app origin in production; local development infers localhost origin     |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Optional public Mapbox token; restrict allowed URLs in Mapbox                                    |
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase project URL; required for production storage                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Reserved for a future authenticated browser client; currently not used                           |
| `SUPABASE_SECRET_KEY`             | Preferred server-only Supabase key (`sb_secret_...`); required for Fo and production persistence |
| `SUPABASE_SERVICE_ROLE_KEY`       | Legacy fallback server credential; never expose to the browser                                   |

No Wajo API-key requirement has been invented. The inspected server advertises OAuth bearer authentication. Its credential flow must be completed independently from a Claude connector.

### Anthropic

Use the [official SDK](https://github.com/anthropics/anthropic-sdk-typescript) and an explicitly configured model from the [official model catalog](https://platform.claude.com/docs/en/models/overview). At implementation time the current SDK’s examples include `claude-sonnet-5-5`; confirm availability for your own organization before selecting it.

DayMade pins live requests to `https://api.anthropic.com`; an inherited `ANTHROPIC_BASE_URL` cannot silently redirect the API key to a gateway. The separate `DAYMADE_TEST_ANTHROPIC_BASE_URL` override is restricted to localhost in development/tests and rejected in production.

Each planning/refinement request makes two server-side operations:

1. Research through Claude’s documented `web_search_20250305` server tool (maximum four searches across at most three bounded research turns, including `pause_turn` continuations).
2. Generate using `messages.parse` and `zodOutputFormat`, then validate again against Zod and application constraints. If these fail, make one repair attempt against the same evidence and unchanged constraints; surface the specific remaining failure.

Enable web search in your Anthropic organization. A model or account without web-search or structured-output support fails honestly. Generated source links must match URLs actually returned by research. The model never provides map coordinates. Costs, hours, travel times, and reservation requirements remain estimates; research is not a live availability check. Venue relevance still depends on the model’s interpretation of retrieved sources.

Read [Anthropic structured output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). The model wire schema omits coordinates, keeping it compatible with the supported JSON Schema subset.

### Wajo Fo

See [the integration evidence and remaining setup](docs/fo-integration.md). Public MCP discovery, all five actual schemas, HTTP 401 behavior, and OAuth metadata were inspected. No external action was attempted.

```bash
npm run fo:inspect
```

This only initializes MCP and lists schemas. The adapter supports `ask_fo` and `get_fo_reply` with their actual parameters. Open `/connections/fo` to sign into Wajo, review its general MCP account scope, and test the connection with an authenticated read-only tool. OAuth tokens are encrypted on the server and bound to the guest. Neither a shared developer credential nor a Claude connection is reused for guests.

The approval workflow authorizes contacting one selected venue to request a reservation, with a **$0 maximum authorized spend**. It cannot authorize payment. The optional reservation name and callback number are shared only when entered and explicitly approved for that venue; no other personal information is authorized. The execution adapter commits a durable approval before sending the request. Requests with uncertain outcomes require manual review and are not automatically retried.

### Supabase

Create a Supabase project and run [the initial migration](supabase/migrations/001_daymade.sql) and then [the Fo migration](supabase/migrations/002_fo_oauth_and_action_locking.sql) in the SQL editor. Set the URL and server secret key (or legacy service-role key), then restart. Generate `FO_TOKEN_ENCRYPTION_KEY` once; see `.env.example`.

- `itineraries` stores the versioned itinerary, activities, source links, and timestamps as one JSON document.
- `bookings` stores the exact approved action, approval time, zero-spend limit, status, and external task handle in a server-only payload.
- Unique constraints protect both the approval idempotency key and `(itinerary_id, activity_id)`, so changing a key or revision cannot repeat an action.
- `request_limits` and `daymade_rate_limit` implement atomic, shared limits across serverless instances.
- Row-level security is enabled. Browser roles receive **no direct access**. All API queries explicitly bind records to the hash of an opaque, HttpOnly guest-session cookie. Only the service role accesses the tables.

Clearing the guest cookie loses access to those guest plans; account recovery and cross-device access are not implemented. `SameSite=Lax`, secure production cookies, same-origin mutation checks, request-size limits, and generic errors protect API boundaries. IDs alone do not grant access.

Without Supabase, **development only** uses a bounded, process-local map (500 plans, 24-hour lifetime). Data is lost when the process restarts and may be lost during hot reload. The UI identifies this storage mode. Production requests fail closed when storage is not configured. The configured project passed live storage checks. Run `node --env-file=.env.local scripts/verify-storage.mjs` to verify another project using isolated temporary records; it never invokes Fo.

### Mapbox

Set the public token and restart/rebuild. The client dynamically loads Mapbox and geocodes researched street addresses using the [documented Geocoding v6 API](https://docs.mapbox.com/api/search/geocoding/). Only `exact` or `high` confidence results appear. Markers show itinerary order and respond to timeline selection. Missing tokens, failed geocoding, invalid tokens, unsupported WebGL, and map failures have an explicit fallback.

Geocoding results are temporary, held only in component memory and never persisted or cached. Only addresses from the saved plan are submitted to Mapbox. No route lines or verified travel durations are fabricated. Mapbox’s address geocoder does not cover arbitrary points of interest; unmatched venues remain absent from the map.

## Architecture

```text
app/
  page.tsx                   Planning homepage
  plan/[id]/                 Private itinerary workspace + loading boundary
  api/plan/                  Research and generate
  api/plan/refine/            Replace, remove, or refine
  api/itineraries/[id]/       Owner-scoped retrieval
  api/bookings/              Approval-gated action submission (currently unavailable)
  api/bookings/[id]/          Owner-scoped stored status; live refresh unavailable
  api/status/                Configuration booleans only
components/
  home/                      Composer, suggestions, preference dialog
  itinerary/                 Timeline, activity cards, map, workspace
  booking/                   Action review and unavailable-state dialog
  layout/                    Navigation and footer
  ui/                        Locally owned Radix/shadcn-style primitives
lib/
  ai/                        Anthropic client, prompts, research and structured planner
  fo/                        Typed MCP transport and replaceable FoService
  itinerary/                 Zod models, deterministic calculations and constraints
  bookings/                  Approval policy, state rules and idempotent orchestration
  db/                        Supabase/memory repositories and storage policy
  api/                       Sessions, bounded input, rate limiting and safe errors
supabase/migrations/         Schema, RLS and atomic rate-limit function
scripts/inspect-fo.mjs       Non-mutating live MCP discovery
tests/                     Business, security, provider, and repository tests
```

No integration logic reaches the browser. Server-only modules enforce this boundary. The planner does not depend on MCP; the booking service does not depend on UI components. Targeted replacement keeps untouched activities and plan constraints from the saved version instead of trusting regenerated copies. Revision checks reject stale edits and approvals.

## HTTP API

All mutation bodies use JSON. Private endpoints require the guest-session cookie set by `POST /api/plan`. Rate limits are eight planning/action requests per minute per session and thirty per client IP. On self-hosted deployments, use a trusted reverse proxy that overwrites forwarded IP headers; add platform-level abuse controls for a public launch.

| Endpoint                             | Behavior                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/plan`                     | `{ prompt, preferences }`; returns `201` with itinerary and storage mode                                                                                                              |
| `POST /api/plan/refine`              | `{ itineraryId, revision, instruction, activityId?, operation? }`; operation is `refine` or `remove`                                                                                  |
| `GET /api/itineraries/[id]`          | Returns only the current guest’s plan                                                                                                                                                 |
| `POST /api/bookings`                 | Requires exact action, `consent: true`, `maximumSpend: 0`, activity, revision and UUID idempotency key; executes only after per-guest Wajo OAuth and an atomic durable approval claim |
| `GET /api/bookings/[id]`             | Returns stored status without the internal Fo conversation ID                                                                                                                         |
| `POST /api/bookings/[id]`            | Explicitly refreshes an owned in-progress request through Fo; does not resubmit it                                                                                                    |
| `GET /api/itineraries/[id]/bookings` | Reloads stored requests for the current guest and itinerary                                                                                                                           |
| `POST /api/fo/connect`               | Starts per-guest PKCE OAuth; returns the trusted Wajo authorization URL                                                                                                               |
| `GET /api/fo/callback`               | Consumes a guest-bound, expiring state once and exchanges the code                                                                                                                    |
| `GET /api/fo/status`                 | Returns connection readiness without credentials                                                                                                                                      |
| `POST /api/fo/check`                 | Tests authenticated read-only access; discards conversation content                                                                                                                   |
| `POST /api/fo/disconnect`            | Deletes locally stored credentials; does not cancel any external requests                                                                                                             |
| `GET /api/status`                    | Non-sensitive configuration flags                                                                                                                                                     |

Errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`. Invalid requests use 400, private missing records 404, stale revisions 409, oversized requests 413, constraint failures 422, rate limits 429, provider failures 502, missing configuration 503, and timeouts 504. No raw external errors, tokens, prompts, or personal data are logged.

## Testing and quality

```bash
npm test
npm run test:watch
npm run typecheck
npm run lint
npm run format:check
npm run build
# or the combined checks:
npm run check
```

Vitest tests cover prompt hints, Zod output, official Anthropic schema compatibility, time-window and overlap checks, travel gaps, budget accounting, targeted replacement, guest isolation, stale writes, production memory refusal, same-origin checks, request bounds, provider errors, approval enforcement, unsafe payment input, state transitions, concurrent duplicates, and ambiguous action failures. External providers are controlled doubles. Tests never place reservations or make purchases.

For a reproducible **test-only** browser run without paid APIs, start the controlled provider in a separate terminal:

```bash
npm run test:provider
```

Then start a development process with the explicit localhost-only test endpoint override:

```bash
ANTHROPIC_API_KEY=daymade-test-only \
ANTHROPIC_MODEL=daymade-controlled-test \
DAYMADE_TEST_ANTHROPIC_BASE_URL=http://127.0.0.1:4100 \
npm run dev
```

Use “Plan a test day in San Francisco under $100” without overriding preferences. The resulting plan is visibly named **A test day**, uses fictional fixture venues, and exercises the real SDK → API → session storage → itinerary UI flow. Swap a stop, remove another, and review the Fo approval dialog without sending a request. Stop both processes afterward. **Never deploy this test provider or these test environment values.** Normal application code has no fixture imports or mock mode.

`npm run build` uses the supported Webpack compiler. The inherited Turbopack production CSS worker could not bind its internal port in this execution environment; the Webpack build is verified. Development still uses Next.js’s default Turbopack compiler and standard Tailwind PostCSS configuration.

The production dependency audit reports zero vulnerabilities. The full audit currently reports five high findings in the inherited **development-only ESLint → fast-glob → micromatch → braces** chain, with no patched package available from npm at implementation time. Do not apply npm’s suggested major Next.js downgrade blindly; track the upstream advisory and update when a compatible fix is published.

## Deployment on Vercel

1. Import the repository as a Next.js project.
2. Use `npm ci` to install and `npm run build` as the build command.
3. Apply the Supabase migration and set server environment variables in each intended environment.
4. Add the optional public Mapbox token with appropriate URL restrictions; public variables must be present at build time.
5. Verify planning with your own Claude account, persistence across requests, guest isolation, error states, and source relevance in the deployed preview.
6. Set `DAYMADE_APP_URL` to the deployment origin. Complete Wajo consent on that origin and run the read-only connection check. Only test a real call after reviewing and approving its precise venue, date, time, party, and contact details. A completed Fo task is not proof of a reservation.

Planning routes request a maximum duration of 180 seconds. Choose a hosting plan/runtime that supports this. The application is prepared for deployment; no Vercel project, domain, or public deployment was created.

## Next milestone

Live sourced planning has been verified against Anthropic, including the browser → API → research → structured itinerary → private retrieval flow. The exact Madison Sunday example generated three stops at $37 for one person within a $50 budget and reloaded from Supabase. Supabase is configured and live transaction checks passed. Per-user Wajo OAuth, encrypted credential storage, transactional approval locking, and explicit status refresh are implemented. A real business call still needs the user’s specific approval; no call or reservation was made during development. Establish a verified reservation-evidence contract before exposing `confirmed` in the product.

## Image credits

Local inspiration images are from Unsplash: [coast](https://images.unsplash.com/photo-1518837695005-2083093ee35b), [café](https://images.unsplash.com/photo-1445116572660-236099ec97a0), and [restaurant](https://images.unsplash.com/photo-1517248135467-4c7edcad34c4). They are editorial mood imagery and do not identify proposed venues.
