# Lighthouse Plan

This document is a planning artifact for Lighthouse.
It distinguishes current shipped reality from future direction.

## Current System Reality

Lighthouse is currently a single Cloudflare Worker that is privacy-first and aggregate-only.

Current shipped behavior:
- Serves manifest JSON at `GET /manifest/core/stable.json` with no counting.
- Serves update checks at `GET /update/check` and increments fixed `update_checks` counter unless `IGNORED_IP` matches the request IP.
- Serves download initiation at `GET /download/latest` and increments fixed `downloads` counter unless `IGNORED_IP` matches the request IP.
- Serves release artifacts at `GET /releases/:filename` from R2 with no counting.
- Exposes protected, on-demand reporting at `GET /report` using `X-Admin-Token`.

Current persisted aggregate model:
- D1 table `metrics_daily` with fixed columns: `update_checks`, `downloads`, `errors`.
- Daily key is UTC date (`YYYY-MM-DD`).
- Reporting output includes: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`.

Current operational model:
- On-demand reporting only.
- No cron-triggered jobs.
- No outbound Discord posting.

## Confirmed Constraints

- Aggregate-only storage; no user-level telemetry.
- Deterministic counter increments from explicit server-side paths.
- Protected admin reporting via exact token match.
- Lighthouse must remain operationally independent and independently runnable as a standalone service.
- Lighthouse must not become hard-dependent on BUS Core, Price Guard, Discord, email, cron, or any other external service for core operation.
- Integrations are allowed only as optional, additive, non-blocking layers.
- Any roadmap item that would make Lighthouse unable to function without another system must be rejected or reworked.
- Keep public behavior aligned with SOT and changelog before introducing new capability.
- Avoid implicit expansion of scope through docs that describe unshipped behavior as current.

## Near-Term Doc/Operational Priorities

- Keep README and SOT synchronized with the shipped route surface.
- Keep reporting contract documentation explicit and stable for operators.
- Treat `/report` as an operator contract, not an improv analytics surface.
- Keep changelog Unreleased entries clearly marked as planned, not shipped.
- Preserve terminology consistency: aggregate-only, privacy-first, single Cloudflare Worker, on-demand reporting.
- Keep deployment/runbook docs concise and operationally focused.
- Keep Lighthouse fixed-metric in the near term for simplicity, inspectability, and drift resistance.

## Approved/Desired Future Direction

These items are strategic direction, not current implementation:

- Keep the fixed metric model as the default until at least 2-3 additional stable, recurring counters justify migration complexity.
- Re-evaluate migration from fixed counter columns to a dynamic metric-ledger model (`day`, `metric`, `count`) only when that threshold is met.
- Evaluate a metric-based increment helper that can support additional counters without schema changes.
- Evaluate Price Guard integration for a `calculations` metric in D1, including auth and failure semantics.
- Evaluate all integrations under a strict independence gate: integration failure must not block Lighthouse core request handling and reporting.
- If the metric-ledger model ships, revise reporting aggregation and documentation together in one controlled change set.
- Consider a public metrics board only after storage/reporting contracts are stable and documented.

## Explicit Non-Goals / Not Yet Implemented

Not currently in Lighthouse:
- Dynamic metric enumeration in runtime reporting.
- Generic `(day, metric, count)` storage schema.
- Price Guard metric ingestion endpoint and `calculations` counter in shipped reports.
- Cron summaries.
- Discord report posting.
- Any per-user telemetry or behavioral tracking.

Roadmap guardrail:
- Lighthouse is not a BUS Core submodule and must not be planned as BUS Core-dependent infrastructure.
