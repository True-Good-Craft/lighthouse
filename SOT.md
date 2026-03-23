# Lighthouse — Source of Truth

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-only stats source.
- Lighthouse is a generic, deterministic metrics primitive; BUS Core is a current observed client/use-case, not a runtime dependency.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, records daily Buscore traffic snapshots in D1, and exposes an admin-protected `GET /report` endpoint.
- It does not post reports to Discord.
- Runtime surface: Worker `fetch` handler plus one scheduled daily traffic capture handler.

### Version and Release Authority

Shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned in `package.json`.
No behavioral, contract, storage, configuration, auth, or scheduling change is considered released unless all three are updated together in the same change set.

### Operational Independence Rule

Operational Independence Rule: Lighthouse must remain an independently runnable service. It may observe, receive traffic from, or report on BUS Core and other systems, but its core operation must not require BUS Core or any other external service to be available. All integrations must be optional, additive, and non-blocking.

Additional constraints:
- Lighthouse is a standalone service, not an architectural submodule of BUS Core or any other product.
- External services may call Lighthouse or consume Lighthouse outputs, but no Lighthouse core feature may require those services to be up.
- Proposed features that create hard runtime dependencies on external products are out of scope unless reworked to preserve independent operation.

## 2. Architecture Invariants

The following rules are non-negotiable unless this SOT is explicitly revised:

- Lighthouse is a single Cloudflare Worker.
- Lighthouse is privacy-first and aggregate-only.
- Lighthouse is operationally independent and independently runnable.
- Core operation must not depend on BUS Core or any external service.
- Reporting is on-demand.
- Scheduled behavior is limited to one approved daily Buscore traffic capture job defined in this SOT.
- No outbound posting or outbound integrations unless explicitly approved in this SOT.
- The current fixed metric model (`update_checks`, `downloads`, `errors`) is shipped behavior unless this SOT explicitly changes it.
- Buscore traffic telemetry is an additive extension for operator visibility and system understanding; it must not break or reinterpret the shipped core metric model.
- SOT, changelog, and implementation must stay aligned.

## 3. Entry Points

`fetch(request, env)` in `src/index.ts` handles:

`scheduled(controller, env, ctx)` in `src/index.ts` handles:

### Daily Buscore Traffic Capture

- Runs once per day on a Worker cron.
- Uses one Cloudflare GraphQL Analytics API query per scheduled run.
- Always queries the previous completed UTC day.
- Never queries the current UTC day.
- Never persists rolling-window traffic snapshots.
- Uses `CF_API_TOKEN` bearer auth against `https://api.cloudflare.com/client/v4/graphql`.
- Scopes the query by `CF_ZONE_TAG` and hostname `buscore.ca`.
- On successful pull, upserts one final row into `buscore_traffic_daily` for the selected UTC day.
- Capture is idempotent per day: reruns converge to one final row for that day.
- If the Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day.
- If the query returns no daily row for the selected day and hostname, Lighthouse treats that run as failed and skips the row.
- Lighthouse validates that the chosen query response includes a numeric daily pageviews metric; if missing/undefined/non-numeric, Lighthouse treats that run as failed and skips the row.
- This scheduled traffic capture is additive and non-blocking. Lighthouse core request handling and core metric reporting remain operational if the Cloudflare pull path is unavailable.

### Manifest Service

- `GET /manifest/core/stable.json` — **Canonical public manifest read route**
  - Returns manifest JSON from `MANIFEST_R2` to web pages, downloads pages, and other clients.
  - **Never increments any counters** (no counting on success; only error counts on failure).
  - Returns `200` manifest JSON on success.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when unavailable.

- `GET /update/check` — **Manifest proxy with update check counting**
  - Returns manifest JSON from `MANIFEST_R2`.
  - Increments `update_checks` in D1 (current UTC day) **unless** request IP matches `IGNORED_IP`.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` on manifest errors.

### Download Service

- `GET /download/latest` — **Counted download initiation endpoint**
  - Increments `downloads` in D1 (current UTC day), unless the request IP matches `IGNORED_IP`.
  - Redirects (`302`) to the validated release artifact URL from `manifest.latest.download.url`.
  - Accepts either a relative release URL (for example `/releases/TGC-BUS-Core-1.0.2.zip`) or an absolute URL using the same release path format.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when URL is missing/invalid.

- `GET /releases/:filename` — **Raw asset delivery (no counting)**
  - Serves release artifacts directly from `MANIFEST_R2` using key `releases/:filename`.
  - **Never increments any counters** (ensures no double-counting after `/download/latest` redirect).
  - Allowed filename format: `TGC-BUS-Core-<semver>.zip`.
  - Returns `200` with artifact body when object exists.
  - Returns `404` JSON `{ "ok": false, "error": "not_found" }` when missing or filename is invalid.

- `GET /report`
  - Requires header `X-Admin-Token`.
  - Auth check is exact equality against `env.ADMIN_TOKEN`:
    - `const token = request.headers.get("X-Admin-Token")`
    - `if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) { ...401 unauthorized... }`
  - On auth failure: returns `401` JSON `{ "ok": false, "error": "unauthorized" }`.
  - On success: returns aggregate stats JSON with `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, and additive top-level `traffic`.
  - Before assembling the response, Lighthouse checks whether `buscore_traffic_daily` contains a row for the previous completed UTC day.
  - If the previous-day row is missing, Lighthouse attempts one best-effort capture for that exact day using the same traffic capture logic as the scheduled path.
  - If this lazy backfill attempt fails, `/report` still returns successfully using only currently stored traffic data.
  - This behavior is additive and does not replace the scheduled daily capture job.

