# Phase 3 Analytics — Implementation Notes (Lighthouse + Agent Smith)

> **Historical implementation record.** This file preserves the Phase 3 delivery context and is not the current operational runbook. Use `SOT.md` and `OPERATIONS.md` for current Lighthouse behavior and diagnostics, and Agent Smith's current authority for its active report mode and presentation. `POST /report/snapshot` is a write. Do not infer Agent Smith's active production lane from the historical monthly workflow described here.

Scope: Phase 3 of `BUS-Core-Analytics-Plan.md`. Monthly Asset Brief + deterministic scoring +
report archival + operator notes. No Phase 4, no new telemetry, no AI, no BUS Core Core change,
no public dashboards, no PII.

## Split of responsibility (unchanged architecture)
- **Lighthouse (data + scoring layer):** two new tables, deterministic score helpers, a
  `view=monthly` structured read, and two admin-write routes (`POST /notes`, `POST /report/snapshot`).
- **Agent Smith (presentation + scheduled Discord layer):** `formatMonthlyBrief()` and a
  first-of-month cron that fetches `view=monthly`, posts the brief, then archives it back to
  Lighthouse. Smith stays stateless; the archive lives in Lighthouse D1.

## Lighthouse

### Tables (migration `0011_add_phase3_report_and_notes.sql`, additive)
- `report_snapshots(id PK, generated_at, kind, status, wqpi, summary_json, narrative)` — dated
  archive of each generated brief. Aggregate only. Indefinite retention.
- `operator_notes(id PK, created_at, note, tag)` — operator annotations feeding the monthly
  narrative. Indefinite retention.

### Deterministic scoring (pure, exported, honest)
Five 0–100 scores, each returned as `{ score: number|null, available, reason, weight, inputs }`.
- **Never faked.** If the primary input is missing (e.g. no `daily_rollup`/`github_snapshots`/
  `health_checks` yet), `score` is `null` with a reason like `"awaiting first scheduled rollup"`
  or `"insufficient data"`. Missing components are re-normalized over what IS present, and the set
  of contributing components is reported.
- **Raw numbers are never hidden:** every score carries its `inputs` object. A score without its
  inputs is a bug the tests catch.
- Scores: Product Intent, Community Response, GitHub Trust, Reliability, and the composite
  Acquisition Readiness (30/20/15/10/15/10 over Product Intent / Reliability / Community /
  GitHub Trust / Lead Quality / Positioning). Acquisition Readiness is **capped by Reliability**
  (an unreliable asset cannot score high) and returns `null` if Reliability is unavailable.
- **A score is not a valuation.** The wording says so; no dollar figure is produced.
- Downloads are never called users; update checks are never called active users; Cloudflare
  requests are never called human usage; stars are weighted ≤10% of GitHub Trust.

### Read: `GET /report?view=monthly` (admin-protected)
Returns the previous completed calendar month's structured asset data: wQPI MoM, downloads,
attributed leads + lead quality, known-version check-in average + adoption, community
(posts → downstream, per-channel), reliability (uptime/errors/freshness), GitHub health, the five
scores (with inputs), recent operator notes, and the previous month's Acquisition Readiness (from
`report_snapshots`) for the delta. Missing pieces are `null`/`unavailable`, never faked. Skips the
traffic refresh (reads stored aggregates only).

### Write routes (admin-token, like `/report` and `/campaign`)
- `POST /notes` — insert an operator note `{ note, tag? }`.
- `POST /report/snapshot` — archive a generated brief `{ kind, status?, wqpi?, summary_json?, narrative? }`.

## Agent Smith
- `formatMonthlyBrief(monthly)` — deterministic renderer. Shows Acquisition Readiness with the
  MoM delta AND all five sub-scores with their raw inputs beneath it, organic demand, repeat
  interest, community, reliability, GitHub health, lead quality, a rule-based narrative + risks,
  and operator notes. Handles null/unavailable/insufficient-data honestly (`unavailable`,
  `insufficient data`, `awaiting first scheduled rollup`). No AI.
- New cron `0 15 1 * *` (1st of month, 15:00 UTC). Daily (`0 13 * * *`) and weekly (`0 14 * * 1`)
  are unchanged. The scheduled handler routes by `event.cron`.
- After posting the monthly, Smith archives it via `POST /report/snapshot` (best-effort; a failed
  archive never blocks the post).

## Explicitly NOT in Phase 3
Phase 4 (deeper community attribution, daily/weekly archival, richer notes UI), any new telemetry,
AI interpretation, BUS Core Core changes, public dashboards, or scoring that hides raw numbers.
