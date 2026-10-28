# Mystery Drop

`/mystery-drop` collects interests, categories, exclusions, condition, a USD limit, delivery notes, and optional style preferences. The server uses the existing Claude connection and Anthropic web search to find real listing pages, then validates the candidate links against returned search citations, keeps candidates with known totals under the hard budget, and stores the resulting price/evidence snapshot in `mystery_drops`. Guest ownership uses the existing `daymade_guest` cookie hash. Apply `supabase/migrations/003_mystery_drops.sql` in the Supabase SQL Editor for persistent storage. In local development, the existing in-memory storage convention is used; it is ephemeral.

If saving reports that storage is not installed, migration `003_mystery_drops.sql` has not run on the configured Supabase project (or its schema cache has not refreshed). Apply the migration there and retry. A permission-specific error means the server-side `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) is missing the required service privileges; do not put that key in the browser.

The exact item is shown before any purchase authorization. Unknown tax or shipping is displayed as unknown and the candidate is marked non-purchaseable. The development-only **Load safe simulated preview** control uses fictional sample data and makes no network request.

## Fo limitation

The Fo tool discovery recorded in `docs/fo-integration.md` lists `ask_fo`, `get_fo_reply`, `get_fo_conversation`, `list_fo_conversations`, and `start_fo_call`. The schemas cover conversation and call workflows. They do not expose virtual card creation, card limits or merchant locks, card status, payment execution, transaction lookup, or card deactivation. Fo is not used for product research or checkout. The adapter returns these missing capabilities as unavailable and the approval endpoint fails closed. The confirmation button is disabled, no payment request can be initiated, and no purchase is claimed.

The currently required environment settings are the existing `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and Supabase variables from `.env.example`. No new Fo payment credential or endpoint is invented. A real end-to-end purchase requires Fo to document and expose a bounded payment workflow, merchant checkout support, transaction evidence, and suitable account credentials; after that, the adapter and state machine need an implementation and integration tests before enabling approval.

## Safe walkthrough

1. Start the app locally with the existing Claude credentials, then open `/mystery-drop`.
2. Select **Load safe simulated preview** to inspect the interface with fictional data; its result is explicitly labeled and cannot be authorized.
3. To test live discovery, enter interests and a strict total limit and choose **Find my drop**. The returned listings and unknown charges are shown for review only. The purchase action stays unavailable because the Fo checkout capability is absent.
