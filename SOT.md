# Lighthouse — Source of Truth

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-first stats source with one narrow first-party pageview ingestion path.
- Lighthouse is a generic, deterministic metrics primitive; BUS Core is a current observed client/use-case, not a runtime dependency.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, records daily Buscore traffic snapshots in D1, accepts first-party pageview events into D1, and exposes an admin-protected `GET /report` endpoint.
- It does not post reports to Discord.
- Runtime surface: Worker `fetch` handler plus one scheduled daily traffic capture and retention handler.

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
- Lighthouse is privacy-first and aggregate-first.
- Lighthouse is operationally independent and independently runnable.
- Core operation must not depend on BUS Core or any external service.
- Reporting is on-demand.
- Scheduled behavior is limited to one approved daily Buscore traffic capture and retention run defined in this SOT.
- One unauthenticated first-party pageview ingestion endpoint is approved and documented in this SOT.
- No outbound posting or outbound integrations unless explicitly approved in this SOT.
- The current fixed metric model (`update_checks`, `downloads`, `errors`) is shipped behavior unless this SOT explicitly changes it.
- Buscore traffic telemetry is an additive extension for operator visibility and system understanding; it must not break or reinterpret the shipped core metric model.
- Raw pageview retention must remain narrow, short-lived, and non-identifying.
- SOT, changelog, and implementation must stay aligned.

## 3. Entry Points

`fetch(request, env, ctx)` in `src/index.ts` handles:

`scheduled(controller, env, ctx)` in `src/index.ts` handles:

### Daily Buscore Traffic Capture and Retention

- Runs once per day on a Worker cron.
- Uses one Cloudflare GraphQL Analytics API query per scheduled run for traffic totals.
- Always queries the previous completed UTC day.
- Never queries the current UTC day.
- Never persists rolling-window traffic snapshots.
- Uses `CF_API_TOKEN` bearer auth against `https://api.cloudflare.com/client/v4/graphql`.
- Scopes the query by `CF_ZONE_TAG` and hostname `buscore.ca`.
- **Traffic Totals Query:**
  - Queries daily request `count` and visitor `sum.visits` on `httpRequestsAdaptiveGroups`.
  - Lighthouse validates that the response includes a numeric daily request count metric (`count`); if missing/undefined/non-numeric, the entire capture for that day fails and skips the row.
- On successful pull, upserts one final row into `buscore_traffic_daily` for the selected UTC day.
- Capture is idempotent per day: reruns converge to one final row for that day.
- If the traffic totals Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day entirely.
- If the traffic query returns no daily row for the selected day and hostname, Lighthouse treats that run as failed and skips the row.
- The same scheduled run prunes raw pageview rows older than about 30 UTC days and prunes stale rate-limit buckets older than about 2 days.
- This scheduled behavior is additive and non-blocking. Lighthouse core request handling and core metric reporting remain operational if the Cloudflare pull path is unavailable.

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

### First-Party Pageview Ingestion

