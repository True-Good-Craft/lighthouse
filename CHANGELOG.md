# Changelog

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

### Added
- Track Price Guard calculation events via D1 `calculations` metric.
- Include `calculations` in `/report` output.
- Include `calculations` in scheduled Discord daily summary.
- Add derived analytics in `/report` trends: daily change percentages, weekly change percentages, and conversion ratio.

### Changed
- Migrate Price Guard ping from KV to D1.
- Add strict CORS handling to `/pg/ping` (OPTIONS + explicit origin allowlist).
- Extend reporting logic only; no schema changes or new counters were introduced.
- Improve operational visibility by exposing trend-oriented computed metrics from existing aggregates.
- Remove scheduled Discord reporting and outbound report-post delivery.
- Simplify Lighthouse to protected on-demand reporting via `GET /report`.
