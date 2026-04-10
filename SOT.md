# Lighthouse — Source of Truth

## 1. System Overview

  - Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-first stats source with a multi-site event ingestion spine and a legacy BUS Core pageview ingestion path.
- Lighthouse is a generic, deterministic metrics primitive; BUS Core is a current observed client/use-case, not a runtime dependency.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, records daily Buscore traffic snapshots in D1, accepts first-party pageview events into D1, and exposes an admin-protected multi-view `GET /report` endpoint.
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
  - Two unauthenticated first-party event ingestion endpoints are approved and documented in this SOT: `POST /metrics/pageview` (BUS Core legacy) and `POST /metrics/event` (multi-site standard).
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

### Tracked-Site Registry

  - Lighthouse maintains a code-level tracked-site registry (`TRACKED_SITES`) defining every site/property for which it may receive events or capture traffic.
  - Each registry entry carries: `site_key`, `label`, `status` (`active` | `staging` | `planned`), `production_hosts`, `allowed_origins`, `staging_hosts`, `cloudflare_traffic_enabled`, `cloudflare_host`, and `production_only_default`.
  - BUS Core is registered as `site_key: "buscore"` with `status: "active"`. Its CORS allow-list (`https://buscore.ca`, `https://www.buscore.ca`) and Cloudflare traffic capture host (`buscore.ca`) are derived from its registry entry.
  - Star Map Generator is registered as `site_key: "star_map_generator"` with `status: "active"`, production host `starmap.truegoodcraft.ca`, and allowed browser origin `https://starmap.truegoodcraft.ca`.
  - True Good Craft website is registered as `site_key: "tgc_site"` with `status: "active"`, production hosts `truegoodcraft.ca` and `www.truegoodcraft.ca`, allowed browser origins `https://truegoodcraft.ca` and `https://www.truegoodcraft.ca`, and Cloudflare traffic capture disabled.
  - CORS origin policy for `POST /metrics/pageview` is scoped exclusively to the `buscore` registry entry.
  - CORS origin policy for `POST /metrics/event` is derived from the union of all `active` tracked-site `allowed_origins` entries.
  - Adding a new tracked site requires only a registry entry update. No structural changes to Lighthouse endpoints are needed.

### Cross-Site Developer/Operator Analytics Exclusion Standard

  - Lighthouse relies on site-side telemetry loaders to gate telemetry emission before requests are sent.
  - The canonical developer/operator analytics suppression cookie for Lighthouse-integrated public sites is `dev_mode`.
  - `dev_mode` is presence-based: if the cookie is present for the current page load, telemetry emission is suppressed regardless of cookie value.
  - This suppression contract applies to both BUS Core legacy pageview telemetry (`POST /metrics/pageview`) and standardized multi-site event telemetry (`POST /metrics/event`).
  - Under active suppression, site-side loaders are expected to suppress all analytics work for that page load, including Cloudflare Web Analytics injection and Lighthouse telemetry emission.
  - This is an integration-contract expectation for tracked public sites; Lighthouse ingestion routes do not enforce cookie checks server-side.
  - This developer/operator suppression standard is separate from public privacy opt-out controls (for example `localStorage.noAnalytics === "1"`).
  - Because tracked sites can span separate registrable domains, the standard is shared by cookie name and semantics (`dev_mode`), not by one universal cookie instance.

