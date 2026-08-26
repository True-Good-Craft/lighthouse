# Changelog

## [1.29.3] - 2026-08-26

- Added `OPERATIONS.md` as the canonical Lighthouse access and diagnostic runbook, including ownership boundaries, resource and credential maps, a morning-triage sequence, source/probe interpretation, and standard incident output.
- Routed agents and operators through the SOT and runbook before live access, with an explicit `ACCESS_BLOCKED` outcome when approved endpoint, credential, account, or tool access is unavailable.
- Documented that the shared `ADMIN_TOKEN` is broad and protects both report reads and administrative writes.
- Classified report, manifest, update, redirect, artifact, telemetry, scheduled, D1, deployment, and administrative surfaces by their possible evidence/state side effects.
- Marked the Phase 2, Phase 3, and policy-alignment documents as scoped historical or policy references rather than current operations authority.
- Reconciled cross-repository producer baselines to released BUS Core `1.4.2` and the merged buscore-site `1.4.2` release sync while retaining Agent Smith `0.25.2` as shipped authority; recorded the unresolved BUS Core restore/import signal authority drift rather than legitimizing it.
- Added the explicit owner-approved documentation-only bundle exception: code may be omitted only when runtime and contract behavior do not change; SOT, changelog, package, and lockfile remain mandatory, and dummy code changes are forbidden.
- No Worker code, endpoint, response contract, auth, configuration, binding, storage, retention, schedule, integration, migration, secret, or deployment behavior changed. The deployed Worker remains Lighthouse 1.29.2 (`f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`) with CEO contract `1.1`; version 1.29.3 identifies this repository documentation release.

## [1.29.2] - 2026-08-10

- Repaired the lead-endpoint health check so its safe GET probe accepts `405 Method Not Allowed` even when the live endpoint omits an `Allow` header; `404` and other failures still fail, and Lighthouse never creates a synthetic lead.
- Moved GitHub release liveness off the unauthenticated REST API quota shared by Cloudflare Worker egress. The scheduled probe now HEADs the public latest-release page and validates either `200` or a same-repository release-tag redirect.
- Kept the CEO report and metric-definition contract at `1.1`; report facts, source freshness/coverage semantics, routes, auth, storage, retention, and scheduled cadence are unchanged.
- No schema change, D1 migration, secret addition, or secret rotation was required.
- Deployed to `buscore-lighthouse` on 2026-08-10 at `2026-08-10T15:02:09.239256Z` as Cloudflare Worker version `f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`.

## [1.29.1] - 2026-08-09

- Prevented scheduled/public metadata `HEAD` probe failures from contaminating the general Lighthouse error counter while preserving genuine manifest `GET` failure accounting and raw/HEAD artifact truth.
- Bumped the strict CEO report-contract and metric-definition versions to `1.1` for nullable dependent details and trusted artifact-click semantics. Trusted possible-download interest begins on `2026-08-10`; earlier intent rows are excluded from sums and the watermark, wholly earlier windows are `null`, and spanning/later windows remain partial.
- Tightened CEO reporting so possible download interest requires a canonical Lighthouse artifact URL, available sparse sources never claim full coverage without a completeness ledger, and unavailable source-dependent details return `null` instead of plausible empty arrays.
- Enforced the TGC privacy contract at ingestion by storing only coarse `small`/`medium`/`large` viewport buckets and event-specific sanitized values for the bounded TGC allowlist. For rolling producer compatibility, exact lowercase `WIDTHxHEIGHT` remains accepted and is immediately bucketed by width before persistence.
- Reconciled the SOT and operator policies with standardized-event storage, keyed minute HMAC rate identifiers, CEO use of the optional leads database, the TGC 90-day raw-retention exception, current report families, BUS Core's no-installation-ID product contract, and TGC's active bounded Layer-5 extension.
- Ignored the repository-local npm cache used by repeatable verification so dependency checks do not dirty release worktrees.
- No schema change or D1 migration was required for 1.29.1. Worker 1.29.1 was deployed on `2026-08-09T16:41:20.004814Z` as Cloudflare Version ID `ee320e1a-9ceb-4d88-a848-fd7ae0e9e3bc` after typecheck, 162 tests, a Wrangler dry run, and confirmation that no remote migration was pending. The owner-approved release used the authenticated local Wrangler session because the repository currently has no Cloudflare credential secrets configured for GitHub Actions; no secret value was changed.

## [1.29.0] - 2026-08-09

- Narrowed TGC ingestion to aggregate decision signals: page views, selected commercial/contact/outbound interest, form start/attempt/outcome, and sanitized errors.
- Made Lighthouse discard `anon_user_id`, `session_id`, and `is_new_user` for `site_key=tgc_site`, including compatibility submissions from the superseded producer.
- Removed TGC identity-lifecycle, internal-navigation, field-level form, scroll/engagement/section, and first-party web-vital events from the server allowlist.
- Preserved the database schema, raw-event retention, protected report response shapes, CEO contract, and all non-TGC site behavior; no migration was required.
- Deployed Worker 1.29.0 on `2026-08-09T15:03:15.858733Z` as Cloudflare Version ID `757c24b7-fa98-40a5-8ea0-0e551d69c64f`; the 1.29.1 trust/privacy conformance issues were identified after that deployment.

## [1.28.0] - 2026-08-08

- Added authenticated `GET /report?view=ceo`, a strict versioned contract with exact partial/current and completed UTC windows for Agent Smith.
- Added per-source availability, freshness, coverage, and bounded failure reasons so unavailable measurements return `null` instead of plausible zeroes while unrelated sections remain usable.
- Added literal BUS Core discovery, distribution, opt-in product, update-check, and complete reliability-failure facts plus consented TGC page views and voluntary inquiry aggregates.
- Added two complete, non-overlapping seven-day windows for valid weekly comparison and kept the partial current UTC day out of trend claims.
- Limited CEO distribution to full artifact responses offered and daily source credits; partial Range responses are separate and are never presented as downloads, people, or installations.
- Changed scheduled release health checks to public GET of the non-counted stable manifest followed by public HEAD of its exact canonical artifact; `200` plus positive `Content-Length` is required, same-zone fetches are forced through the public Worker route, and no counted intent, full-response, daily source-credit, or CEO artifact metric is incremented.
- Made direct-source freshness fail closed from all-history watermarks: empty history is `unknown`/`source_history_missing`, old history is `stale`/`source_data_stale`, and only unavailable sources turn metric values into `null`.
- Bucketed voluntary-inquiry attribution into 14 fixed privacy-safe labels and merged counts after bucketing so raw emails, URLs, identifiers, and arbitrary referrer labels cannot leave Lighthouse.
- Consolidated CEO reads to nine D1 statements with at most three simultaneous operations, preserving headroom below D1 Free request and connection limits; product totals use fixed conditional aggregates and app versions are ranked and limited to ten in SQL so client-controlled cardinality never reaches Worker memory unbounded.
- Added a strict aggregate-only Draft 2020-12 JSON schema and healthy, observed, partial, product-failure, and core-source-failure fixtures shared with Agent Smith; tests compile it with strict Ajv 2020 and format validation against fixtures and live producer states.
- Corrected SOT drift for the removed raw product-event table, current null site-event abuse fields, the full scheduled task set, and stored-data report refresh behavior.
- Preserved all existing report views, public routes, stored history, and database schema. No migration was required; the CEO contract was later deployed with Worker 1.29.0.

