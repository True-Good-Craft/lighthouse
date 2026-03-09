# Lighthouse — Source of Truth

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-only stats source.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, and exposes an admin-protected `GET /report` endpoint.
- It does not run scheduled reporting and does not post reports to Discord.
- Runtime surface: Worker `fetch` handler only.

## 2. Entry Points

`fetch(request, env)` in `src/index.ts` handles:

- `GET /manifest/core/stable.json`
  - Reads `manifest/core/stable.json` from `MANIFEST_R2`.
  - Returns `200` manifest JSON on success.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when unavailable.

- `GET /update/check`
  - Increments `update_checks` in D1 for current UTC day.
  - Returns manifest JSON.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` on manifest errors.

- `GET /download/latest`
  - Increments `downloads` in D1 for current UTC day.
  - Redirects (`302`) to the validated release artifact URL from `manifest.latest.download.url`.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when URL is missing/invalid.

- `GET /report`
  - Requires header `X-Admin-Token`.
  - Auth check is exact equality against `env.ADMIN_TOKEN`:
    - `const token = request.headers.get("X-Admin-Token")`
    - `if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) { ...401 unauthorized... }`
  - On auth failure: returns `401` JSON `{ "ok": false, "error": "unauthorized" }`.
  - On success: returns aggregate stats JSON with `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends`.

- Fallback behavior
  - `OPTIONS` returns `200`.
  - Non-`GET` methods return `405` JSON `{ "ok": false, "error": "method_not_allowed" }`.
  - Unmatched routes return `404` JSON `{ "ok": false, "error": "not_found" }`.

## 3. Persistence

- D1 binding: `DB`
- Table: `metrics_daily`
- Aggregate counters: `update_checks`, `downloads`, `errors`
- Day key format: UTC `YYYY-MM-DD`

## 4. Configuration

Required bindings/secrets used by code:

- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`

Not used by current code:

- Discord webhook secrets
- Cron triggers

## 5. Reporting Model

- Reporting is on-demand only via authenticated `GET /report`.
- No scheduled handler.
- No outbound report delivery.

## 6. Privacy and Security

- Aggregate-only storage in D1.
- No user identifiers, cookies, or tracking.
- `/report` is protected by `X-Admin-Token` exact match to `env.ADMIN_TOKEN`.

## 7. Explicit Non-Features

- No `/health` route in current code.
- No scheduled/cron reporting.
- No Discord webhook integration.
- No automatic push reporting.