### Standard Multi-Site Event Ingestion

  - `POST /metrics/event`
    - Unauthenticated by design.
    - Accepts JSON payloads from any registered tracked site.
    - Always returns `204 No Content` with no response body.
    - CORS is limited to `allowed_origins` of active tracked sites; wildcard `Access-Control-Allow-Origin` is never used on this route.
    - Validates the standard event contract: required fields `site_key`, `event_name`, `client_ts`, `path`, `url`, `referrer`, `device`, `viewport`, `lang`, `tz`, and required object `utm` (which may be `{}`). Optional fields: `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, `is_new_user`, `event_value`, `test_mode`.
    - Validates that `site_key` is present in the tracked-site registry.
    - Contract validation follows the same shape rules as `POST /metrics/pageview`; malformed or invalid submissions are silently dropped and still return `204`.
    - Accepted events are persisted to `site_events_raw` in D1 with standard server-side enrichment: `received_at`, `received_day`, `referrer_domain`, `country`, `request_id`, `ingest_version`.
    - Hashes IP and user-agent for privacy; raw values are never stored.
    - Uses `ctx.waitUntil(...)` so response completion stays fast.
    - Applies the same D1 minute-bucket SHA-256 IP-hash rate-limit model as pageview ingest (approximately 50 events per IP hash per UTC minute).
    - Rate-limited submissions still return `204`, are persisted with `accepted = 0` and `drop_reason = "rate_limited"`, and are excluded from accepted aggregations.

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
  - If `view` is omitted, blank, or absent, `/report` preserves the legacy response shape with `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, additive top-level `traffic`, additive top-level `human_traffic`, additive top-level `identity`, and additive top-level `site_events`.
  - Bare legacy `/report` continues to support `site_key` with optional flags `exclude_test_mode` (default `true`) and `production_only` (default from tracked-site `production_only_default`) for the additive `site_events` block only.
  - If legacy `/report` omits `site_key`, `site_events` is `null` to avoid silently blending multiple tracked sites.
  - `GET /report?view=fleet` returns `{ view, generated_at, sites }` for all tracked properties.
  - `GET /report?view=site&site_key=<site_key>` returns `{ view, generated_at, scope, summary, traffic, events, identity, health }` for exactly one tracked property and accepts the same `exclude_test_mode` and `production_only` flags as the legacy `site_events` scope.
  - `GET /report?view=source_health` returns `{ view, generated_at, sites }` as a telemetry-integrity view.
  - Invalid `view` returns `400` JSON `{ "ok": false, "error": "invalid_view" }`.
  - `view=site` without `site_key` returns `400` JSON `{ "ok": false, "error": "missing_site_key" }`.
  - Unknown `site_key` on legacy `/report` or `view=site` returns `400` JSON `{ "ok": false, "error": "invalid_site_key" }`.
  - Before assembling legacy `/report`, `view=fleet`, or `view=site`, Lighthouse performs one best-effort refresh capture for the previous completed UTC day using the same traffic capture logic as the scheduled path.
  - `view=source_health` intentionally skips that best-effort traffic refresh because it is a telemetry-integrity view over already persisted ingestion/state data rather than a Cloudflare traffic KPI view.
  - When the best-effort refresh runs, it remains idempotent via per-day upsert semantics and keeps one stored row per completed UTC day.
  - If a best-effort refresh attempt fails, `/report` still returns successfully using only currently stored traffic data.
  - This behavior is additive and does not replace the scheduled daily capture job.

### Fallback Behavior

- `OPTIONS` returns `200`.
- `OPTIONS /metrics/pageview` advertises `POST, OPTIONS` for the ingestion route.
- `OPTIONS /metrics/pageview` returns first-party CORS allow headers only for `Origin` values `https://buscore.ca` and `https://www.buscore.ca`, and never returns wildcard `Access-Control-Allow-Origin` on that route.
  - `POST /metrics/pageview` and `POST /metrics/event` are the two approved non-`GET` routes.
  - `OPTIONS /metrics/event` advertises `POST, OPTIONS` and returns CORS allow headers for the origin if it matches an active tracked-site entry; never returns wildcard on that route.
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
- Table: `site_events_raw`
- Table: `site_event_rate_limit`
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
- `site_event_rate_limit` stores approximate per-minute IP-hash counters only for standardized event ingestion noise control and has no reporting role.
- `site_events_raw` stores append-only multi-site event submissions with standard enrichment fields. `site_key` is the per-site discriminator for report isolation. `event_name` identifies the event type within a site. `accepted = 1` means the event was accepted and persisted. `drop_reason` currently uses `rate_limited` for standardized ingest drops. `ip_hash` and `user_agent_hash` are SHA-256 hashes when source values are present; raw values are never stored.

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
- Legacy `/report`, `view=fleet`, and `view=site` each include one best-effort refresh capture for the previous completed UTC day before assembling the response.
- `view=source_health` intentionally skips the refresh path and reads only currently persisted data.
- When used, the refresh reuses the same per-day capture logic as scheduled capture, remains idempotent via per-day upsert, and does not block successful report responses on capture failure.

