# Changelog

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