## [1.27.0] - 2026-07-24

- Added explicit event-ID acknowledgements to successful and duplicate BUS Core product-telemetry responses so clients retain queued events until Lighthouse confirms idempotent persistence.
- Limited the event contract to release/update/reliability evidence and locally deduplicated first successful use of major product areas. Removed active-day, module-open, returning-installation, and retention reporting.
- Removed the persistent installation identifier from current payloads and reporting. Legacy payloads are accepted only for rollout compatibility and the identifier is discarded before persistence.
- Added migration 0015 to remove raw product-event history and retain only bounded event-ID deduplication keys plus aggregate counters.
- Split accepted update checks into startup and manual event counts while retaining legacy unspecified update-check acceptance.
- Applied migration 0015 remotely on 2026-07-24; verification confirmed the raw product-event table and trigger were removed, the dedup table exists, and the existing aggregate remained unchanged.
- Deployed Worker 1.27.0 at `2026-07-24T16:17:29.479Z` as Cloudflare Version ID `bff7362e-1896-4a1c-b104-ff2afc2351bc`.
- Verified the production canonical endpoint with non-persisting probes: the no-installation-ID payload shape reaches current validation, removed `active_day` is rejected, and no dedup or aggregate product event was added.

## [1.26.0] - 2026-07-18

- Added the protected `GET /report?view=tgc` commercial analytics view with today, 7-day, and 30-day acquisition, audience, engagement, funnel, performance, content, and health summaries.
- Enforced a TGC-specific site/event allowlist, production-origin matching, path/URL consistency, bounded context, and query/fragment stripping at ingestion.
- Added explicit support for consent-created TGC visitor/session IDs while keeping all identifiers out of operator reports and downstream-summary contracts.
- Replaced stored unsalted site-event IP/user-agent hashes with minute-scoped keyed abuse identifiers kept only in the two-day rate table; raw events no longer store IP hashes, user-agent hashes, or request IDs, and scheduled maintenance scrubs those legacy columns from existing rows.
- Added raw site-event retention: 90 days for `tgc_site`, 30 days for other site-event properties.
- Reused the existing D1 schema; no migration was added or applied.
- Added a gated Cloudflare deployment workflow that runs the full validation suite and deploys only on manual dispatch or an explicitly marked release merge, preserving provisioned Worker secrets.

## [1.25.0] - 2026-07-18

- Added `BUS_CORE_TRAFFIC_TRUTH.md` as the authoritative definition of artifact traffic, successful responses, HMAC client-network buckets, inferred download intent, confirmed product signals, lead separation, privacy, retention, rollout thresholds, rollback, evidence, and blind spots.
- Added migration `0014_add_artifact_traffic_truth.sql` with aggregate-only daily artifact and intent tables. It stores no raw IP, HMAC client key, user agent, email, or request identifier. The migration was applied remotely on 2026-07-18 at `17:12:45 UTC`.
- Kept every public manifest, update, redirect, and artifact route open. No artifact 429 or hard delivery limit is enabled because the production audit did not show repeated same-bucket traffic.
- Added Worker-visible raw/success/full/partial/HEAD/Range/failure/declared-byte, cache hit/miss, daily HMAC client-bucket, repeated-request, and redirect counters while retaining `downloads` as an explicitly legacy compatibility field.
- Added correct public HEAD and byte-range behavior, one-year immutable caching for canonical versioned full responses, query-free cache keys, cache diagnostics, and fail-soft D1/cache behavior.
- Added probable-human download-intent aggregation as an explicitly labelled production-origin, accepted-event, daily HMAC/IP proxy. Raw intent rows and existing conversion events remain available under their existing retention policy.
- Changed new report fields to be nullable with `artifact_measurement_available=false` when migration 0014 is absent, preventing a schema/read failure from becoming a false zero.
- Added 400-day aggregate cleanup and tests for 100 repeats, different clients/versions, 404, 206 Range, HEAD, cache hit/miss, legacy fallback, and report separation.
- Deployed Worker version 1.25.0 on 2026-07-18; the initial post-migration Cloudflare deployment is Version ID `1279aeb4-8904-491e-8130-b0d5a6657ef3`.

## [1.24.0] - 2026-07-17

- Keep public release artifact delivery unchanged while making download analytics fail closed behind the existing keyed abuse-control storage.
- Count only existing release artifacts served by full `GET` requests with Cloudflare client IP context, configured `TELEMETRY_RATE_LIMIT_SECRET`, a non-ignored IP, and no `Range` header.
- Cap counts at one request per HMAC-scoped IP, release version, and UTC day. Raw IPs are not stored, and the artifact scope is isolated from update checks and product telemetry.
- Skip counting when the secret, client IP, or rate-control storage is unavailable without interrupting artifact delivery.
- Clarify that `downloads` is a qualified, rate-bounded artifact-request signal, not a person, installation, unique lifetime downloader, or proof that the response body completed transfer.
- Reuse migration 0013 rate-control storage without a new migration. Historical aggregate rows are retained unchanged and age out of report windows normally.
- Deployed Worker version 1.24.0 on 2026-07-17 as Cloudflare Version ID `4abf7160-518d-4474-81f2-da8a27f1182a`.

## [1.23.0] - 2026-07-15

- Kept `GET /update/check` publicly available for manifest delivery while changing analytics to fail-closed qualified counting.
- Count only the exact BUS Core request tuple `current_version`, `channel`, and `first_check`, with no missing, duplicate, legacy-alias, header-fallback, or extra query fields.
- Require canonical SemVer at or above the first fully instrumented BUS Core version (`1.4.0`) and no newer than the selected channel's manifest version; non-stable channels require an explicit matching manifest entry.
- Require `first_check=true|false`, a recognized BUS Core release channel, Cloudflare client IP context, and configured `TELEMETRY_RATE_LIMIT_SECRET` before counting.
- Cap qualified counts at two requests per HMAC-scoped IP per UTC day. Raw IPs are not stored, scope hashes are isolated from product telemetry, and existing migration 0013 rate-control storage is reused without a new migration.
- Make abuse-control storage failures skip counting without interrupting manifest responses.
- Replace legacy unknown-client counting tests with strict-shape, plausible-version, explicit-channel, missing-secret/IP, fail-closed, and daily-cap coverage.

## [1.22.1] - 2026-07-12

- Fixed Cloudflare Worker startup validation by moving the local-only random rate-secret fallback out of module initialization and lazily initializing it in request scope.
- Preserved one stable fallback per isolate so local standalone requests retain effective minute-bucket rate limiting; production continues to use `TELEMETRY_RATE_LIMIT_SECRET`.
- Recorded that migration 0013 is applied remotely while the corrected Worker deployment remains pending.

## [1.22.0] - 2026-07-12