- `POST /metrics/pageview`
  - Unauthenticated by design.
  - Accepts JSON request bodies from the already-deployed BUS Core site emitter contract.
  - Always returns `204 No Content` with no response body.
  - CORS is explicitly limited to first-party BUS Core origins `https://buscore.ca` and `https://www.buscore.ca`; Lighthouse does not use wildcard `Access-Control-Allow-Origin` on this route.
  - When the request `Origin` matches one of those two origins, Lighthouse returns `Access-Control-Allow-Origin` echoing that origin, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, and `Vary: Origin`.
  - Requests from other origins still receive the normal `204` response semantics, but Lighthouse does not grant broad cross-origin browser access for this route.
  - Never emits client-visible error detail for malformed, partial, or rate-limited submissions.
  - Uses `ctx.waitUntil(...)` so response completion stays fast for beacon and keepalive callers.
  - Reads request body exactly once as raw text and then JSON-decodes from that same raw string, without requiring strict request `Content-Type` matching for valid JSON bodies.
  - For `POST /metrics/pageview`, raw body capture is completed on the request path before returning `204`, and ingest persistence/parsing work continues in `ctx.waitUntil(...)`.
  - Validates the canonical emitter shape: `type = "pageview"`, required string fields `client_ts`, `path`, `url`, `referrer`, `device`, `viewport`, `lang`, `tz`, and required object field `utm` (which may be `{}`).
  - Optional fields `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, and `is_new_user` may be omitted and are stored as nullable/default values when missing.
  - Empty-string values are accepted for `referrer`, `lang`, and `tz` and are stored as empty strings.
  - `anon_user_id` and `session_id` are nullable anonymous UUID-like continuity fields; malformed values are nulled and ingestion continues.
  - `is_new_user` is coerced from boolean-like inputs into integer `0/1` and defaults to `0` when absent or malformed.
  - If the body is unreadable, empty, invalid JSON, or contract-invalid on required fields, Lighthouse still returns `204` and records the submission as dropped-invalid when persistence is available.
  - Temporary ingest debugging aid (version-scoped) logs body-capture snapshots for accepted and invalid-json ingest paths, including `body_capture_stage_reached`, `raw_body_length`, and `capture_error`.
  - The same temporary debug aid includes invalid-json raw body preview logging (first about 500 characters) plus request `Content-Type` and inferred beacon/fetch transport hint from request metadata.
  - Performs server-side enrichment with canonical `received_at`, canonical `received_day`, parsed `referrer_domain`, Cloudflare `country` when available, `request_id` from `CF-Ray` when available, and fixed `ingest_version`.
  - Canonical ordering and aggregation are always based on `received_at` / `received_day`, never `client_ts`.
  - Accepted submissions are marked `js_fired = true`.
  - Lighthouse accepts the deployed site emitter contract as authoritative and does not add auth, retries, synthetic identity reconstruction, unload analytics, or client/server reconciliation logic.

### Pageview Noise Control

- Lighthouse applies a narrow anti-noise guard of approximately 50 events per IP hash per UTC minute.
- Rate limiting uses D1 minute buckets keyed by SHA-256 IP hash only; raw IPs are never stored.
- Rate-limited submissions still return `204` but are excluded from accepted aggregates.

### Reporting

- `GET /report`
  - Requires header `X-Admin-Token`.
  - Auth check is exact equality against `env.ADMIN_TOKEN`:
    - `const token = request.headers.get("X-Admin-Token")`
    - `if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) { ...401 unauthorized... }`
  - On auth failure: returns `401` JSON `{ "ok": false, "error": "unauthorized" }`.
  - On success: returns aggregate stats JSON with `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, additive top-level `traffic`, and additive top-level `human_traffic`.
  - Before assembling the response, Lighthouse always performs one best-effort refresh capture for the previous completed UTC day using the same traffic capture logic as the scheduled path.
  - The refresh remains idempotent via per-day upsert semantics and keeps one stored row per completed UTC day.
  - If this best-effort refresh attempt fails, `/report` still returns successfully using only currently stored traffic data.
  - This behavior is additive and does not replace the scheduled daily capture job.

### Fallback Behavior

- `OPTIONS` returns `200`.
- `OPTIONS /metrics/pageview` advertises `POST, OPTIONS` for the ingestion route.
- `OPTIONS /metrics/pageview` returns first-party CORS allow headers only for `Origin` values `https://buscore.ca` and `https://www.buscore.ca`, and never returns wildcard `Access-Control-Allow-Origin` on that route.
- `POST /metrics/pageview` is the one approved non-`GET` route.
- Other non-`GET` methods return `405` JSON `{ "ok": false, "error": "method_not_allowed" }`.
- Unmatched routes return `404` JSON `{ "ok": false, "error": "not_found" }`.

## 4. Persistence

- D1 binding: `DB`
- Table: `metrics_daily`
- Table: `buscore_traffic_daily`
- Table: `pageview_events_raw`
- Table: `pageview_daily`
- Table: `pageview_daily_dim`
- Table: `pageview_rate_limit`
- Aggregate counters: `update_checks`, `downloads`, `errors`
- Day key format: UTC `YYYY-MM-DD`
- `buscore_traffic_daily` schema:
  - `day TEXT PRIMARY KEY`
  - `visits INTEGER NULL`
  - `requests INTEGER NOT NULL`
  - `captured_at TEXT NOT NULL`
- `buscore_traffic_daily` stores one row per completed UTC day only.
- `requests` is sourced from daily request `count` on `httpRequestsAdaptiveGroups`.
- `visits` is sourced from `sum.visits` on `httpRequestsAdaptiveGroups` when present, and remains nullable.
- `pageview_events_raw` stores append-only first-party pageview submissions for about 30 UTC days with only narrow event fields required for inspectability, debugging, and source/path attribution.
- `pageview_events_raw` stores `ip_hash` and `user_agent_hash` as SHA-256 hashes when those source values are present; Lighthouse does not store raw IPs.
- `pageview_events_raw` also stores optional anonymous continuity fields `anon_user_id`, `session_id`, and `is_new_user` from first-party payloads.
- `pageview_events_raw.accepted = 1` means the submission counted toward accepted pageview aggregates.
- `pageview_events_raw.drop_reason` is currently limited to `invalid_json` and `rate_limited` when populated.
- `pageview_daily` stores one row per `received_day` with accepted pageview totals, drop counters, and the latest observed `received_at` for that day.
- `pageview_daily.pageviews` and `pageview_daily.accepted` increment together for accepted submissions.
- `pageview_daily_dim` stores accepted dimension counts for exactly four dimension types: `path`, `referrer_domain`, `src`, and `utm_source`.
- `pageview_rate_limit` stores approximate per-minute IP-hash counters only for ingestion noise control and has no reporting role.

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

