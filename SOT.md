# Lighthouse — Source of Truth

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-only stats source.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, and exposes an admin-protected `GET /report` endpoint.
- It does not run scheduled reporting and does not post reports to Discord.
- Runtime surface: Worker `fetch` handler only.

## 2. Entry Points

`fetch(request, env)` in `src/index.ts` handles:

### Manifest Service

- `GET /manifest/core/stable.json` — **Canonical public manifest read route**
  - Returns manifest JSON from `MANIFEST_R2` to web pages, downloads pages, and other clients.
  - **Never increments any counters** (no counting on success; only error counts on failure).
  - Returns `200` manifest JSON on success.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when unavailable.

- `GET /update/check` — **Manifest proxy with conditional counting gate**
  - Returns manifest JSON from `MANIFEST_R2` in all cases (with or without header).
  - Increments `update_checks` in D1 (current UTC day) **only when both conditions are true**:
    - Request header `X-BUS-Update-Source` equals exactly `core`, AND
    - Request IP does not match `IGNORED_IP`
  - Intended to be called by BUS Core with the `X-BUS-Update-Source: core` header to count genuine update checks.
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
- `IGNORED_IP` — optional; if set, requests whose `CF-Connecting-IP` exactly matches this value skip counter increments but receive normal responses.

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