### Report Contract Stability

- `GET /report` is an operator-facing contract, not an ad-hoc analytics surface.
- Bare `/report` preserves the shipped legacy response shape: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, `traffic`, `human_traffic`, `identity`, and additive `site_events` (nullable unless `site_key` is provided).
- Additional shipped view modes are `view=fleet`, `view=site`, and `view=source_health`.
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
- `site_events` is populated only when `site_key` is supplied on `GET /report`.
- `site_events.scope` echoes `site_key`, `exclude_test_mode`, and `production_only` used for the standardized-event summary.
- `site_events.totals` contains `accepted_events` and `unique_paths` for the selected site over the current UTC day plus previous six UTC days.
- `site_events.by_event_name` contains ranked `{ event_name, events }` for accepted events, with shared-name alias normalization in report assembly so equivalent shared actions are not split across multiple names.
- `site_events.top_sources` contains ranked `{ source, events }` using deterministic precedence `src -> utm.source -> referrer classification -> (direct)`.
- `site_events.top_campaigns` contains ranked `{ utm_campaign, events }` for non-empty `utm_campaign` values.
- `site_events.top_referrers` contains ranked `{ referrer_domain, events }` for non-empty referrer domains.
- `site_events.observability` exposes `included_events`, `excluded_test_mode`, `excluded_non_production_host`, `dropped_rate_limited`, `dropped_invalid`, and `last_received_at`.
- `site_events.production_only` filtering is host-based against the selected tracked site `production_hosts` and is operator-controllable through the `production_only` query flag.
- `view=fleet` returns one entry per tracked site with fields `site_key`, `label`, `status`, `backend_source`, `cloudflare_traffic_enabled`, `production_hosts`, `last_received_at`, `accepted_events_7d`, `pageviews_7d`, `traffic_requests_7d`, `traffic_visits_7d`, and `has_recent_signal`.
- `view=site` returns top-level sections `scope`, `summary`, `traffic`, `events`, `identity`, and `health` for the selected site.
- `view=site.scope.support_class` exposes the deterministic normalization support class for the selected site.
- `view=site.scope.section_availability` exposes deterministic section support flags by support class.
- `view=site.identity` is populated only for support classes with identity support (currently `legacy_hybrid` via BUS Core pageview continuity) and returns `null` for event-only support classes.
- `view=source_health` returns one entry per tracked site with fields `site_key`, `label`, `backend_source`, `cloudflare_traffic_enabled`, `production_only_default`, `last_received_at`, `accepted_signal_7d`, `dropped_invalid`, and `dropped_rate_limited`.
- `backend_source` is deterministic and reflects the current persisted reporting surfaces actually used by Lighthouse for that site, joined with `+` from this set: `pageview_daily`, `site_events_raw`, `buscore_traffic_daily`.
- All `*_7d` metrics use the current UTC day plus the previous six UTC days.
- In `view=fleet`, `view=site`, and `view=source_health`, `last_received_at` means the latest accepted telemetry `received_at` currently included for that site across the reporting surfaces used by that view. BUS Core considers both legacy pageview telemetry and standardized site events; other sites consider standardized site events only.
- `has_recent_signal` is `true` when the selected site has at least one accepted supported signal in the current 7-day UTC window. BUS Core supported signals are accepted legacy pageviews plus accepted standardized site events. Other sites use accepted standardized site events only.
- `accepted_signal_7d` in `view=source_health` is the same supported-signal count used for `has_recent_signal`, but returned as a numeric total.
- `pageviews_7d` is supported only for BUS Core legacy pageview telemetry and returns `null` for other tracked sites.
- Site-scoped traffic metrics (`traffic_requests_7d`, `traffic_visits_7d`, `traffic.latest_day`, `traffic.last_7_days`) are supported only for sites whose tracked-site registry entry has `cloudflare_traffic_enabled = true`; otherwise Lighthouse returns the availability flag with `null` traffic metrics.
- `health.last_received_at` in `view=site` follows the same cross-source meaning as `summary.last_received_at`.
- `health.included_events`, `health.excluded_test_mode`, and `health.excluded_non_production_host` in `view=site` are derived from the standardized-event filter scope for that site.
- `health.included_events` is the count of events that pass all active filter conditions (`accepted = 1`, `test_mode` filter, and production-host filter when `production_only` is active) over the same 7-day window used for `events.accepted_events`. These two fields are computed from the same filter predicate and must be equal. A mismatch between them indicates a querying defect.
- `dropped_rate_limited` in `view=site` and `view=source_health` sums persisted rate-limited drops from all supported reporting surfaces for that site.
- `dropped_invalid` in `view=site` and `view=source_health` is supported only where Lighthouse persists invalid-drop counters. Today that means BUS Core legacy pageview telemetry only. Standardized-event invalid submissions are not persisted, so non-BUS Core sites return `null` for `dropped_invalid`.
- Existing non-traffic `/report` fields remain intact and semantically unchanged.
- If a requested traffic window has no stored traffic rows, its traffic fields return `NULL` rather than synthetic zeroes.
- If a requested field is unsupported for a site or reporting surface, Lighthouse returns `null` rather than a synthetic zero.
- `avg_daily_visits` and `avg_daily_requests` are computed using `days_with_data` (stored rows in the 7-day window) as the divisor; Lighthouse does not divide by seven unless seven rows exist.
- `traffic.requests` comes from daily request `count` on `httpRequestsAdaptiveGroups` in the Cloudflare GraphQL Analytics API.
- `traffic.visits` is populated from `sum.visits` when provided by the same single-query path and remains nullable when absent.
- Changes to `/report` response fields or semantics require explicit SOT update and changelog entry in the same change set.

