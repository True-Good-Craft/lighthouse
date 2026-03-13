# Lighthouse — Source of Truth

## 1. System Overview

- Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-only stats source.
- Lighthouse is a generic, deterministic metrics primitive; BUS Core is a current observed client/use-case, not a runtime dependency.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, and exposes an admin-protected `GET /report` endpoint.
- It does not run scheduled reporting and does not post reports to Discord.
- Runtime surface: Worker `fetch` handler only.

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
- No cron behavior unless explicitly approved in this SOT.
- No outbound posting or outbound integrations unless explicitly approved in this SOT.
- The current fixed metric model (`update_checks`, `downloads`, `errors`) is shipped behavior unless this SOT explicitly changes it.
- SOT, changelog, and implementation must stay aligned.

## 3. Entry Points

`fetch(request, env)` in `src/index.ts` handles:

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
  - On success: returns aggregate stats JSON with `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends`.

- Fallback behavior
  - `OPTIONS` returns `200`.
  - Non-`GET` methods return `405` JSON `{ "ok": false, "error": "method_not_allowed" }`.
  - Unmatched routes return `404` JSON `{ "ok": false, "error": "not_found" }`.

## 4. Persistence

- D1 binding: `DB`
- Table: `metrics_daily`
- Aggregate counters: `update_checks`, `downloads`, `errors`
- Day key format: UTC `YYYY-MM-DD`

## 5. Configuration

Required bindings/secrets used by code:

- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`
- `IGNORED_IP` — optional; if set, requests whose `CF-Connecting-IP` exactly matches this value skip counter increments but receive normal responses.

Not used by current code:

- Discord webhook secrets
- Cron triggers

## 6. Reporting Model

- Reporting is on-demand only via authenticated `GET /report`.
- No scheduled handler.
- No outbound report delivery.

### Report Contract Stability

- `GET /report` is an operator-facing contract, not an ad-hoc analytics surface.
- Current shipped response shape includes: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`.
- Current shipped `trends` fields include: `downloads_change_percent`, `update_checks_change_percent`, `weekly_downloads_change_percent`, `weekly_update_checks_change_percent`, `conversion_ratio`.
- `conversion_ratio` is defined as today downloads divided by today update checks (with safe zero-denominator handling).
- Changes to `/report` response fields or semantics require explicit SOT update and changelog entry in the same change set.

## 7. Privacy and Security

- Aggregate-only storage in D1.
- No user identifiers, cookies, or tracking.
- `/report` is protected by `X-Admin-Token` exact match to `env.ADMIN_TOKEN`.

## 8. Explicit Non-Features

- No `/health` route in current code.
- No scheduled/cron reporting.
- No Discord webhook integration.
- No automatic push reporting.
