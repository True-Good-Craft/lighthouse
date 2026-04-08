# buscore-lighthouse

Lighthouse is a single Cloudflare Worker that provides a small, deterministic, privacy-first, aggregate-first metrics primitive with one narrow first-party JS-fired pageview ingestion path.

Architectural rule:
- Lighthouse is a standalone service and operationally independent.
- It is independently runnable and not hard-dependent on BUS Core or any other external service.
- BUS Core is a current observed client/traffic source, but Lighthouse core operation must remain independent.
- Integrations must remain optional, additive, and non-blocking.

Release authority:
- Shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned by `package.json`.
- No behavioral, contract, storage, configuration, auth, or scheduling change is considered released unless all three are updated together in the same change set.

## Glossary

- Aggregate-first: stores daily aggregate counters as the primary reporting model and retains only a narrow, short-lived raw pageview log for inspectability.
- Operationally independent: can run and serve core routes without requiring any other service to be available.
- Observed client: an external system that calls Lighthouse (for example BUS Core) without becoming a runtime dependency.
- Core operation: manifest serving, aggregate counting, first-party pageview ingestion, and protected on-demand reporting.
- Optional integration: an additive external integration that does not block core operation when unavailable.
- Shipped behavior: behavior currently implemented and documented as present reality.
- Future direction: planned or proposed behavior not yet shipped.

## Current System

Lighthouse currently does six things:

1. Serves the BUS Core manifest from R2.
2. Increments fixed daily aggregate counters in D1.
3. Accepts first-party site-emitted pageview events on `POST /metrics/pageview`.
4. Accepts standardized multi-site events on `POST /metrics/event`.
5. Exposes protected, on-demand aggregate reporting.
6. Pulls one daily Buscore traffic snapshot from the Cloudflare GraphQL Analytics API into D1 on a scheduled cron.

It does not implement retries, identity, session tracking, unload analytics, or a broad analytics warehouse.

## Cross-Site Analytics Suppression Standard

All Lighthouse-integrated public sites must use one shared developer/operator analytics exclusion standard:

- The canonical suppression cookie name is `dev_mode`.
- Detection is presence-based, not value-based: if a `dev_mode` cookie is present, suppression is active for that page load.
- Suppression is site-side loader behavior. Lighthouse server routes do not perform cookie checks.
- When suppression is active, shared site telemetry loaders must suppress all analytics work for that page load:
  - Do not inject Cloudflare Web Analytics.
  - Do not emit Lighthouse pageview telemetry (`POST /metrics/pageview`).
  - Do not emit Lighthouse standardized site-event telemetry (`POST /metrics/event`).
- This developer/operator suppression standard is separate from user privacy opt-out controls (for example `localStorage.noAnalytics === "1"`).
- Because cookies do not cross registrable domains, this standard is one logical cookie contract with multiple domain-scoped cookie instances.
- Domain scoping guidance:
  - Use the highest valid shared domain for each site family.
  - Use `.buscore.ca` for BUS Core properties.
  - Use `.truegoodcraft.ca` for True Good Craft properties and subdomains, including `starmap.truegoodcraft.ca`.

Practical cookie examples:

```text
dev_mode=1; Domain=.truegoodcraft.ca; Path=/; Max-Age=31536000; SameSite=Lax; Secure
dev_mode=1; Domain=.buscore.ca; Path=/; Max-Age=31536000; SameSite=Lax; Secure
```