- Completed BUS Core product-telemetry v1 with server-derived installation/release, module-use, workflow-milestone, and reliability categories.
- Made raw acceptance and daily aggregation atomic through migration 0013's `AFTER INSERT` trigger while preserving event-id retry deduplication.
- Added bounded streaming body reads, strict payload/dimension limits, and HMAC-SHA256 rate identifiers keyed by a production secret and rotated each UTC minute.
- Added literal `product_telemetry` report windows with event/category/version/channel/OS counts, first launches, and aggregate returning-installation signals; no installation identifiers are returned.
- Kept `/update/check` authoritative for release-route checks and named product `update_check` events separately as delivery observations.
- Expanded production-like fixtures plus method, content, size, rate, prohibited-field, persistence-failure, retention, migration-trigger, report, route, and CORS coverage.
- Migration 0013 and the Worker remain unapplied and undeployed pending owner approval and production verification.

## [1.21.1] - 2026-07-12

- Completed update-check reconciliation documentation by adding the raw/breakdown/delta and first/repeat fields to the README report contract.
- Declared `raw_update_checks` authoritative for decisions and retained `release_signals.update_checks` as compatibility-only breakdown data.
- Added direct contract coverage for migration `0012_add_first_check_aggregates.sql`.
- No endpoint, storage, ingestion, or deployed behavior changed.

## [1.21.0] - 2026-07-10

- Added strict `POST /telemetry/v1/events` ingestion for BUS Core product telemetry schema `1.0`.
- Added an exact event allowlist, exact root/context field sets, UUIDv4 installation and event identifiers, SemVer/channel/OS validation, and rejection of unknown or unexpected fields.
- Added idempotent event retry handling, privacy-preserving short-lived IP-hash rate controls, 30-day raw retention, 400-day aggregate retention, and daily aggregation by event/version/channel/OS.
- Added migration `0013_add_buscore_product_telemetry.sql`, the canonical JSON contract fixture, and contract/integration tests proving prohibited extra content is rejected.
- Kept public-site event/pageview contracts and release/update routes unchanged. Deployment and remote migration remain owner-approved operations and were not performed.

## [1.20.2] - 2026-07-10

- Documented the approved, not-yet-shipped BUS Core product-telemetry direction and Lighthouse's future role as its versioned contract authority.
- Defined the event allowlist, field rejection, retention, installation-identifier, fail-soft, and prohibited-business-content boundaries that must exist before client telemetry ships.
- Preserved all currently deployed Lighthouse routes, schemas, reports, storage, and retention behavior; this is documentation and contract direction only.

## [1.20.1] - 2026-07-09

### Fixed
- Made Node test discovery shell-independent so the governance workflow runs on GitHub's Ubuntu runner instead of treating `tests/**/*.test.mjs` as a missing literal path.

### Changed
- Clarified user-owned commit, deployment, D1 migration, secret, and release approval rules.
- Added a minimum CI validation workflow for type-checking and tests.
- Updated the workflow actions to Node 24-based releases to avoid deprecated action-runtime warnings.

## [1.20.0] - 2026-07-09

BUS Core analytics repair — Ticket 4A: release-signal update-check reconciliation.
Additive, aggregate-only safety instrumentation; no migration, identity, or endpoint behavior change.

### Added
- **Raw-versus-breakdown reconciliation fields** in every `release_signals` window (`today`,
  `last_7_days`, and `last_30_days`): `raw_update_checks`
  (`SUM(metrics_daily.update_checks)`), `breakdown_update_checks`
  (`SUM(release_update_checks_daily.checks)`), and `raw_breakdown_delta`
  (`raw_update_checks - breakdown_update_checks`). A positive delta exposes a successful raw
  counter increment whose additive versioned-breakdown write did not persist.
- **Contract coverage** for normal, old-client, known-version first-check, and simulated
  release-signal write-failure reconciliation. The update endpoint remains successful when its
  best-effort breakdown write fails.

### Changed
- Bumped version to `1.20.0`.

### Notes
- Existing `release_signals.update_checks` and all existing report fields remain unchanged;
  `update_checks` continues to represent the versioned breakdown total for compatibility.

## [1.19.0] - 2026-07-09

BUS Core analytics repair — Ticket 3: aggregate-safe `first_check` on `/update/check`.
Additive, aggregate-only, no PII, no identity, no dedupe, no install ID.

### Added
- **Three additive counters** on `release_update_checks_daily` (migration
  `0012_add_first_check_aggregates.sql`): `first_check_true`, `first_check_false`, and
  `first_check_unknown` (`INTEGER NOT NULL DEFAULT 0`). `first_check` is **not** part of the row
  key — each successful `/update/check` increments exactly one counter on the existing row, so
  reporting stays additive with no row explosion.
- **Optional `first_check` query param** on `GET /update/check`, parsed strictly: `true`/`1` →
  first-seen check, `false`/`0` → repeat check, missing/invalid → unknown first-check status.
  Never inferred from IP, user agent, cookies, or timing.
- **`release_signals` first-check aggregates** in each window (`today`/`last_7_days`/`last_30_days`):
  `first_seen_checkins` (`SUM(first_check_true)`), `repeat_checkins` (`SUM(first_check_false)`),
  `unknown_first_checkins` (`SUM(first_check_unknown)`), and `first_seen_share`
  (`first_seen_checkins / (first_seen_checkins + repeat_checkins)`, or `0` when that denominator
  is `0`). These are aggregate check-in buckets only — not users, installs, devices, or unique
  anything.
- **Contract tests**: new/repeat/old-client/invalid `first_check` handling, `1`/`0` aliases,
  case-insensitivity, best-effort D1 write isolation, report sums + share, a manifest parse guard
  (`1.3.3` valid vs. strict rejection of `v1.3.3` → `unknown`), and `/report` vs
  `/report?site_key=buscore` release-signal parity.

### Changed
- Bumped version to `1.19.0`.

### Notes
- Existing `release_signals` fields, `metrics_daily` counters, manifest/download/lead/site-ingest
  behavior, and old query-param-less `/update/check` clients are unchanged. D1/reporting failures
  never break `/update/check`.

## [1.18.0] - 2026-07-06

Phase 3 analytics (`BUS-Core-Analytics-Plan.md`): Monthly Asset Brief data + deterministic
scoring + report archival + operator notes. Additive, aggregate-only, no PII, no new telemetry,
no AI. Lighthouse remains the data/scoring layer and does not post to Discord.

### Added
- **Two additive D1 tables** (migration `0011_add_phase3_report_and_notes.sql`):
  `report_snapshots` (dated archive of generated briefs) and `operator_notes`.
- **Deterministic scoring** (pure, exported): `computeProductIntentScore`,
  `computeCommunityResponseScore`, `computeGithubTrustScore`, `computeReliabilityScore`,
  `computeLeadQualityScore`, `computeAcquisitionReadinessScore`. Each returns
  `{ score|null, available, reason, weight, inputs }`. Scores are `null` (never faked) on
  insufficient data; every score carries its raw inputs (raw numbers never hidden); a score is
  explicitly not a valuation; Acquisition Readiness is capped by Reliability and `null` without it;
  stars are weighted ≤10% of GitHub Trust.
