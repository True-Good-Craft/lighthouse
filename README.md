# buscore-lighthouse

BUS Core update lighthouse: manifest proxy + daily counters + protected on-demand reporting.

## Overview

A single Cloudflare Worker that:

1. **Serves** the BUS Core update manifest JSON from R2.
2. **Counts** update checks and "latest download" clicks into deterministic daily totals stored in D1. 
3. **Exposes** protected aggregate stats at `GET /report`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/update/check` | Increment `update_checks`, return manifest JSON |
| GET | `/download/latest` | Increment `downloads`, 302-redirect to `latest.download.url` from manifest |
| GET | `/report` | Return JSON totals (protected by `X-Admin-Token` header) |

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
```

### 6. Configure `wrangler.toml`

Ensure the existing bindings are configured for your environment (`DB` and `MANIFEST_R2`).

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

## Manifest shape

The worker expects the manifest JSON to have at least this shape for the `/download/latest` redirect:

```json
{
  "latest": {
    "download": {
      "url": "https://example.com/releases/v1.2.3/TGC-BUS-Core-v1.2.3.zip"
    }
  }
}
```

## D1 schema

```sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  day           TEXT    PRIMARY KEY,
  update_checks INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0
);
```

## Report endpoint

`GET /report` requires the header `X-Admin-Token: <ADMIN_TOKEN>` and returns:

```json
{
  "today":         { "update_checks": 0, "downloads": 0, "errors": 0 },
  "yesterday":     { "update_checks": 0, "downloads": 0, "errors": 0 },
  "last_7_days":   { "update_checks": 0, "downloads": 0, "errors": 0 },
  "month_to_date": { "update_checks": 0, "downloads": 0, "errors": 0 }
}
```

## Scheduling

This worker has no cron trigger and does not send outbound report summaries.