## Routes

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/manifest/core/stable.json` | Return manifest JSON from R2 (no counting) |
| GET | `/update/check` | Return manifest JSON and increment `update_checks` unless request IP matches `IGNORED_IP` |
| GET | `/download/latest` | Increment `downloads` unless request IP matches `IGNORED_IP`, then `302` redirect to latest release URL from manifest |
| GET | `/releases/:filename` | Serve release artifact from R2 key `releases/:filename` (no counting) |
| POST | `/metrics/pageview` | Accept first-party JS-fired pageview JSON, always return `204`, and persist/aggregate best-effort in D1 |
| POST | `/metrics/event` | Accept standardized multi-site event JSON, always return `204`, and persist/aggregate best-effort in D1 |
| GET | `/report` | Return protected aggregate report (requires `X-Admin-Token`) |

Notes:
- `/manifest/core/stable.json` and `/releases/:filename` never increment counters.
- `/update/check` does not require `X-BUS-Update-Source: core` for counting.
- If `IGNORED_IP` is configured and matches `CF-Connecting-IP`, counting is suppressed while normal responses are still returned.
- `POST /metrics/pageview` is unauthenticated by design, parses raw request text then JSON, and still returns `204` for malformed, invalid, or rate-limited submissions.
- Valid accepted payloads follow the deployed BUS Core site emitter contract: `type = "pageview"`; required fields `client_ts`, `path`, `url`, `referrer`, `utm` object, `device`, `viewport`, `lang`, and `tz`; optional omitted fields `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, and `is_new_user`.
- Empty-string values for `referrer`, `lang`, and `tz` are accepted and preserved as empty strings in raw storage.
- `POST /metrics/pageview` and its `OPTIONS` preflight only grant browser CORS access to `https://buscore.ca` and `https://www.buscore.ca`; Lighthouse does not use wildcard allow-origin on that route.
- The deployed site emitter contract is accepted as-is: page-load-only, beacon-first, `fetch(..., { keepalive: true })` fallback, no retries, and no session logic.
- `POST /metrics/event` is site-aware through the tracked-site registry in `src/index.ts`: each site entry defines `site_key`, `production_hosts`, `allowed_origins`, `staging_hosts`, and `production_only_default`.

## Report Response

`GET /report` returns:

```json
{
  "today": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "yesterday": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "last_7_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "month_to_date": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "trends": {
    "downloads_change_percent": 0,
    "update_checks_change_percent": 0,
    "weekly_downloads_change_percent": 0,
    "weekly_update_checks_change_percent": 0,
    "conversion_ratio": 0
  },
  "traffic": {
    "latest_day": {
      "day": "2026-03-22",
      "visits": null,
      "requests": 0,
      "captured_at": "2026-03-23T00:05:02.123Z"
    },
    "last_7_days": {
      "visits": null,
      "requests": 0,
      "avg_daily_visits": null,
      "avg_daily_requests": 0,
      "days_with_data": 1
    }
  },
  "human_traffic": {
    "today": {
      "pageviews": 0,
      "last_received_at": null
    },
    "last_7_days": {
      "pageviews": 0,
      "days_with_data": 0,
      "top_paths": [],
      "top_referrers": [],
      "top_sources": []
    },
    "observability": {
      "accepted": 0,
      "dropped_rate_limited": 0,
      "dropped_invalid": 0,
      "last_received_at": null
    }
  },
  "identity": {
    "today": {
      "new_users": 0,
      "returning_users": 0,
      "sessions": 0
    },
    "last_7_days": {
      "new_users": 0,
      "returning_users": 0,
      "sessions": 0,
      "return_rate": 0
    },
    "top_sources_by_returning_users": []
  }
}
```