- **`GET /report?view=monthly`** (admin-protected): previous completed calendar month's structured
  asset data + the five scores (with inputs) + previous-month Acquisition Readiness for the delta +
  recent operator notes. Missing pieces are `null`/`awaiting first scheduled rollup`, never faked.
  Skips the traffic refresh.
- **`POST /notes`** and **`POST /report/snapshot`** (admin-token, like `/report` and `/campaign`).

### Changed
- Report view routing and `resolveReportRequest` accept `monthly`. Existing views unchanged.

### Notes
- No Phase 4, no BUS Core Core change, no public dashboard, no AI, no scoring that hides raw numbers.

## [1.17.0] - 2026-07-06

Phase 2 analytics foundation (`BUS-Core-Analytics-Plan.md`). Additive, aggregate/operator-only,
no PII, no new user telemetry. Lighthouse remains the data layer and does not post to Discord.

### Added
- **Four additive D1 tables** (migration `0010_add_phase2_analytics_foundation.sql`):
  `daily_rollup`, `campaign_log`, `github_snapshots`, `health_checks`.
- **`daily_rollup` writer**: one aggregate row per completed UTC day (previous completed day,
  never partial). Reuses existing report query helpers; `wqpi = artifact_downloads + attributed_leads`.
  Idempotent `ON CONFLICT(day) DO UPDATE`. Missing inputs stored `null`; `return_rate` stored `null`
  (windowed metric, not faked as a single-day value).
- **`github_snapshots` writer**: daily public GitHub API snapshot (stars/forks/watchers/open+closed
  issues/open+merged PRs/contributors/latest release/commits/release asset downloads). Each field
  guarded; unavailable fields stored `null`, never faked. Idempotent per `day`.
- **`health_checks` writer**: low-frequency active liveness probes of site home, `/downloads`,
  manifest read, `/download/latest` redirect, release artifact (Range `bytes=0-0` GET — never counted),
  lead endpoint (GET-only liveness — never POST), and GitHub releases. Each probe isolated; a failure
  records `ok=0` and never breaks reporting or the scheduled run. Pruned to ~90 days.
- **`POST /campaign`**: admin-token-protected operator route to log community posts into
  `campaign_log`. `201 {ok,id}` on success. Manual `wrangler d1 execute` insert also supported.
- **`GET /report?view=asset`**: admin-protected read of the Phase 2 aggregates — latest + recent
  `daily_rollup`, latest `github_snapshots`, latest-per-target `health_checks`, and recent
  `campaign_log` with downstream event/lead counts joined by `tagged_src`/`utm_campaign`. Skips the
  best-effort traffic refresh.
- **Config**: optional `GITHUB_REPO` (default `True-Good-Craft/TGC-BUS-Core`) and `GITHUB_TOKEN`.

### Changed
- **Scheduled handler**: after traffic capture, runs the rollup / GitHub snapshot / health checks /
  prunes as independently fail-soft writers. Cron unchanged (`5 0 * * *`).
- Existing `legacy`/`fleet`/`site`/`source_health` report views and all existing counters are
  unchanged.

### Notes
- No BUS Core Core change, no scoring, no monthly asset brief, no AI, no Agent Smith outbound change,
  no new site telemetry. Those are Phase 3+.

## [1.16.1] - 2026-06-02

### Fixed
- Add explicit BUS Core `operator_summary.lead_attribution` aggregate status output so report consumers can distinguish unavailable lead DB access from available zero-lead and no-attributed-lead states.
- Count total, attributed, and unknown early-access leads separately over the 7-day report window, while keeping top sources and campaigns aggregate-only and capped at five rows.
- Sanitize lead attribution query failure reporting to a safe non-PII `query_failed` reason.

### Notes
- Runtime behavior changed: yes — additive `operator_summary.lead_attribution` fields are now present for BUS Core site reports.
- Privacy: unchanged. Lighthouse still returns lead aggregates only and does not include lead emails, form answers, user agents, IPs, hashed IPs, `bc_uid`, `bc_sid`, `anon_user_id`, `session_id`, or raw lead rows.

## [1.16.0] - 2026-06-01

### Added
- Add a BUS Core `operator_summary` section to `GET /report?view=site&site_key=buscore` with aggregate-only source-to-lead, source-to-intent, conversion, telemetry-health, and short operator-note fields for the current 7-day window.
- Add optional `BUSCORE_LEADS_DB` D1 binding to read early-access lead attribution aggregates from `early_access_leads` without exposing lead emails or persistent analytics identifiers.
- Report BUS Core site-specific counted-intent extension events (`download_click`, `early_access_submit_success`, `github_click`, `discord_click`, `support_click`, `docs_click`) from existing `site_events_raw` data.

### Notes
- Runtime behavior changed: yes — `view=site` for BUS Core now includes additive `operator_summary` when reports are requested.
- BUS Core behavior/contract/telemetry shape changed: additive only. Existing `/report`, `/metrics/event`, `/metrics/pageview`, and pageview ingestion behavior are preserved.
- Discord behavior changed: no. Lighthouse still has no outbound Discord webhook/posting integration; the new block is the aggregate operator report surface that a future approved sender could consume.
- Privacy: the report uses aggregates only and does not include lead emails, raw IPs, hashed IPs, user-agent hashes, `bc_uid`, `bc_sid`, `anon_user_id`, or `session_id`.

## [1.15.0] - 2026-04-27

### Changed
- Redefine `metrics_daily.downloads` to mean successful release artifact handouts served by `GET /releases/:filename` going forward.
- `GET /download/latest` is now redirect intent only. It validates the latest manifest download URL and returns `302`, but no longer increments `downloads` directly.
- `GET /manifest/core/stable.json` remains intentionally uncounted.
- `GET /update/check` still increments `update_checks`, and now also records additive daily update-check detail buckets for channel, client version, latest manifest version served, and `update_available` state (`true`, `false`, `unknown`).
- Extend bare `GET /report` additively with top-level `last_30_days` and `release_signals` windows. Existing top-level fields remain intact.

### Added
- Add D1 migration `0009_add_release_signal_aggregates.sql` creating `release_downloads_daily` and `release_update_checks_daily`.
- Add additive release download breakdown reporting by `release_version` and `filename`.
- Add additive release-signal reporting that separates artifact downloads, update checks, unknown-version checks, update-available impressions, and latest-version check-ins.
- Add tests covering redirect-vs-handout download counting, missing artifact and `HEAD` non-counting behavior, ignored-IP suppression for both legacy counters and new aggregates, update-check detail bucketing, and additive `/report` release-signal output.

### Fixed
- Keep legacy `GET /report`, `GET /update/check`, and successful `GET /releases/:filename` responses available if additive release-signal aggregate reads or writes fail, such as during D1 migration lag. Existing `metrics_daily` counters still update, and `/report` returns zeroed additive `release_signals` windows when those aggregate reads are unavailable.

