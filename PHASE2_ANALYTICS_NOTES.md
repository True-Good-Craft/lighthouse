# Phase 2 Analytics Foundation — Implementation Notes (Lighthouse)

> **Historical implementation record.** This file preserves the Phase 2 delivery context and is not the current operational runbook. For current behavior use `SOT.md`; for access, side effects, and diagnosis use `OPERATIONS.md`. In particular, current scheduled liveness uses non-counted public manifest HEAD, exact canonical artifact HEAD, GET-only lead probing, and the public GitHub latest-release page as defined by the current SOT.

Scope: Phase 2 of `BUS-Core-Analytics-Plan.md`. Lighthouse (data layer) only.
No Phase 3, no scoring, no monthly asset brief, no AI, no BUS Core Core changes,
no invasive telemetry, no PII, no Agent Smith outbound changes.

## What is added

Four additive D1 tables (migration `0010_add_phase2_analytics_foundation.sql`) plus
idempotent scheduled writers, one new admin-protected write route, and one new read view.
Lighthouse remains the analytics/data layer; it does not post to Discord.

### 1. `daily_rollup` — one aggregate row per completed UTC day
- Writer `captureDailyRollup(env)` runs in the daily cron for the **previous completed UTC day**
  (same day convention as traffic capture, so rows are never partial-day).
- Reuses existing report query helpers (no parallel math): `queryTotalsInRange` (errors),
  `queryReleaseDownloadTotalsInRange` (artifact_downloads), `queryReleaseUpdateSignalsInRange`
  (update_checks_known, latest_checkins), `queryTrafficTotalsInRange` (cf_requests, cf_visits),
  `buildSiteEventSummary` for BUS Core (page_views, download_clicks, top_source, top_referrer),
  and `queryLeadAttributionCounts` on `BUSCORE_LEADS_DB` (leads_total, attributed_leads).
- `wqpi = artifact_downloads + attributed_leads` — same definition as the Phase 1 brief.
- Idempotent: `INSERT ... ON CONFLICT(day) DO UPDATE`; `day` is PRIMARY KEY. Safe to re-run.
- Honest nulls: if `BUSCORE_LEADS_DB` is absent, `attributed_leads`/`leads_total`/`wqpi` are `null`
  (not zero). `return_rate` is stored `null` — it is a 7-day windowed metric, not an honest
  single-day value with current helpers; it is intentionally not faked here.
- This unlocks a real "changes since yesterday" in a later phase (Phase 1 used a fallback).

### 2. `campaign_log` — operator-authored community post log
- Written via a new **admin-token-protected** route `POST /campaign` (same `ADMIN_TOKEN` as
  `/report`). Chosen over manual-only insert so the operator can log from anywhere; it is a
  low-risk mutating route (aggregate/operator text only, no user data). A manual
  `wrangler d1 execute` insert remains possible and is documented in the SOT.
- Operator-authored only. No user data, no lead PII.
- Indefinite retention. Indexed on `posted_at`, `utm_campaign`, `tagged_src`.
- Downstream attribution: `view=asset` joins each recent campaign to BUS Core `site_events_raw`
  and `early_access_leads` by `tagged_src` / `utm_campaign` on/after `posted_at`, proving whether
  a post produced action.

### 3. `github_snapshots` — daily GitHub project-health trend
- Writer `captureGithubSnapshot(env)` uses the **public GitHub API** (or `GITHUB_TOKEN` if set).
  Repo defaults to `GITHUB_REPO` env or `True-Good-Craft/TGC-BUS-Core`.
- Each field is fetched under its own try/catch; any unavailable field is stored `null`, never
  faked. `release_asset_downloads` comes from the public releases API (available unauthenticated).
- Stars are stored but treated as a weak signal; cadence/releases/issues/PRs/contributors matter
  more. Idempotent `ON CONFLICT(day) DO UPDATE`.

### 4. `health_checks` — active funnel liveness
- Writer `runHealthChecks(env)` probes, once per daily cron (low frequency, no spamming):
  site home, `/downloads`, manifest read (non-counting), `/download/latest` redirect,
  release artifact via a **Range `bytes=0-0` GET** (excluded from the download counter by design,
  so probing never inflates `downloads`), lead endpoint liveness via **GET only** (never POST —
  no synthetic leads), and GitHub releases reachability.
- The update path is validated via the **non-counting manifest read**, never via `/update/check`
  (a GET there would inflate `update_checks`).
- Each probe is isolated: a failure records `ok = 0` with a note; it never throws and never breaks
  Lighthouse reporting or the rest of the scheduled run. `pruneHealthChecks` keeps ~90 days.

## Read path
- New `view=asset` on `GET /report` (admin-protected, like all report views): returns latest +
  recent `daily_rollup`, latest `github_snapshots`, latest-per-target `health_checks`, and recent
  `campaign_log` with downstream counts. Existing `legacy`/`fleet`/`site`/`source_health` views are
  unchanged. `view=asset` skips the best-effort traffic refresh (reads stored aggregates only).

## Scheduling
- Existing daily cron `5 0 * * *` (00:05 UTC). Order: traffic capture first (so the rollup sees
  the day's traffic row), then rollup + github snapshot + health checks + prunes run guarded and
  in parallel. One writer failing cannot break the others or the scheduled run.

## Privacy
- All four tables are aggregate/operator-authored. No emails, no `bc_uid`/`bc_sid`, no
  `anon_user_id`/`session_id`, no raw or hashed IPs, no user-agent, no fingerprints. `top_source`/
  `top_referrer` are channel/domain names, not user identities. `view=asset` exposes none of the above.

## Explicitly NOT in Phase 2
Scoring, monthly asset brief, Agent Smith outbound changes, new site telemetry/events, in-app
analytics, any BUS Core Core change. Those are Phase 3+.