Contract note:
- `/report` is treated as an operator contract.
- Field additions/removals or semantic changes must be deliberate and documented in SOT/changelog, not ad-hoc.
- Existing top-level fields `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends` remain intact and semantically unchanged.
- Existing top-level `traffic` remains the Cloudflare-derived traffic summary and is not renamed or reinterpreted by pageview ingestion.
- Additive top-level `human_traffic` is JS-fired first-party pageview telemetry, not verified-human analytics.
- On each authenticated `/report` request, Lighthouse performs one best-effort refresh capture for the previous completed UTC day before assembling the report.
- This refresh reuses the same traffic capture logic as the scheduled path and does not replace cron-based capture.
- If this refresh fails, `/report` still returns successfully with traffic fields based only on currently stored data.
- `traffic.latest_day` is the most recent completed UTC day snapshot stored in D1 and includes `captured_at`.
- `traffic.last_7_days` aggregates stored traffic rows within the last seven UTC days and includes `days_with_data`, `avg_daily_visits`, and `avg_daily_requests`.
- `human_traffic.today` reports accepted JS-fired pageviews for the current UTC day and the latest observed `received_at` value for that day.
- `human_traffic.last_7_days.top_paths` entries use `{ path, pageviews }`.
- `human_traffic.last_7_days.top_referrers` entries use `{ referrer_domain, pageviews }`.
- `human_traffic.last_7_days.top_sources` entries use `{ source, pageviews }` with precedence `src -> utm.source -> (direct)`.
- `human_traffic.observability` is cumulative across stored pageview aggregate rows and reports accepted, dropped-rate-limited, dropped-invalid, and the latest observed `received_at`.
- Additive top-level `identity` summarizes anonymous continuity using accepted pageviews only.
- Additive top-level `site_events` is populated only when `site_key` is provided on `/report`.
- `/report` supports standardized-event scope flags: `site_key` (required for site events), `exclude_test_mode` (default `true`), and `production_only` (default from tracked-site `production_only_default`).
- Unknown `site_key` on `/report` returns `400` with `{"ok":false,"error":"invalid_site_key"}`.
- `identity.last_7_days.return_rate` is `returning_users / distinct_users` over non-null `anon_user_id` values in the same 7-day window.
- If a traffic window has no stored data, its traffic fields return `null` instead of synthetic zeroes.
- Average daily traffic values divide by `days_with_data` (rows that exist), not blindly by 7.
- `requests` come from daily request `count` on Cloudflare `httpRequestsAdaptiveGroups`.
- `visits` come from `sum.visits` on the same single-query path when provided, and remain nullable when absent.

## Star Map Go-Live Inputs

When the final Star Map production domain is known, update the `star_map_generator` entry in `src/index.ts` `TRACKED_SITES`:

- `production_hosts`: canonical production host(s) used in event `url` values.
- `allowed_origins`: browser origin(s) allowed for CORS on `POST /metrics/event`.
- `staging_hosts`: non-production hosts used for launch testing.
- `production_only_default`: keep `true` for production-clean operator reporting by default.

Operator launch-readiness report calls:

- `/report?site_key=star_map_generator`
- `/report?site_key=star_map_generator&exclude_test_mode=true&production_only=true`

Expected Star Map event names:

- Lighthouse accepts any non-empty `event_name` and does not enforce a fixed taxonomy.
- Before go-live, the Star Map owner must provide and freeze the launch event-name list so `/report` top event-name and source/campaign readouts can be interpreted consistently.

## D1 Schema

```sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  day           TEXT    PRIMARY KEY,
  update_checks INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS buscore_traffic_daily (
  day         TEXT    PRIMARY KEY,
  visits      INTEGER NULL,
  requests    INTEGER NOT NULL,
  captured_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS pageview_events_raw (
  id              TEXT    PRIMARY KEY,
  received_at     TEXT    NOT NULL,
  received_day    TEXT    NOT NULL,
  client_ts       TEXT    NULL,
  path            TEXT    NULL,
  url             TEXT    NULL,
  referrer        TEXT    NULL,
  referrer_domain TEXT    NULL,
  src             TEXT    NULL,
  utm_source      TEXT    NULL,
  utm_medium      TEXT    NULL,
  utm_campaign    TEXT    NULL,
  utm_content     TEXT    NULL,
  device          TEXT    NULL,
  viewport        TEXT    NULL,
  lang            TEXT    NULL,
  tz              TEXT    NULL,
  anon_user_id    TEXT    NULL,
  session_id      TEXT    NULL,
  is_new_user     INTEGER NOT NULL DEFAULT 0,
  country         TEXT    NULL,
  js_fired        INTEGER NOT NULL DEFAULT 1,
  ip_hash         TEXT    NULL,
  user_agent_hash TEXT    NULL,
  accepted        INTEGER NOT NULL DEFAULT 1,
  drop_reason     TEXT    NULL,
  request_id      TEXT    NULL,
  ingest_version  TEXT    NULL
);

CREATE TABLE IF NOT EXISTS pageview_daily (
  day                  TEXT    PRIMARY KEY,
  pageviews            INTEGER NOT NULL DEFAULT 0,
  accepted             INTEGER NOT NULL DEFAULT 0,
  dropped_rate_limited INTEGER NOT NULL DEFAULT 0,
  dropped_invalid      INTEGER NOT NULL DEFAULT 0,
  last_received_at     TEXT    NULL
);

CREATE TABLE IF NOT EXISTS pageview_daily_dim (
  day       TEXT    NOT NULL,
  dim_type  TEXT    NOT NULL,
  dim_value TEXT    NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, dim_type, dim_value)
);

CREATE TABLE IF NOT EXISTS pageview_rate_limit (
  minute_bucket TEXT    NOT NULL,
  ip_hash       TEXT    NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(minute_bucket, ip_hash)
);
```