### Notes
- Runtime behavior changed: yes.
- BUS Core behavior/contract/telemetry shape changed: additive only. Existing numeric `downloads` and `update_checks` fields remain present for current consumers, including Agent Smith.
- Lighthouse now reports truthful release signals only: successful artifact handouts, update checks, update-available impressions, latest-version check-ins, and unknown-version checks. It still does not claim installs or direct R2 bypass downloads.

## [1.14.0] - 2026-04-25

### Added
- Add four canonical semantic data-layer labels to Lighthouse reporting vocabulary: `page_execution_events`, `legacy_pageview`, `traffic_layer`, and `intent_counters`. Physical storage is unchanged — no table renames, no migrations.
- Add `page_execution_events` to `GET /report?view=site`: same data as the existing `events` field; `events` is retained as a backward-compatibility alias. `page_execution_events` is the canonical name for standardized first-party site events from `POST /metrics/event` (stored in `site_events_raw`).
- Add `traffic_layer` metadata object to `GET /report?view=site`: `{ source: "cloudflare_edge", semantics: "edge_observed_not_confirmed_human", enabled: boolean }`. Always present; `enabled` mirrors `cloudflare_traffic_enabled` from the tracked-site registry. Identifies Cloudflare-edge-observed traffic as edge metrics only, not confirmed human usage. `enabled: false` for event-only sites — traffic values remain `null` and are never faked.
- Add `legacy_pageview` to `GET /report?view=site`: non-null for BUS Core (`legacy_hybrid`) only, containing `{ pageviews_7d, days_with_data, last_received_at }` from `pageview_daily`. Returns `null` for all event-only sites. Semantic label for the BUS Core `/metrics/pageview` layer.
- Add `legacy_pageview` to bare `GET /report`: same object reference as `human_traffic`; identifies the BUS Core first-party pageview telemetry layer. `human_traffic` is retained as a backward-compatibility alias.
- Add `intent_counters` to bare `GET /report`: groups `today`, `yesterday`, `last_7_days`, and `month_to_date` counter windows under a single semantic label for the Lighthouse intent-counter layer (`update_checks`, `downloads`, `errors`). References the same objects as the existing top-level time-window fields, which are retained for backward compatibility.
- Add tests: `page_execution_events` matches `events`; `traffic_layer` metadata correctness; `traffic_layer.enabled` false for event-only sites; `legacy_pageview` non-null for BUS Core and null for event-only; `intent_counters` structure and content; intent-counter/page-execution-event layer separation.
- Document all four semantic layers in SOT.md and README.md.

### Notes
- Runtime behavior changed: yes — `view=site` now includes `traffic_layer`, `page_execution_events`, and `legacy_pageview`; bare `/report` now includes `legacy_pageview` and `intent_counters`.
- BUS Core behavior/contract/telemetry shape changed: additive only. No existing fields removed or changed. `events` and `human_traffic` are unchanged. `POST /metrics/pageview` is unchanged and fully functional.
- Compatibility: all existing fields preserved. Consumers that do not read the new fields are unaffected. Agent Smith and any other consumers of existing fields are unaffected.
- No D1 migration. No physical table rename. Physical storage remains `site_events_raw`, `pageview_*`, `buscore_traffic_daily`, `metrics_daily`.

## [1.13.6] - 2026-04-24

### Fixed
- `GET /releases/:filename`: expand `RELEASE_FILENAME` allowlist regex from `TGC-BUS-Core-<semver>.zip` only to also accept `BUS-Core-<semver>.zip`, matching the current GitHub release asset naming convention. Previously, requests for `/releases/BUS-Core-1.0.4.zip` were rejected with `404 not_found` before R2 was contacted because the filename failed the allowlist check. The R2 key construction (`releases/<filename>`) was already correct; only the regex guard was wrong.
- Preserve full backward compatibility: `TGC-BUS-Core-*.zip` filenames continue to be accepted and served.
- Export `isValidReleaseArtifactUrl` for unit testing.

### Notes
- Runtime behavior changed: yes — `/releases/BUS-Core-<semver>.zip` URLs now resolve instead of returning 404.
- BUS Core behavior/contract/telemetry shape changed: no.

## [1.13.5] - 2026-04-10

### Changed
- Align Lighthouse policy-source references to `TGC Analytics Policie.md` as the governing analytics contract reference for Lighthouse-owned semantics.
- Correct stale README wording so shipped BUS Core legacy-hybrid identity-style reporting is described accurately while preserving `event_only` identity `null` semantics.
- Replace stale completed-pass wording in `plan.md` with a durable, future-facing Lighthouse policy-alignment baseline artifact.

### Notes
- Runtime behavior changed: no.
- BUS Core behavior/contract/telemetry shape changed: no.

## [1.13.4] - 2026-04-10

### Changed
- Align Lighthouse documentation and contract examples with the newly added TGC Analytics Policy reference while mirroring only implementation-relevant policy truth owned by Lighthouse.
- Update README `view=site` example to show useful `event_only` output with explicit `events.top_paths` and `events.top_contents`, plus attribution breakdown arrays.
- Clarify explicit unsupported-by-design behavior for `event_only` properties in docs: traffic metrics remain `null` and `identity` remains `null`.
- Add explicit BUS Core grandfathering wording in SOT and README around per-site `production_only` defaults and `legacy_hybrid` semantics.
- Replace stale `plan.md` assumptions with a focused policy-alignment baseline for future Lighthouse work.

### Notes
- Runtime behavior changed: no.
- BUS Core behavior/contract/telemetry shape changed: no.

## [1.13.3] - 2026-04-10

### Added
- Add `events.top_paths` to `GET /report?view=site` response: ranked `{ path, events }` array for accepted events by path, powered by `querySiteEventTopPaths` querying `site_events_raw` directly. Populated for all sites with event telemetry including `event_only` sites.
- Add `events.top_contents` to `GET /report?view=site` response: ranked `{ utm_content, events }` array for non-empty `utm_content` values, powered by `querySiteEventTopContents`. Directly supports ad and creative-variant evaluation for operator ad spend review.

### Notes
- Runtime behavior changed: yes — `view=site` response now includes `events.top_paths` and `events.top_contents` fields.
- `event_only` contract unchanged: Star Map Generator stays `event_only`; no traffic layer added; no identity layer added. The fix surfaces event breakdown and attribution aggregates that were always valid for `event_only` sites — `event_only` means no traffic and no identity, not totals-only.
- Root cause for missing breakdowns confirmed: `events.top_paths` was never added to the `SiteEventSummary` type, `SiteReportPayload.events` type, or query pipeline. The existing breakdowns (`by_event_name`, `top_sources`, `top_campaigns`, `top_referrers`) were already present in the code and their query logic is correct. Empty arrays in runtime output for those fields indicate data filtered by the `production_only` flag (default `true` for `star_map_generator`) — events from non-production hosts are excluded by design.
- `top_contents` added: evaluated and confirmed useful for ad/creative evaluation via `utm_content` which is already captured in `site_events_raw`.
- Compatibility: additive only. No existing fields removed or changed. Consumers that do not read the new fields are unaffected.

## [1.13.2] - 2026-04-10