No new bindings or secrets are introduced by pageview ingestion.

## 6. Reporting Model

- Reporting is on-demand only via authenticated `GET /report`.
- No outbound report delivery.
- Scheduled traffic capture is separate from report delivery and only writes one daily Buscore traffic snapshot into D1.
- `GET /report` includes one best-effort refresh capture for the previous completed UTC day before assembling the response.
- This refresh reuses the same per-day capture logic as scheduled capture, remains idempotent via per-day upsert, and does not block successful report responses on capture failure.

### Report Contract Stability

- `GET /report` is an operator-facing contract, not an ad-hoc analytics surface.
- Current shipped response shape includes: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, `traffic`, `human_traffic`, `identity`.
- Current shipped `trends` fields include: `downloads_change_percent`, `update_checks_change_percent`, `weekly_downloads_change_percent`, `weekly_update_checks_change_percent`, `conversion_ratio`.
- `conversion_ratio` is defined as today downloads divided by today update checks (with safe zero-denominator handling).
- `traffic.latest_day` contains the most recent completed UTC day stored in `buscore_traffic_daily` with fields `day`, `visits`, `requests`, `captured_at`.
- `traffic.last_7_days` contains aggregate traffic fields `visits`, `requests`, `avg_daily_visits`, `avg_daily_requests`, and `days_with_data` across stored rows in the last seven UTC days.
- Existing `traffic` remains the Cloudflare-derived traffic summary and its semantics are unchanged by pageview ingestion.
- `human_traffic` is additive only and represents JS-fired first-party pageview telemetry, not verified-human analytics.
- `human_traffic.today` contains `pageviews` and `last_received_at` for the current UTC day.
- `human_traffic.last_7_days` contains accepted `pageviews`, `days_with_data`, `top_paths`, `top_referrers`, and `top_sources` across the current UTC day plus the previous six UTC days.
- `human_traffic.last_7_days.top_paths` entries use `{ path, pageviews }`.
- `human_traffic.last_7_days.top_referrers` entries use `{ referrer_domain, pageviews }`.
- `human_traffic.last_7_days.top_sources` entries use `{ source, pageviews }` with deterministic precedence `src -> utm.source -> (direct)`.
- `human_traffic.observability` is cumulative across stored pageview aggregate rows and contains `accepted`, `dropped_rate_limited`, `dropped_invalid`, and `last_received_at`.
- `identity` is additive only and summarizes anonymous continuity from accepted rows with non-null identity/session fields when present.
- `identity.today` contains `new_users`, `returning_users`, and `sessions` for the current UTC day.
- `identity.last_7_days` contains `new_users`, `returning_users`, `sessions`, and `return_rate` across the current UTC day plus previous six UTC days.
- `identity.top_sources_by_returning_users` contains ranked `{ source, users }` using precedence `src -> utm.source -> (direct)`.
- `identity.last_7_days.return_rate` is defined as `returning_users / distinct_users` where `distinct_users` means distinct non-null `anon_user_id` values in the same 7-day window; zero denominator returns `0`.
- Existing non-traffic `/report` fields remain intact and semantically unchanged.
- If a requested traffic window has no stored traffic rows, its traffic fields return `NULL` rather than synthetic zeroes.
- `avg_daily_visits` and `avg_daily_requests` are computed using `days_with_data` (stored rows in the 7-day window) as the divisor; Lighthouse does not divide by seven unless seven rows exist.
- `traffic.requests` comes from daily request `count` on `httpRequestsAdaptiveGroups` in the Cloudflare GraphQL Analytics API.
- `traffic.visits` is populated from `sum.visits` when provided by the same single-query path and remains nullable when absent.
- Changes to `/report` response fields or semantics require explicit SOT update and changelog entry in the same change set.

## 7. Privacy and Security

- Aggregate-first storage in D1 with narrow raw pageview retention for about 30 UTC days.
- Lighthouse does not introduce account-linked identity, cookies, browser fingerprinting, or cross-device identity reconstruction.
- First-party pageview ingestion stores hashed IP and hashed user-agent values only when present and does not store raw IPs.
- Anonymous continuity values are first-party random UUID-like values and remain independent from `ip_hash` and `user_agent_hash`.
- Lighthouse must not combine `anon_user_id` with `ip_hash` or `user_agent_hash` into synthetic identity.
- Traffic capture uses Cloudflare aggregate analytics only; no raw request logging is introduced outside the documented narrow pageview ingestion path.
- `/report` is protected by `X-Admin-Token` exact match to `env.ADMIN_TOKEN`.

## 8. Explicit Non-Features

- No `/health` route in current code.
- No scheduled outbound reporting.
- No Discord webhook integration.
- No automatic push reporting.
- No broad analytics warehousing.
- No retries, unload-trigger analytics, account identity semantics, or fingerprinting behavior for pageview ingestion.