Pageview ingestion notes:
- `pageview_events_raw` is retained for about 30 UTC days for inspectability and validation.
- IP and user-agent values are stored as SHA-256 hashes when present; Lighthouse does not store raw IPs.
- Anonymous continuity fields (`anon_user_id`, `session_id`, `is_new_user`) are accepted from first-party payloads only and used for aggregate retention reporting.
- `pageview_daily_dim` only tracks accepted dimensions for `path`, `referrer_domain`, `src`, and `utm_source`.
- `pageview_rate_limit` enforces approximate per-IP minute buckets and stale buckets are pruned during the existing daily scheduled run.

## Configuration

Required bindings/secrets:
- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`
- `IGNORED_IP` (optional)
- `CF_API_TOKEN` (required for scheduled Buscore traffic capture)
- `CF_ZONE_TAG` (required for scheduled Buscore traffic capture)

No new bindings or secrets are introduced by pageview ingestion.

## Scheduling

Lighthouse is on-demand only.
- Daily cron trigger captures one previous completed UTC day Buscore traffic snapshot from the Cloudflare GraphQL Analytics API.
- The same scheduled execution also prunes raw pageview events older than about 30 UTC days and stale rate-limit buckets older than about 2 days.
- No outbound Discord posting.

Traffic capture notes:
- The cron always queries the previous completed UTC day. It never queries the current UTC day and never stores rolling-window snapshots.
- Each scheduled run executes one GraphQL query only.
- Successful captures upsert one final row per UTC day, so reruns converge to one row for that day.
- If the Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day rather than writing synthetic zeroes.
- If the query returns no daily row for the selected day/hostname, Lighthouse treats the run as failed and skips the row.
- Lighthouse validates that the response includes a numeric daily request `count` field; if missing/undefined/non-numeric, the run is treated as failed and the row is skipped.
- Authenticated `/report` also performs one best-effort refresh capture for the previous completed UTC day before report assembly, using the same per-day capture logic.

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as dev dependency)
- A Cloudflare account

### 2. Install dependencies

```bash
npm install
```

### 3. Create the D1 database

```bash
npx wrangler d1 create buscore-lighthouse
```

Copy the `database_id` from the output and replace `YOUR_D1_DATABASE_ID` in `wrangler.toml`.

### 4. Apply migrations

```bash
# local (for wrangler dev)
npx wrangler d1 migrations apply buscore-lighthouse --local

# remote (production)
npx wrangler d1 migrations apply buscore-lighthouse --remote
```

### 5. Set secrets

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put CF_API_TOKEN
```

Add `CF_ZONE_TAG` to your Worker environment configuration before deploying scheduled traffic capture.

### 6. Configure `wrangler.toml`

Ensure existing bindings are configured for your environment (`DB` and `MANIFEST_R2`).
Also configure `CF_ZONE_TAG` and ensure the scheduled traffic pull is authorized with `CF_API_TOKEN`.

### 7. Deploy

```bash
npm run deploy
```

### Local development

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck
```