### Fixed
- Fix parameter binding order bug in `querySiteEventObservability` that caused all observability counters (`included_events`, `excluded_test_mode`, `excluded_non_production_host`, `dropped_rate_limited`, `dropped_invalid`) to return 0 for all sites regardless of actual stored events.
- Root cause: the SQL places production-host `?` parameters in `SELECT` CASE WHEN expressions (appearing before the `WHERE` clause in SQL text), but the `.bind()` call provided the `WHERE` clause values (`siteKey`, `startDay`, `endDay`) first. This caused `WHERE site_key = ?` to receive a production host URL pattern string, matching zero rows, so every aggregated counter returned 0.
- `querySiteEventOverview` was unaffected because its production host filter is appended to the `WHERE` clause (not in `SELECT` CASE WHEN expressions), so its bindings were in the correct left-to-right order. This is why `events.accepted_events` returned correct values while `health.included_events` returned 0.
- Fix: swap binding order in `querySiteEventObservability` so production host params appear before the `WHERE` clause params, matching SQL text parameter order.

### Changed
- Export `buildProductionHostClause` to support direct unit testing of production-host URL pattern generation.
- Add explicit contract note in SOT and README: `health.included_events` and `events.accepted_events` are computed from the same filter predicate over the same 7-day window and must agree.
- Update Star Map section in README to remove stale pre-launch language; canonical production host `starmap.truegoodcraft.ca` has been registered since v1.11.1.

### Notes
- Runtime behavior changed: yes — `health.included_events`, `excluded_test_mode`, `excluded_non_production_host`, `dropped_rate_limited`, and `dropped_invalid` now return correct values.
- Star Map support class remains `event_only`. Traffic and identity sections remain `null` by design; this was correct before this fix and remains correct after.
- Compatibility: low risk. These observability fields were returning 0 (wrong); they now return the correct values operators and reports depend on.

## [1.13.1] - 2026-04-08

### Changed
- Normalize Lighthouse telemetry documentation terminology around canonical support classes (`legacy_hybrid`, `event_only`, `event_plus_cf_traffic`, `not_yet_normalized`) and canonical capability layers (Layer 1 Registry, Layer 2 Event, Layer 3 Traffic, Layer 4 Identity, Layer 5 Extension).
- Add an explicit current site capability matrix for BUS Core, Star Map Generator, and True Good Craft using support-class and layer language.
- Add explicit operator-facing request phrasing guidance (for example: "Add a traffic layer to TGC", "Keep Star Map event_only") and deprecate vague parity phrasing (for example: "make it like Buscore").
- Clarify shared taxonomy handling in docs: `page_view`, `outbound_click`, `contact_click`, and `service_interest` are cross-site comparable; other event names are either legitimate extension-layer events or drift to clean up.
- Clarify in docs that normalization does not mean equal telemetry richness, and unsupported sections/layers remain `null` or omitted by rule.

### Notes
- Documentation and terminology normalization pass only; no runtime behavior changes.

## [1.13.0] - 2026-04-08

### Added
- Freeze canonical shared cross-site comparable event names to `page_view`, `outbound_click`, `contact_click`, and `service_interest`.
- Add deterministic support-class and section-availability metadata on `GET /report?view=site` scope (`support_class`, `section_availability`).
- Add explicit `identity` section to `GET /report?view=site` payload, populated only for support classes with identity support and `null` for event-only sites.
- Add normalization tests covering taxonomy helpers, support-class mapping, shared signal semantics, and site-view identity availability.

### Changed
- Normalize shared event-name aliases in report assembly for standardized-event `by_event_name` output so equivalent shared actions are grouped under canonical names without breaking permissive ingest compatibility.
- Centralize supported-signal semantics through helper logic used by fleet/site/source-health report assembly (`accepted_signal_7d` and `has_recent_signal`).

### Notes
- Runtime ingest validation remains permissive for compatibility: non-empty site-specific event names continue to be accepted as extensions.

## [1.12.1] - 2026-04-08

### Changed
- Perform a normalization audit and planning pass for tracked public properties (`buscore`, `star_map_generator`, `tgc_site`) and record execution-ready inventory in `plan.md`.
- Make fleet normalization rules explicit in docs: `TRACKED_SITES` canonical registry, `/metrics/event` canonical fleet telemetry path, and `/metrics/pageview` documented as BUS Core legacy-only support.
- Freeze shared report-field semantics in docs for `accepted_signal_7d`, `accepted_events_7d`, `has_recent_signal`, `last_received_at`, and `cloudflare_traffic_enabled`.
- Add explicit support-class taxonomy (`legacy_hybrid`, `event_only`, `event_plus_cf_traffic`, `not_yet_normalized`) and classify current tracked sites by observed current reality.

### Notes
- Documentation and planning normalization pass only; no runtime behavior changes to ingestion or report outputs.

## [1.12.0] - 2026-04-08

### Added
- Expand authenticated `GET /report` with explicit query modes: legacy bare `/report`, `/report?view=fleet`, `/report?view=site&site_key=<site_key>`, and `/report?view=source_health`.
- Add fleet-wide operator reporting summarizing each tracked site with deterministic `backend_source`, signal freshness, site-scoped accepted-event totals, BUS Core pageview totals where supported, and Buscore Cloudflare traffic totals where supported.
- Add site-scoped detailed reporting with `scope`, `summary`, `traffic`, `events`, and `health` sections for one tracked property.
- Add source-health reporting focused on telemetry integrity with per-site `accepted_signal_7d`, `last_received_at`, and persisted drop counters where supported.

### Changed
- Preserve the existing bare `/report` top-level operator contract unchanged while moving legacy assembly behind a dedicated builder.
- `/report` now rejects invalid `view` with `400 {"ok":false,"error":"invalid_view"}` and rejects `view=site` without `site_key` with `400 {"ok":false,"error":"missing_site_key"}`.
- Legacy `/report` and `view=site` continue to reject unknown `site_key` with `400 {"ok":false,"error":"invalid_site_key"}`.
- Legacy `/report`, `view=fleet`, and `view=site` keep the best-effort previous-completed-day Buscore traffic refresh before assembly; `view=source_health` intentionally skips the refresh and reads persisted data only.
- Unsupported per-site reporting fields now return `null` instead of synthetic zeroes, including non-BUS Core `pageviews_7d`, non-traffic-enabled site traffic metrics, and `dropped_invalid` where standardized-event invalid drops are not persisted.

### Notes
- No migration was added. The new views are composed from existing tracked-site registry data plus current D1 reporting surfaces (`pageview_daily`, `site_events_raw`, `buscore_traffic_daily`).

## [1.11.3] - 2026-04-08

### Changed
- Clarify one cross-site developer/operator analytics suppression integration standard for all Lighthouse-tracked public sites: use `dev_mode` as the canonical cookie name with presence-based semantics.
- Document that when `dev_mode` is present, site-side shared telemetry loaders must suppress Cloudflare Web Analytics injection, Lighthouse pageview emission, and Lighthouse standardized event emission for that page load.
- Clarify domain-scoping expectations for separate registrable domains: `.buscore.ca` for BUS Core properties and `.truegoodcraft.ca` for True Good Craft properties/subdomains (including `starmap.truegoodcraft.ca`), while keeping one logical cookie contract.