### Fleet Normalization Standard

- `TRACKED_SITES` is the canonical property registry for tracked public properties.
- `POST /metrics/event` is the canonical fleet telemetry path.
- `POST /metrics/pageview` remains supported only as a documented BUS Core legacy path.
- `dev_mode` is the canonical cross-site developer/operator telemetry suppression contract.
- Shared report field names and shared payload field names must keep one documented meaning across views where applicable.
- Normalization must not manufacture parity: unsupported sections/metrics stay `null` or are omitted by documented rule.
- Cloudflare traffic, standardized first-party events, and BUS Core legacy pageviews remain distinct telemetry layers and must not be treated as equivalent sources.

### Support Class Taxonomy (Canonical Operator Vocabulary)

Each tracked site is classified as exactly one of:
- `legacy_hybrid`
- `event_only`
- `event_plus_cf_traffic`
- `not_yet_normalized`

Support class definitions:
- `legacy_hybrid`:
  legacy plus richer telemetry/reporting surfaces; may expose traffic, events, and identity-style sections where supported.
- `event_only`:
  first-party event telemetry only; no fake traffic richness; identity remains `null` unless a real supported layer is added.
- `event_plus_cf_traffic`:
  first-party event telemetry plus Cloudflare traffic layer.
- `not_yet_normalized`:
  registered or partially tracked, but not yet brought onto the standard.

Current classification:
- `buscore`: `legacy_hybrid`
- `star_map_generator`: `event_only`
- `tgc_site`: `event_only`

