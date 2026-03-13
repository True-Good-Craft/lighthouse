# Changelog

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