### Notes
- Documentation and integration-contract clarification only; no Lighthouse runtime ingestion behavior change.

## [1.11.2] - 2026-04-03

### Changed
- Register True Good Craft website tracked-site entry as `site_key: "tgc_site"` with production hosts `truegoodcraft.ca` and `www.truegoodcraft.ca`.
- Add browser origin allow-list entries for `https://truegoodcraft.ca` and `https://www.truegoodcraft.ca` on `POST /metrics/event` via the active tracked-site registry.
- Keep Cloudflare traffic capture disabled for `tgc_site` (`cloudflare_traffic_enabled: false`, `cloudflare_host: null`).

## [1.11.1] - 2026-04-02

### Changed
- Register Star Map launch host/origin in tracked-site registry for `site_key: "star_map_generator"`: `production_hosts` now includes `starmap.truegoodcraft.ca` and `allowed_origins` now includes `https://starmap.truegoodcraft.ca`.
- Promote `star_map_generator` tracked-site status from `planned` to `active` so `/metrics/event` CORS allow-listing now permits Star Map browser-origin ingestion.

## [1.11.0] - 2026-03-31

### Added
- Add site-scoped standardized-event reporting on `GET /report` using `site_key` query parameter with optional filter flags `exclude_test_mode` and `production_only`.
- Add additive `site_events` report block (returned when `site_key` is provided) with: `scope`, `totals`, `by_event_name`, `top_sources`, `top_campaigns`, `top_referrers`, and `observability`.
- Add D1 migration `0008_add_site_event_rate_limit.sql` creating `site_event_rate_limit` minute-bucket table for `/metrics/event` ingestion noise control.

### Changed
- Harden `POST /metrics/event` with D1-backed per-IP-hash minute rate limiting (approximately 50/minute), matching the pageview ingestion model.
- Rate-limited standardized events are now persisted with `accepted = 0` and `drop_reason = "rate_limited"` for operator observability.
- Standardized-event source attribution in `site_events.top_sources` follows precedence `src -> utm_source -> referrer classification -> (direct)`.
- `/report` now rejects unknown `site_key` values with `400 {"ok":false,"error":"invalid_site_key"}`.

