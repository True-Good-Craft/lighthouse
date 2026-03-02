# Lighthouse — Source of Truth (Generated from Codebase Audit)

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that proxies a manifest endpoint, tracks daily counters in D1, exposes a token-protected report endpoint, and posts daily summary messages to Discord.
- Deployment model: Cloudflare Worker (`main = "src/index.ts"` in `wrangler.toml`).
- Runtime: Worker runtime (module worker with `fetch` and `scheduled` handlers).
- State storage mechanism: Cloudflare D1 (`DB` binding). No KV, Durable Objects, R2, or in-memory persistence for business state.
- External dependencies/services:
  - Manifest HTTP endpoint from `MANIFEST_URL`.
  - Discord webhook endpoint from `DISCORD_WEBHOOK_URL`.

## 2. Entry Points

### Worker handlers

1) `fetch(request, env)` in `src/index.ts`

- Route: `GET /update/check`
- Method: `GET` only
- Expected headers:
  - Optional: `CF-Connecting-IP` (used only to skip counting when equal to `IGNORED_IP`)
- Authentication method: none
- Response format:
  - `200` JSON manifest body (`application/json`) when upstream manifest fetch succeeds.
  - `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when manifest fetch fails.
- Failure modes:
  - D1 increment failure for `update_checks` is tolerated; request continues.
  - If tolerated counter write failed, worker attempts best-effort increment of `errors`.
  - Manifest fetch failure returns `503`.

- Route: `GET /download/latest`
- Method: `GET` only
- Expected headers:
  - Optional: `CF-Connecting-IP` (used only to skip counting when equal to `IGNORED_IP`)
- Authentication method: none
- Response format:
  - `302` redirect to manifest-derived URL:
    - `manifest.latest.download.url`, else
    - `manifest.latest.url`
  - `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` if manifest fetch fails or URL is missing/invalid.
- Failure modes:
  - D1 increment failure for `downloads` is tolerated; request continues.
  - If tolerated counter write failed, worker attempts best-effort increment of `errors`.
  - Manifest fetch/shape failure returns `503`.

- Route: `GET /report`
- Method: `GET` only
- Expected headers:
  - Required: `X-Admin-Token`
- Authentication method:
  - Header equality check: `token === env.ADMIN_TOKEN`
- Response format:
  - `200` JSON:
    - `today`
    - `yesterday`
    - `last_7_days`
    - `month_to_date`
    each containing `{ update_checks, downloads, errors }`
  - `401` JSON `{ "ok": false, "error": "unauthorized" }` on missing/invalid token or missing `ADMIN_TOKEN`.
- Failure modes:
  - D1 query errors are not caught in this route; exception propagates as Worker runtime error response.

- Route: fallback (all other paths/methods)
- Method: any non-matching request
- Authentication method: not applicable
- Response format:
  - `404` JSON `{ "ok": false, "error": "not_found" }`
- Failure modes: none additional in code.

2) `scheduled(_event, env)` in `src/index.ts`

- Trigger: cron (`0 9 * * *` from `wrangler.toml`)
- Expected headers: not applicable
- Authentication method: not applicable
- Behavior:
  - Queries D1 for yesterday, last 7 days, and month-to-date totals.
  - Builds a text report.
  - Posts to `DISCORD_WEBHOOK_URL` as JSON `{ "content": "..." }`.
- Failure modes:
  - If D1 aggregate query fails: best-effort increment of `errors`; exits without posting.
  - If Discord POST fails/non-OK: best-effort increment of `errors`.

### Webhook endpoints / event listeners / Durable Objects

- Webhook endpoint exposed by Lighthouse: none.
- Event listeners beyond Worker `fetch` and `scheduled`: none.
- Durable Object classes: none.

## 3. State & Persistence

### D1 database

- Binding: `DB`
- Table: `metrics_daily`
- Schema:
  - `day TEXT PRIMARY KEY`
  - `update_checks INTEGER NOT NULL DEFAULT 0`
  - `downloads INTEGER NOT NULL DEFAULT 0`
  - `errors INTEGER NOT NULL DEFAULT 0`
- Key naming convention:
  - Day key format: UTC date string `YYYY-MM-DD` from `toISOString().slice(0, 10)`.
- TTL behavior:
  - No TTL logic present.
- Write patterns:
  - `incrementCounter` performs:
    1. `INSERT ... ON CONFLICT(day) DO NOTHING`
    2. `UPDATE metrics_daily SET <column> = <column> + 1 WHERE day = ?`
  - Counters written from:
    - `/update/check` (`update_checks`)
    - `/download/latest` (`downloads`)
    - Error paths (`errors`)
- Read patterns:
  - `queryTotals(startDay, endDay)` executes range sums with `SUM(...)` and `COALESCE(...,0)`.
  - Used by `/report` and `scheduled`.

### Environment variables and secrets

- `MANIFEST_URL` (used for manifest proxy fetch)
- `DISCORD_WEBHOOK_URL` (used for scheduled Discord POST)
- `ADMIN_TOKEN` (used for `/report` authorization)
- `IGNORED_IP` (optional; suppresses counting for matching client IP)

### KV / Durable Objects / R2

- KV namespaces: none.
- Durable Objects: none.
- R2 buckets: none.

## 4. Authentication & Authorization Model

- Header validation:
  - `/report` requires `X-Admin-Token` and compares to `env.ADMIN_TOKEN`.
- Origin checks: none.
- Token validation:
  - Exact string equality check only.
- Secret handling:
  - Secrets are read from `env` and used directly in request handling.
- Rate limiting: none.
- IP filtering:
  - No access-control IP filtering.
  - `IGNORED_IP` affects metric counting only.

## 5. Metrics & Counters

- Storage location: D1 table `metrics_daily`.
- Counters tracked:
  - `update_checks`
  - `downloads`
  - `errors`

For each counter:

- `update_checks`
  - Increment logic: `incrementCounter(DB, today, "update_checks")`
  - Trigger source: `GET /update/check` when `CF-Connecting-IP` is not equal to `IGNORED_IP`
  - Reporting method: included in `/report` and scheduled Discord summaries via `queryTotals`

- `downloads`
  - Increment logic: `incrementCounter(DB, today, "downloads")`
  - Trigger source: `GET /download/latest` when `CF-Connecting-IP` is not equal to `IGNORED_IP`
  - Reporting method: included in `/report` and scheduled Discord summaries via `queryTotals`

- `errors`
  - Increment logic: `incrementCounter(DB, today, "errors")` in best-effort error paths
  - Trigger source:
    - Counter-write failures in HTTP handlers
    - Scheduled D1 query failure
    - Scheduled Discord POST failure/non-OK
  - Reporting method: included in `/report` and scheduled Discord summaries via `queryTotals`

## 6. External Integrations

- Manifest API fetch
  - Endpoint: `MANIFEST_URL`
  - Authentication method: none in code
  - Payload schema (expected response): JSON object; for download redirect expects either `latest.download.url` or `latest.url`
  - Retry logic: none
  - Error handling strategy: failures return `null` from `fetchManifest`; HTTP routes return `503 manifest_unavailable`

- Discord webhook
  - Endpoint: `DISCORD_WEBHOOK_URL`
  - Authentication method: webhook URL secret itself (no additional auth headers in code)
  - Payload schema: `{ "content": "<formatted daily report>" }`
  - Retry logic: none
  - Error handling strategy: on failure/non-OK response, best-effort increment of `errors`; no rethrow

- GitHub API usage: none.
- Cloudflare API usage (from application code): none.

## 7. Configuration Model

- Required environment/bindings for full behavior:
  - `DB`
  - `MANIFEST_URL`
  - `DISCORD_WEBHOOK_URL`
  - `ADMIN_TOKEN`
- Optional environment variable:
  - `IGNORED_IP`
- Default fallbacks:
  - No in-code default fallback values for these environment variables.
  - In repository `wrangler.toml`, `MANIFEST_URL` has a configured value.
- Hardcoded constants in code/config:
  - Routes: `/update/check`, `/download/latest`, `/report`
  - Error strings: `manifest_unavailable`, `unauthorized`, `not_found`
  - Status codes: `302`, `401`, `404`, `503`
  - Cron expression: `0 9 * * *`
  - Content type used for manifest and Discord POST: `application/json`

## 8. Failure Behavior

### `GET /update/check`

- If storage fails (`update_checks` increment): request continues; manifest fetch still attempted.
- If secrets missing: no secret required for this route.
- If upstream manifest fails: returns `503` JSON `manifest_unavailable`.
- Fail open vs fail closed:
  - Metrics persistence: fail open.
  - Manifest serving: fail closed (`503` when unavailable).

### `GET /download/latest`

- If storage fails (`downloads` increment): request continues; manifest fetch still attempted.
- If secrets missing: no secret required for this route.
- If upstream manifest fails or URL unavailable: returns `503` JSON `manifest_unavailable`.
- Fail open vs fail closed:
  - Metrics persistence: fail open.
  - Redirect resolution: fail closed (`503` when unavailable).

### `GET /report`

- If storage fails (D1 read/query failure): exception is not handled in route and propagates.
- If secrets missing (`ADMIN_TOKEN`): authorization check fails and returns `401 unauthorized`.
- If upstream fails: no upstream call in this route.
- Fail open vs fail closed:
  - Authentication: fail closed (`401` on missing/invalid token).

### `scheduled` cron

- If storage fails (aggregate query): best-effort increment `errors`; function returns.
- If secrets missing (`DISCORD_WEBHOOK_URL`): webhook POST attempt fails and is handled in catch.
- If upstream fails (Discord non-OK/network error): best-effort increment `errors`; no retry.
- Fail open vs fail closed:
  - Reporting delivery: fail closed for that run (no successful post).

## 9. Observability

- Logging strategy: no logging statements present.
- Console usage: none (`console.log/error` not used).
- Structured logs: none.
- Debug flags: none.
- Monitoring hooks: none.

## 10. Security Surface Summary

- Public attack surface:
  - `GET /update/check` (unauthenticated)
  - `GET /download/latest` (unauthenticated)
  - `GET /report` (token-protected)
- Protected endpoints:
  - `/report` protected by `X-Admin-Token` == `ADMIN_TOKEN`.
- Secret exposure risks (from code behavior):
  - `ADMIN_TOKEN` and `DISCORD_WEBHOOK_URL` are consumed from env; no explicit logging of these values in code.
- Replay attack risks:
  - `/report` uses a static bearer-style header token with no nonce/timestamp challenge in code.
- Rate limit presence/absence:
  - No rate limiting logic present.

## 11. Known Dead Code or Unused Modules

- Repository module layout:
  - Single implementation file `src/index.ts`; all declared helper functions are referenced.
- Unreferenced functions: none identified.
- Unused exports: none identified.
- Legacy code blocks: none clearly marked in code.
- Experimental branches: none clearly marked in code.

## 12. Determinism & Guarantees

- Determinism:
  - Not fully deterministic; behavior depends on external HTTP responses (`MANIFEST_URL`, Discord webhook), runtime time (`new Date()`), and mutable D1 state.
- External time reliance:
  - Yes, UTC day and month boundaries are used for keys and reporting windows.
- Eventual consistency reliance:
  - Implementation not clearly defined in current codebase.
- Race conditions possible:
  - No explicit transaction wraps the insert+update sequence in `incrementCounter`; operations are issued as separate statements.

## 13. Deployment Model

- Wrangler config:
  - `name = "buscore-lighthouse"`
  - `main = "src/index.ts"`
  - `compatibility_date = "2026-02-26"`
- Bindings:
  - D1 binding `DB` to database `buscore-lighthouse` with configured `database_id`
  - Variable `MANIFEST_URL` under `[vars]`
- Routes:
  - No Cloudflare route mappings declared in `wrangler.toml`.
- Environments (dev/stage/prod):
  - No explicit `[env.*]` sections present.
- Cron triggers:
  - `[triggers] crons = ["0 9 * * *"]`
- CI/CD workflow:
  - No CI/CD workflow files present in repository.

## 14. Summary of System Intent (Derived from Code)

- What Lighthouse actually does today:
  - Proxies an update manifest (`/update/check`).
  - Redirects latest download URL resolved from manifest (`/download/latest`).
  - Tracks daily `update_checks`, `downloads`, and `errors` in D1.
  - Exposes aggregated report data at `/report` with admin token header.
  - Posts daily aggregate summaries to Discord on cron schedule.

- What it does NOT do:
  - Does not implement OAuth/session auth.
  - Does not implement rate limiting or origin/IP allowlist authorization.
  - Does not use KV, Durable Objects, or R2.
  - Does not implement retry/backoff for external HTTP calls.
  - Does not emit logs/metrics to an external observability system.

- What appears planned but not implemented:
  - Present but not referenced: none clearly indicated by code or repository metadata.

# Implementation Ambiguities

- Whether D1 read/write consistency guarantees (including cross-request timing semantics) meet strict strong consistency is not specified by this codebase itself.
- Operational secret provisioning source of truth is split between repository examples and deployment environment; code requires env bindings but deployment-time secret management files are not present in repository.
