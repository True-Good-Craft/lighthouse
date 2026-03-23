# buscore-lighthouse

Lighthouse is a single Cloudflare Worker that provides a small, deterministic, privacy-first, aggregate-only metrics primitive.

Architectural rule:
- Lighthouse is a standalone service and operationally independent.
- It is independently runnable and not hard-dependent on BUS Core or any other external service.
- BUS Core is a current observed client/traffic source, but Lighthouse core operation must remain independent.
- Integrations must remain optional, additive, and non-blocking.

Release authority:
- Shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned by `package.json`.
- No behavioral, contract, storage, configuration, auth, or scheduling change is considered released unless all three are updated together in the same change set.

## Glossary

- Aggregate-only: stores only daily aggregate counters, not user-level event logs or identifiers.
- Operationally independent: can run and serve core routes without requiring any other service to be available.
- Observed client: an external system that calls Lighthouse (for example BUS Core) without becoming a runtime dependency.
- Core operation: manifest serving, aggregate counting, and protected on-demand reporting.
- Optional integration: an additive external integration that does not block core operation when unavailable.
- Shipped behavior: behavior currently implemented and documented as present reality.
- Future direction: planned or proposed behavior not yet shipped.

## Current System

Lighthouse currently does three things:

1. Serves the BUS Core manifest from R2.
2. Increments fixed daily aggregate counters in D1.
3. Exposes protected, on-demand aggregate reporting.
4. Pulls one daily Buscore traffic snapshot from the Cloudflare GraphQL Analytics API into D1 on a scheduled cron.

It does not store user-level telemetry or identifiers.

## Routes

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/manifest/core/stable.json` | Return manifest JSON from R2 (no counting) |
| GET | `/update/check` | Return manifest JSON and increment `update_checks` unless request IP matches `IGNORED_IP` |
| GET | `/download/latest` | Increment `downloads` unless request IP matches `IGNORED_IP`, then `302` redirect to latest release URL from manifest |
| GET | `/releases/:filename` | Serve release artifact from R2 key `releases/:filename` (no counting) |
| GET | `/report` | Return protected aggregate report (requires `X-Admin-Token`) |

Notes:
- `/manifest/core/stable.json` and `/releases/:filename` never increment counters.
- `/update/check` does not require `X-BUS-Update-Source: core` for counting.
- If `IGNORED_IP` is configured and matches `CF-Connecting-IP`, counting is suppressed while normal responses are still returned.

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
      "pageviews": 0,
      "referrer_summary": null
    },
    "last_7_days": {
      "visits": null,
      "pageviews": 0,
      "referrer_summary": null
    }
  }
}
```

Contract note:
- `/report` is treated as an operator contract.
- Field additions/removals or semantic changes must be deliberate and documented in SOT/changelog, not ad-hoc.
- Existing top-level fields `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends` remain intact and semantically unchanged.
- `traffic.latest_day` is the most recent completed UTC day snapshot stored in D1.
- `traffic.last_7_days` aggregates stored traffic rows within the last seven UTC days.
- If a traffic window has no stored data, its traffic fields return `null` instead of synthetic zeroes.
- `pageviews` come from a direct daily Cloudflare page view metric.
- `visits` are currently `null` because this implementation does not derive visits and the chosen single daily query path does not use a documented direct visits metric.
- `referrer_summary` is currently `null` because this change intentionally avoids adding referrer complexity or extra query paths.

## D1 Schema (Current)

```sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  day           TEXT    PRIMARY KEY,
  update_checks INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS buscore_traffic_daily (
  day              TEXT    PRIMARY KEY,
  visits           INTEGER NULL,
  pageviews        INTEGER NOT NULL,
  referrer_summary TEXT    NULL,
  captured_at      TEXT    NOT NULL
);
```

## Configuration

Required bindings/secrets:
- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`
- `IGNORED_IP` (optional)
- `CF_API_TOKEN` (required for scheduled Buscore traffic capture)
- `CF_ZONE_TAG` (required for scheduled Buscore traffic capture)

## Scheduling

Lighthouse is on-demand only.
- Daily cron trigger captures one previous completed UTC day Buscore traffic snapshot from the Cloudflare GraphQL Analytics API.
- No outbound Discord posting.

Traffic capture notes:
- The cron always queries the previous completed UTC day. It never queries the current UTC day and never stores rolling-window snapshots.
- Each scheduled run executes one GraphQL query only.
- Successful captures upsert one final row per UTC day, so reruns converge to one row for that day.
- If the Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day rather than writing synthetic zeroes.
- If the query returns no daily row for the selected day/hostname, Lighthouse treats the run as failed and skips the row.
- Lighthouse validates that the response includes a numeric daily pageviews field; if missing/undefined/non-numeric, the run is treated as failed and the row is skipped.

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