### Capability Layers (Canonical Operator Vocabulary)

Capability layers are the operator language for what a site actually has:
- Layer 1 - Registry layer:
  site_key, hosts, allowed origins, reporting registration.
- Layer 2 - Event layer:
  first-party Lighthouse events such as `page_view`, `outbound_click`, `contact_click`, `service_interest`.
- Layer 3 - Traffic layer:
  Cloudflare-style traffic/request/visit surfaces.
- Layer 4 - Identity layer:
  session/user identity-style reporting where actually supported.
- Layer 5 - Extension layer:
  site-specific events beyond the shared taxonomy.

Current site capability matrix:

| Site | support_class | Layer 1 Registry | Layer 2 Event | Layer 3 Traffic | Layer 4 Identity | Layer 5 Extension | Notes |
|---|---|---|---|---|---|---|---|
| BUS Core (`buscore`) | `legacy_hybrid` | Yes | Yes | Yes | Yes | Not active by default | Intentionally richer; do not force false parity onto other sites. |
| Star Map Generator (`star_map_generator`) | `event_only` | Yes | Yes | No | No | Yes | Keep event-only posture unless an explicit supported layer change is requested. |
| True Good Craft (`tgc_site`) | `event_only` | Yes | Yes | No | No | No (currently) | No active extension layer right now. |

Operator language rule:
- Future telemetry requests and handoffs must be written using support classes and capability layers.
- Replace vague phrasing like "make it like Buscore", "make telemetry richer", or "make all site reports the same".
- Use explicit requests such as:
  - "Add a traffic layer to TGC"
  - "Add an extension layer to Star Map"
  - "Keep Star Map event_only"
  - "Add shared outbound_click coverage to Buscore"
  - "Do not add identity to this site"

### Canonical Normalized Per-Site Report Contract

Per-site normalized reporting logically targets these sections where supported:
- Summary
- Today
- Traffic
- Human Traffic / Events
- Observability
- Identity
- Read

Rules:
- Unsupported sections must remain `null` or omitted by documented rule.
- Section meanings must not drift by site.
- Fleet summaries must remain comparable without pretending unsupported metrics exist.

### Shared Field Meaning Freeze

Shared field semantics:
- `accepted_signal_7d`: accepted supported telemetry signal count for current UTC day plus previous six days.
- `accepted_events_7d`: accepted standardized events only (never includes legacy pageviews).
- `has_recent_signal`: boolean equivalent of `accepted_signal_7d > 0`.
- `last_received_at`: latest accepted telemetry `received_at` included for the site in that view.
- `cloudflare_traffic_enabled`: tracked-site capability flag, not a count metric.

Rules:
- If a field is only valid in one view or section, that scope must be explicitly documented.
- Meanings must not drift between fleet/site/source-health outputs.

### Shared Event Naming Rule

- Runtime keeps permissive ingest compatibility and accepts any non-empty `event_name` on `POST /metrics/event`.
- Fleet shared comparable event names are frozen to: `page_view`, `outbound_click`, `contact_click`, `service_interest`.
- Report normalization aliases equivalent shared names to the canonical shared names (for example `pageview -> page_view`, `link_click -> outbound_click`) so shared-action reporting semantics stay stable without breaking live ingest compatibility.
- Shared taxonomy is for comparable cross-site actions.
- Site-specific event names remain allowed as legitimate extension-layer events and are treated as site-scoped/non-comparable unless explicitly mapped into the shared catalog.
- Event names outside the shared taxonomy are either legitimate site-specific extensions or drift that should be cleaned up.

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
- Star Map Generator launch registration is tracked via the tracked-site registry (`production_hosts` and `allowed_origins`) and must remain registry-configurable.
- No scheduled outbound reporting.
- No Discord webhook integration.
- No automatic push reporting.
- No broad analytics warehousing.
- No retries, unload-trigger analytics, account identity semantics, or fingerprinting behavior for pageview ingestion.