### Notes
- Legacy BUS Core report blocks (`today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, `traffic`, `human_traffic`, `identity`) remain intact and semantically unchanged.
- `site_events` is intentionally `null` when `site_key` is not supplied to avoid silent multi-site blending.

## [1.10.0] - 2026-03-31

### Added
- Add a code-level tracked-site registry (`TRACKED_SITES`) as the first-class property model for Lighthouse. Each entry carries `site_key`, `label`, `status` (`active` | `staging` | `planned`), `production_hosts`, `allowed_origins`, `staging_hosts`, `cloudflare_traffic_enabled`, `cloudflare_host`, and `production_only_default`.
- Register `buscore` as an active tracked site with BUS Core production hosts, CORS origins, and Cloudflare traffic capture host derived from its registry entry.
- Register `star_map_generator` as a planned tracked site with empty host and origin fields, awaiting production URL assignment.
- Add `POST /metrics/event` — standard multi-site event ingestion endpoint. Accepts `site_key`, `event_name`, and all standard attribution fields (`client_ts`, `path`, `url`, `referrer`, `device`, `viewport`, `lang`, `tz`, `utm`, optional `src`, `utm.*`, `anon_user_id`, `session_id`, `is_new_user`, `event_value`, `test_mode`). Unauthenticated; always returns `204 No Content`. CORS gated to allowed origins of active tracked sites.
- Add D1 migration `0007_add_site_events.sql` creating `site_events_raw` table with `site_key` and `event_name` discriminators for multi-site event storage, including standard enrichment and privacy columns.

### Changed
- `BUSCORE_HOST` and `PAGEVIEW_ALLOWED_ORIGINS` are now derived from the tracked-site registry rather than hardcoded constants. Runtime behavior for BUS Core is unchanged.
- `OPTIONS /metrics/event` advertises `POST, OPTIONS`; CORS policy returns per-origin allow headers for active tracked sites, never wildcard.
- Extended `withCors` to apply per-site CORS policy for `/metrics/event` using the union of active tracked-site allowed origins.

### Notes
- `POST /metrics/pageview` (BUS Core legacy) continues to function without modification. BUS Core pageview ingest, report output, and traffic capture are unaffected.
- `star_map_generator` is registered but inert: its `allowed_origins` is empty, so no browser preflight will succeed for that site until a production URL is added to its registry entry.
- Per-site report isolation (`GET /report` scoped by `site_key`) is reserved for a future pass.
- Rate limiting is not applied to `POST /metrics/event` in this pass.

## [1.9.1] - 2026-03-31

### Fixed
- Resolve migration chain drift in `0005_add_pageview_ingestion.sql`: the continuity columns `anon_user_id`, `session_id`, `is_new_user` and their associated indexes were retroactively added to migration 0005 after it had already shipped, duplicating the `ALTER TABLE` operations in `0006_add_anonymous_continuity.sql`. This caused fresh-install failures on D1 when both migrations were applied in sequence. Migration 0005 has been restored to its original form (base table and base indexes only, no continuity columns). Migration 0006 remains the correct and sole source for adding continuity fields.
- Add operator risk note to `0006_add_anonymous_continuity.sql`: environments that applied a modified 0005 (with continuity columns already present) must verify column existence and mark the migration applied without re-running the `ALTER TABLE` statements.

### Notes
- No runtime behavior change. No schema change to already-deployed environments that applied both migrations correctly in sequence. The deployed schema is identical before and after this fix.

## [1.9.0] - 2026-03-26

### Added
- Extend `POST /metrics/pageview` ingest contract to accept optional anonymous continuity fields: `anon_user_id`, `session_id`, and `is_new_user` without breaking older clients.
- Add D1 migration `0006_add_anonymous_continuity.sql` adding raw pageview continuity columns and targeted indexes for identity/session retention queries.
- Extend `GET /report` with additive top-level `identity` block containing:
	- `today.{new_users,returning_users,sessions}`
	- `last_7_days.{new_users,returning_users,sessions,return_rate}`
	- `top_sources_by_returning_users`

### Changed
- Increase pageview ingest runtime marker to `1.9.0`.
- Keep identity processing aggregate-first and anonymous by using first-party continuity fields only; no synthetic identity reconstruction from IP or user-agent hashes.

### Fixed
- Ensure malformed continuity fields are sanitized (`anon_user_id`/`session_id` nulled, `is_new_user` coerced to `0`) instead of causing brittle event rejection when the base pageview payload remains valid.

## [1.8.7] - 2026-03-25

### Fixed
- Fix `POST /metrics/pageview` body-capture diagnostics to preserve and pass a structured capture result from the request path (`raw`, `body_capture_stage_reached`, `capture_error`) into deferred ingest work.
- Complete `POST /metrics/pageview` body capture on the request path before returning `204`, then pass that same captured result into deferred ingest processing to eliminate read-after-response race behavior.
- Expose previously swallowed body-read exceptions as `capture_error` when body capture fails, instead of collapsing all failures to `null` body text.
- Ensure invalid-json debug logging uses the same captured raw body string passed to parser handling, so `raw_body_length` and `raw_body_preview` reflect the real captured value.

### Added
- Add temporary explicit body-capture debug snapshots for both accepted and invalid-json pageview ingest paths with `body_capture_stage_reached`, `raw_body_length`, and `capture_error` fields.

### Changed
- Bump `ingest_version` emitted to raw pageview rows from `1.8.6` to `1.8.7`.

## [1.8.6] - 2026-03-25

### Fixed
- Fix `POST /metrics/pageview` ingest body-read timing by initiating `request.text()` on the request path before returning `204`, then parsing and validating from that same raw string in the async ingest path.
- Preserve single-read parsing contract (`raw text -> empty check -> JSON.parse(raw)`) while preventing unreadable-body `invalid_json` drops caused by deferred body reads.

### Changed
- Bump `ingest_version` emitted to raw pageview rows from `1.8.5` to `1.8.6`.

## [1.8.5] - 2026-03-25

### Fixed
- Harden `POST /metrics/pageview` ingest parsing to an explicit single-read flow: body is read once as raw text, empty-body checked, then `JSON.parse(raw)` is applied from that same string.
- Remove request cloning on the pageview ingest `waitUntil` path to avoid body stream edge cases that can surface as unreadable-body `invalid_json` drops while preserving fire-and-forget `204` behavior.

### Changed
- Bump `ingest_version` emitted to raw pageview rows from `1.8.4` to `1.8.5`.

## [1.8.4] - 2026-03-25

### Added
- Add narrow temporary invalid-json ingest debug logging for `POST /metrics/pageview` that only runs on dropped `invalid_json` submissions and records request `Content-Type`, raw body length, first about 500 characters of body text, and an inferred beacon/fetch transport hint.

### Changed
- Bump `ingest_version` emitted to raw pageview rows from `1.8.3` to `1.8.4` to mark runtime with temporary invalid-json diagnostics enabled.

## [1.8.3] - 2026-03-25

### Fixed
- Align `POST /metrics/pageview` parser and validator with the canonical BUS Core site emitter contract by validating required fields (`type`, `client_ts`, `path`, `url`, `referrer`, `utm`, `device`, `viewport`, `lang`, `tz`) while allowing omitted optional fields (`src`, `utm.*`).
- Preserve canonical empty-string values for `referrer`, `lang`, and `tz` instead of collapsing them to `null`, so accepted raw rows keep populated contract fields.
- Keep invalid classification narrow for ingestion (`unreadable body`, `empty body`, `invalid JSON`, or contract-invalid required field types/shape) while preserving fire-and-forget `204` responses.

## [1.8.2] - 2026-03-25

### Fixed
- Add `Access-Control-Allow-Credentials: true` to `POST /metrics/pageview` and its `OPTIONS` preflight for allowed first-party origins (`https://buscore.ca` and `https://www.buscore.ca`), enabling credentialed cross-origin requests from BUS Core.

## [1.8.1] - 2026-03-25

### Fixed
- Fix first-party pageview ingestion CORS so `POST /metrics/pageview` and its `OPTIONS` preflight return explicit allow-origin headers for `https://buscore.ca` and `https://www.buscore.ca` instead of wildcard `*`.
- Prevent non-allowed origins from receiving broad wildcard browser access on the pageview ingestion route while preserving existing `OPTIONS 200` and `POST 204` behavior.

## [1.8.0] - 2026-03-25

### Added
- Add unauthenticated `POST /metrics/pageview` for narrow first-party JS-fired pageview ingestion, with `204 No Content` responses for valid, partial, rate-limited, and malformed request bodies.
- Add D1 migration `0005_add_pageview_ingestion.sql` with raw pageview event retention, daily pageview aggregates, per-dimension aggregate rows, and per-minute hashed-IP rate-limit buckets.
- Extend authenticated `GET /report` with additive top-level `human_traffic` for compact JS-fired pageview reporting, including `today`, `last_7_days`, and cumulative `observability` sections.

### Changed
- Lighthouse now accepts the already-deployed BUS Core site emitter contract as-is: page-load-only events, no auth, no retries, no session logic, and no client contract changes.
- Raw pageview events are retained in D1 for about 30 UTC days with hashed IP and hashed user-agent values for inspectability without introducing identity semantics.
- Scheduled execution now also prunes expired raw pageview rows and stale rate-limit buckets while preserving the existing once-daily Cloudflare traffic capture.
- `human_traffic.last_7_days.top_sources` uses deterministic source precedence `src -> utm.source -> (direct)`.

## [1.7.0] - 2026-03-24

### Removed
- Remove abandoned traffic attribution capture path from runtime and keep daily traffic capture focused on `visits`, `requests`, and `captured_at` only.
- Remove the extra traffic attribution field from `traffic.latest_day` in `GET /report` output.

### Changed
- Daily Buscore traffic capture now runs a single totals query and writes only `day`, `visits`, `requests`, and `captured_at` in runtime upsert/select paths.

## [1.5.3] - 2026-03-23

### Changed
- Refine authenticated `GET /report` traffic behavior to always perform one best-effort refresh capture for the previous completed UTC day before assembling the report, instead of only capturing when that row is missing.
- Reuse the same shared per-day capture logic as scheduled daily capture, preserving idempotent one-row-per-day UPSERT semantics.
- If the `/report` refresh attempt fails, Lighthouse still returns the report successfully using whatever stored traffic data exists.

## [1.5.2] - 2026-03-23

### Removed
- Remove temporary development route `GET /_dev/capture-traffic` after live traffic-capture testing.

### Changed
- Keep scheduled daily traffic capture and authenticated `/report` lazy backfill paths unchanged by removing only the temporary route surface.

## [1.5.1] - 2026-03-23

### Changed
- Improve `GET /report` traffic usability without expanding telemetry scope: `traffic.latest_day` now includes stored `captured_at`.
- Improve 7-day traffic summary shape to include `visits`, `requests`, `avg_daily_visits`, `avg_daily_requests`, and `days_with_data`.
- Daily averages are now explicitly row-based (`days_with_data` divisor), so Lighthouse does not divide by seven unless seven traffic rows exist.

## [1.5.0] - 2026-03-23

### Changed
- Correct Buscore traffic metric semantics for the Cloudflare `httpRequestsAdaptiveGroups` capture path: Lighthouse now stores and reports daily `requests` (from `count`) instead of `pageviews`.
- `GET /report` traffic fields are renamed from `pageviews` to `requests` in both `traffic.latest_day` and `traffic.last_7_days`.
- The shared daily capture helper now validates numeric request `count` and no longer depends on unsupported `pageViews` on `httpRequestsAdaptiveGroups`.

### Added
- Add D1 migration `0004_rename_buscore_traffic_pageviews_to_requests.sql` to rename `buscore_traffic_daily.pageviews` to `requests`.

### Fixed
- Resolve live capture failure `cloudflare_graphql_payload_unknown field "pageViews"` by aligning metric selection with valid fields on the selected query node.

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
