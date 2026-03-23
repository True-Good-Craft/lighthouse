# Changelog

## [1.4.3] - 2026-03-23

### Added
- Add temporary development-only route `GET /_dev/capture-traffic` to trigger the existing shared Buscore traffic capture helper on demand for the previous completed UTC day.

### Changed
- The temporary route returns a compact capture diagnostic payload with `target_day`, `attempted`, `appears_successful`, `result` (`captured`/`skipped`/`failed`), and `details`.
- The temporary route does not alter cron behavior, `/report` behavior, or non-traffic metrics behavior.

## [1.4.2] - 2026-03-23

### Changed
- `GET /report` now performs a best-effort lazy backfill check for the previous completed UTC day traffic snapshot: if that day is missing in `buscore_traffic_daily`, Lighthouse attempts one capture for that exact day before assembling the report.
- Lazy backfill reuses the same traffic capture logic as scheduled daily capture and does not replace cron behavior.
- If lazy backfill fails, `/report` still returns successfully using currently stored traffic data only; no synthetic traffic rows are created.

## [1.4.1] - 2026-03-23

### Fixed
- Tighten Cloudflare GraphQL traffic capture validation so a daily snapshot row is only written when a numeric daily `pageViews` metric is present in the single-query response.
- If the GraphQL query returns no daily result row (for example due to dataset/filter mismatch), Lighthouse now treats this as capture failure and skips writing the day instead of inserting synthetic zero traffic.

## [1.4.0] - 2026-03-23

### Added
- Add additive Buscore traffic telemetry capture via a daily Lighthouse cron that pulls one completed UTC day snapshot from the Cloudflare GraphQL Analytics API into D1 table `buscore_traffic_daily`.
- Extend `GET /report` with a compact top-level `traffic` object containing `latest_day` and `last_7_days` traffic summaries.

### Changed
- Lighthouse now includes scheduled daily traffic capture in addition to the existing `fetch` request surface.
- Traffic capture uses a single Cloudflare GraphQL query per scheduled run, always scoped to the previous completed UTC day for hostname `buscore.ca` and zone `CF_ZONE_TAG`.
- Successful traffic pulls upsert one final row per day, making reruns idempotent for the same UTC day.
- If the Cloudflare traffic pull fails or returns GraphQL errors, Lighthouse skips that day rather than writing synthetic zeroes; core metrics and existing `/report` fields continue to operate unchanged.
- Traffic `pageviews` are sourced from a direct daily Cloudflare page view metric; `visits` remain `null` in the current implementation because the chosen single daily query does not use a documented direct visits metric for this path.
- Add explicit version/release authority: shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned by `package.json`; behavioral changes are not released unless all three are updated together.

## [1.3.0] - 2026-03-12

### Changed
- `GET /update/check` now increments `update_checks` for all requests (unless IP is in `IGNORED_IP`), removing the requirement for `X-BUS-Update-Source: core` header.
- Restored simple counting logic to `/update/check` while maintaining manifest/download route split.

## [1.2.0] - 2026-03-12

### Fixed
- Fix analytics drift where internal and public manifest reads could inflate `update_checks` counters.
- Gate `update_checks` counting in `GET /update/check` to only increment when header `X-BUS-Update-Source: core` is present.
- Designate `GET /manifest/core/stable.json` as the canonical public manifest read route with no counter increment.
- Preserve counted download intent on `GET /download/latest` without double-counting via `GET /releases/:filename`.

### Changed
- `GET /update/check` now requires `X-BUS-Update-Source: core` header to increment counters; returns manifest normally in all cases, with or without the header.
- `GET /manifest/core/stable.json` now explicitly documented as the public manifest hydration route.

## [1.1.1] - 2026-03-11

### Fixed
- Fix release download path handling so `manifest.latest.download.url` values like `/releases/TGC-BUS-Core-1.0.2.zip` are accepted and redirected correctly by `/download/latest`.
- Add `GET /releases/:filename` to stream release artifacts from R2 key `releases/:filename` so public Lighthouse release URLs no longer return `not_found` when the object exists.

## [1.1.0] - 2026-03-10

### Added
- `IGNORED_IP` secret: requests whose `CF-Connecting-IP` exactly matches this value skip `update_checks` and `downloads` counter increments while still receiving normal responses.

## Unreleased

### Planned (not shipped)
- Evaluate Price Guard calculation event tracking via D1 `calculations` metric.
- Evaluate whether `calculations` should be included in `/report` if and when ingestion ships.
- Evaluate migration of future Price Guard metrics from KV-based signaling to D1 aggregates.
- Evaluate introducing `/pg/ping` with strict auth/CORS only if approved and documented in SOT.
- Evaluate migration from fixed aggregate columns to a generic metric-ledger model where appropriate.

### Clarifications
- Current shipped Lighthouse already uses protected, on-demand reporting via `GET /report`.
- Current shipped Lighthouse has no cron summaries and no outbound Discord reporting.