- `GET /_dev/capture-traffic` — **Temporary development-only trigger route**
  - No auth; intended only as a short-lived debug aid.
  - Computes the previous completed UTC day only.
  - Never targets the current UTC day.
  - Calls the same shared per-day traffic capture helper used by scheduled cron and `/report` lazy backfill.
  - Does not change cron schedule, `/report` semantics, or non-traffic metric behavior.
  - Returns diagnostic JSON including `target_day`, `attempted`, `appears_successful`, `result` (`captured`/`skipped`/`failed`), and `details`.
  - Must not report success when no row exists for the target day after the attempt.

- Fallback behavior
  - `OPTIONS` returns `200`.
  - Non-`GET` methods return `405` JSON `{ "ok": false, "error": "method_not_allowed" }`.
  - Unmatched routes return `404` JSON `{ "ok": false, "error": "not_found" }`.

## 4. Persistence

- D1 binding: `DB`
- Table: `metrics_daily`
- Table: `buscore_traffic_daily`
- Aggregate counters: `update_checks`, `downloads`, `errors`
- Day key format: UTC `YYYY-MM-DD`
- `buscore_traffic_daily` schema:
  - `day TEXT PRIMARY KEY`
  - `visits INTEGER NULL`
  - `pageviews INTEGER NOT NULL`
  - `referrer_summary TEXT NULL`
  - `captured_at TEXT NOT NULL`
- `buscore_traffic_daily` stores one row per completed UTC day only.
- `pageviews` is sourced from a direct daily Cloudflare page view metric.
- `visits` is nullable in current implementation because this selected single daily query path does not use a documented direct visits metric.
- `referrer_summary` is nullable and currently stored as `NULL`.

## 5. Configuration

Required bindings/secrets used by code:

- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`
- `IGNORED_IP` — optional; if set, requests whose `CF-Connecting-IP` exactly matches this value skip counter increments but receive normal responses.
- `CF_API_TOKEN` — required for the approved daily Buscore traffic capture job.
- `CF_ZONE_TAG` — required for the approved daily Buscore traffic capture job.

Not used by current code:

- Discord webhook secrets

## 6. Reporting Model

- Reporting is on-demand only via authenticated `GET /report`.
- No outbound report delivery.
- Scheduled traffic capture is separate from report delivery and only writes one daily Buscore traffic snapshot into D1.
- `GET /report` includes a best-effort lazy backfill check for the previous completed UTC day only when that day is missing from `buscore_traffic_daily`.
- Lazy backfill reuses the same per-day capture logic as scheduled capture, remains idempotent via per-day upsert, and does not block successful report responses on capture failure.

### Report Contract Stability

- `GET /report` is an operator-facing contract, not an ad-hoc analytics surface.
- Current shipped response shape includes: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, `traffic`.
- Current shipped `trends` fields include: `downloads_change_percent`, `update_checks_change_percent`, `weekly_downloads_change_percent`, `weekly_update_checks_change_percent`, `conversion_ratio`.
- `conversion_ratio` is defined as today downloads divided by today update checks (with safe zero-denominator handling).
- `traffic.latest_day` contains the most recent completed UTC day stored in `buscore_traffic_daily` with fields `day`, `visits`, `pageviews`, `referrer_summary`.
- `traffic.last_7_days` contains aggregate traffic fields `visits`, `pageviews`, `referrer_summary` across stored rows in the last seven UTC days.
- Existing non-traffic `/report` fields remain intact and semantically unchanged.
- If a requested traffic window has no stored traffic rows, its traffic fields return `NULL` rather than synthetic zeroes.
- `traffic.pageviews` comes from a direct daily page view metric from the Cloudflare GraphQL Analytics API.
- `traffic.visits` is `NULL` in the current implementation because this approved single daily query path does not use a documented direct visits metric.
- `traffic.referrer_summary` is `NULL` in the current implementation.
- Changes to `/report` response fields or semantics require explicit SOT update and changelog entry in the same change set.

## 7. Privacy and Security

- Aggregate-only storage in D1.
- No user identifiers, cookies, or tracking.
- Traffic capture uses Cloudflare aggregate analytics only; no raw request logging is introduced.
- `/report` is protected by `X-Admin-Token` exact match to `env.ADMIN_TOKEN`.

## 8. Explicit Non-Features

- No `/health` route in current code.
- No scheduled outbound reporting.
- No Discord webhook integration.
- No automatic push reporting.
- No push traffic ingestion endpoint.
- No broad analytics warehousing.
