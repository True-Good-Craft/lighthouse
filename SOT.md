# Lighthouse — Source of Truth

## Kingston Food Help — v1.32.0 review candidate (2026-09-04)

The owner authorized a review branch and PR for Kingston analytics. This is an approved proposed behavior change, not a production receipt. `KFH_ANALYTICS_CONTRACT.md` governs this isolated aggregate profile and its Agent Smith `/kfh` consumer.

- `POST /metrics/event` accepts the strict consented `kingston_food_help` profile only from the two production HTTPS origins. Unknown fields, resource context, identifiers, unapproved campaign tags, test traffic, GPC/DNT, and missing rate-control inputs are dropped. The profile uses six fixed action counters plus separate page-view-only source/campaign/content counts; it writes no raw events.
- Migration `0016_add_kfh_daily.sql` adds one aggregate table with 400 UTC-day-bucket retention. Existing two-day minute-HMAC abuse storage is reused with a Kingston-specific scope. Existing cron cadence is unchanged; Kingston pruning is an independent fail-soft task.
- Protected `GET /report?view=kfh` reads only Kingston aggregates and skips traffic refresh. It returns explicit UTC windows, nullable unavailable measurements, observed-only coverage and activity days, never a health/people/help-received claim. It has no CEO dependency or scheduled outbound delivery.
- Kingston is registered as `event_only` with a dedicated daily-report profile. It is excluded from raw-event fleet/source-health reports; legacy/site selectors reject its key rather than manufacture raw-event zeroes. Existing sites and CEO report contracts are preserved.
- Review publication does not authorize migration, Worker promotion, secret operations, website collection, or live report reads. Migration must be separately approved and verified before promotion. The previous CEO consumer-parity/promotion gate still applies. The website emitter remains disabled pending its separately reviewed producer change.


## CEO activity truth and sparse probe health — v1.31.0

Version 1.31.0 advances only the CEO response contract from `1.1` to `1.2`; `metric_definition_version` remains `1.1`. The change prevents sparse activity from being presented as a scheduled health signal, makes partial scheduled-probe evidence truthful, and clarifies that voluntary-inquiry totals count unique lead records. The authenticated route remains `GET /report?view=ceo`. No other report view, route, auth rule, header, CORS permission, Worker binding, environment variable, D1 table, retention rule, cron, probe target, canary, or producer contract changes.

Every CEO source state in contract `1.2` includes `freshness_basis`. Direct aggregate sources (`artifact_delivery`, `update_checks`, `product_telemetry`, `buscore_site`, `tgc_site`, `voluntary_inquiries`, and `lighthouse_errors`) use `freshness_basis: "activity"`. A successful direct-source query with activity evidence reports `freshness: "unknown"`, `reason_code: "activity_only"`, and `data_through` as its activity watermark. For a single-component source, the watermark is the latest trusted observation. For a composite source, it is present only when every required component has a watermark and uses the conservative earliest component watermark. A date-only daily-bucket watermark is normalized to the end of a completed UTC day, or bounded by `generated_at` for the current/future UTC day; it is a reporting bound, not an exact event timestamp. A successful query with no usable source watermark reports `freshness: "unknown"`, `reason_code: "source_history_missing"`, and `data_through: null`. Silence and an old activity watermark do not establish either pipeline freshness or failure, so direct sources no longer use `fresh`/`stale` or `source_data_stale`. Their existing availability, windows, metric definitions, nullable failure behavior, and partial-coverage rules remain unchanged.

Only `service_probes` uses `freshness_basis: "scheduled_probe"`. A successful query with no active-target history is `available`/`unknown` with `probe_history_missing`, `data_through: null`, and an empty `details.service_probes` array. A successful query with only part of the six-target active set is `available`/`unknown` with `probe_history_incomplete`; it preserves the observed detail rows and uses the latest observed `checked_at` as `data_through`. A complete six-target set retains the scheduled-health rule: the oldest required target watermark is the source `data_through`, and it is `fresh` when no older than 36 hours or `stale` with `probe_data_stale` when older. When one target has multiple rows at the exact latest `checked_at`, failure wins over success; the row ID supplies a stable final tie-break within the same state. Query failure alone makes the source unavailable and the dependent detail `null`. This is report truth repair only; the six scheduled checks, their request methods, ordinary pass/fail boundaries, cadence, storage, and fail-soft execution do not change.

Voluntary-inquiry window totals count unique lead records by each record's `created_at`. A later update to an existing record is not counted as a new inquiry record and does not move that record into a later created-at window. When `BUSCORE_LEADS_DB` is available, `details.voluntary_inquiry_records` adds the aggregate-only diagnostics `total_records`, `last_created_at`, and `last_updated_at`; `last_updated_at` is modification-recency evidence only. When that binding/query is unavailable, the inquiry-dependent values and diagnostic remain `null` without affecting unrelated sources. No email, form content, raw attribution, record identifier, or other lead PII is selected or returned, and no D1 migration is required.

`contracts/ceo-v1/report.schema.json` is the strict `1.2` authority, while the pinned strict `1.1` schema remains available for rollback compatibility. The fixed `npm run --silent diagnostic:ceo` helper selects and strictly validates either contract `1.1` or `1.2`, while requiring metric-definition version `1.1` for both; it rejects any other version or cross-version shape before output. Contract `1.2` also rejects any non-null voluntary-inquiry window count when the voluntary-inquiry source is unavailable. Agent Smith must accept both strict contracts before Lighthouse `1.2` is promoted, and must retain `1.1` acceptance while Worker `1.30.0` remains the rollback candidate. This consumer-first ordering is a deployment safety gate, not a hard Lighthouse runtime dependency. Agent Smith `0.26.0` at merged `main` commit `5519764d959cf1d6a505280814c59e82854f9bda` established deployed dual-version compatibility: CI run `33105121602` and deployment run `33105121605` succeeded, including Discord command registration, and the owner confirmed the deployed `/report` path works against active CEO `1.1`. The final Lighthouse audit added the unavailable-source inquiry-count rejection after that deployment. The deployed consumer accepts every valid Lighthouse `1.2` output, but its pinned validator remains a permissive superset until a matching governed Agent Smith patch is deployed and verified. Lighthouse 1.31.0 promotion remains blocked on that exact-validator parity step.

The local 1.31.0 work performs no migration, secret operation, production request, upload, deployment, or traffic change. The separately approved 2026-08-27 production receipt remains Lighthouse `1.30.0`, Worker version `ab29c0fb-ca9e-4074-a379-18d0943ec02c` at 100% traffic, deployment `526f9fbc-6432-466c-9b39-2ae90b299cae`, from merged `main` commit `4e80d65de01606c15100a99e7852ce19c5e6cd98`. Production continues to emit CEO contract `1.1` until an explicitly approved 1.31.0 promotion.

## Least-privilege report diagnostics — v1.30.0

Version 1.30.0 adds an optional, additive report-read credential without removing the established administrative contract. A usable `REPORT_READ_TOKEN` Worker secret is an independently generated cryptographically random string of 32 to 128 URL-safe ASCII characters (`A-Z`, `a-z`, `0-9`, `_`, and `-`), is distinct from `ADMIN_TOKEN`, and is accepted for any `GET /report` view only through an exact `X-Report-Token` match. Existing callers may continue to authenticate report reads through the exact `X-Admin-Token`/`ADMIN_TOKEN` match. `POST /campaign`, `POST /notes`, and `POST /report/snapshot` remain administrative writes and accept only `X-Admin-Token`; the report-read header never authorizes them. A missing, blank, malformed, or incorrect report credential fails closed with the existing `401 {"ok":false,"error":"unauthorized"}` response while a distinct administrative fallback remains usable. If the two configured secrets are identical and non-empty, every protected report read and administrative write fails closed with that same `401` before database or deferred work; this prevents a provisioning collision from silently granting write authority to the nominal read credential. Report routes, views, payloads, schemas, status semantics, storage, retention, and scheduling are otherwise unchanged.

`REPORT_READ_TOKEN` is an authorization-scope boundary, not a promise of zero evidence mutation. Bare `/report`, `view=fleet`, and `view=site` retain their best-effort previous-completed-day Cloudflare traffic capture/upsert. The stored-data `view=ceo`, `view=tgc`, `view=source_health`, `view=asset`, and `view=monthly` paths continue to skip that refresh, but any report-assembly exception may still best-effort increment `metrics_daily.errors`. Production access therefore still requires explicit approval, and the canonical first diagnostic remains the stored-data CEO view.

The 1.30.0 bundle introduced one fixed, non-echoing operator helper: `npm run --silent diagnostic:ceo`. With a credential satisfying the same 32-to-128 URL-safe-ASCII contract, it performs at most one `GET https://lighthouse.buscore.ca/report?view=ceo` request with `Accept: application/json` and `X-Report-Token`. It accepts no URL or command-line override, retry, redirect, user-supplied credential/report file, or `.env` input; uses a hidden interactive prompt or the `LIGHTHOUSE_REPORT_READ_TOKEN` automation environment variable; removes that variable from the helper process environment immediately after capture; enforces a 15-second timeout and 1 MiB response limit; rejects redirects and non-200 responses; and writes pretty-printed JSON plus one newline to stdout only after fatal UTF-8 decoding, JSON parsing, reflected-token suppression, and strict CEO-contract validation. Version 1.30.0 accepted contract `1.1`; the 1.31.0 section above governs the current dual `1.1`/`1.2` validator dispatch. Noninteractive failures are nonzero and use only three finite static lines: missing/invalid credentials and HTTP `401`/`403` emit `Lighthouse CEO diagnostic access blocked.`; HTTP `503` emits `Lighthouse CEO report unavailable; metrics_daily.errors may have been incremented.`; every other transport, response-safety, parse, schema, or output failure emits `Lighthouse CEO diagnostic failed.`. The helper never emits the credential, response body, numeric HTTP status, or schema detail. It does not grant production authorization and cannot make a CEO request zero-write when report assembly fails.

The 1.30.0 governed bundle changed behavior, auth, configuration, and operator workflow, and documented the remaining cross-service boundary. The local work added the optional `REPORT_READ_TOKEN` secret-binding capability but itself performed no endpoint addition, report-field change, D1 migration, D1/R2 binding or resource change, retention change, scheduled change, secret-value handling, secret provisioning, deployment, or active-production interaction. `ADMIN_TOKEN` remains required for administrative writes and remains a backward-compatible report credential. The bundle was subsequently promoted through the approved production workflow and confirmed by the immutable production receipt recorded in the 1.31.0 section above; no secret value was read or recorded. Rollback to the prior Worker version restores the prior admin-only read contract, so the administrative fallback must remain available until read-token consumers have been verified.

Agent Smith remains outside this least-privilege completion boundary. Its current runtime still uses `LIGHTHOUSE_ADMIN_TOKEN` for report reads and the administrative monthly snapshot write. Migrating its reads alone would leave the broad credential present. Removing that credential from Agent Smith requires a later owner-approved snapshot-specific authorization split (or removal of that write), coordinated cross-repository documentation/version bundles, external secret changes, verification, and only then any administrative-token rotation.

## Release-control and infrastructure reconciliation — v1.29.4

Version 1.29.4 records the owner-approved read-only Cloudflare control-plane audit performed on 2026-08-26 and aligns repository-controlled release tooling with the verified infrastructure. The audit established that the merge of `main` commit `59231d09084d0fa4db71012b6f29550886c5b605` caused Cloudflare Workers Builds build `793715ef-6123-4d98-a4a7-797634d07812` to run the configured production command `npx wrangler deploy` without a validation build command and promote Worker version `ba611ac1-653d-47a2-a465-a85f4124b6b6` to 100% of production traffic. That version was created at `2026-08-26T22:57:30.628Z`. The canonical production hostname is `lighthouse.buscore.ca`, attached as a Production Custom Domain rather than a Worker Route. The additional production `workers.dev` surface and branch/version previews are enabled but are not canonical diagnostic endpoints. The active cron is `5 0 * * *` (`00:05 UTC`).

The verified owning Cloudflare account is `eb1a8dd5723031d94e57642e3eaaebda`. The primary `DB` binding resolves to D1 database ID `e46f2daa-7e97-45a3-9bf0-49003a42850c`, whose control-plane name is `lighthouse`; the prior checked-in name `buscore-lighthouse` was stale metadata for the same ID. Version 1.29.4 pins the account, reconciles that D1 name, preserves the `BUSCORE_LEADS_DB` and `MANIFEST_R2` bindings, replaces the ambiguous npm deploy command with explicit upload/status/history commands, and deliberately provides no direct production-deploy script. The checked-in production workflow is manual-only, main-only, serialized, and fully validated before deployment. Whenever the deploy step runs, the workflow attempts an active-deployment JSON receipt even if the deploy action reports failure, covering uncertain partial-success states. Production deployment uses Wrangler strict mode and preserves dashboard-managed variables. A deterministic release-control test enforces those repository-owned constraints.

This is an approved release-control conformance change. It changes operator-visible configuration metadata and release automation, but no Worker source, endpoint, response contract, auth behavior, storage schema or semantics, retention, schedule, ingestion, report metric, runtime integration, secret value, D1 resource ID, R2 bucket, custom-domain attachment, or active production traffic. No migration, secret operation, or Worker promotion was part of that local bundle. At the time of the 1.29.4 bundle, active production remained the verified 1.29.3 Worker pending a separately approved deployment; the current production receipt is recorded in the 1.31.0 section above.

`OPERATIONS.md` defines the rollback boundary: select and explicitly approve an immutable Worker version ID, confirm that no deployment mutation is in progress, preserve interactive confirmation, verify resulting traffic by JSON status receipt, and treat Git, Workers Builds settings, secrets, domains, D1 data, and migrations as separate rollback domains.

**External release-control verification — 2026-08-26:** with separate owner approval, the Cloudflare Workers Builds production Deploy command was changed from `npx wrangler deploy` to exactly `npx wrangler versions upload`. Durable control-plane readback after reload confirmed that both the Deploy command and Version command are exactly `npx wrangler versions upload`. No build, upload, or deployment action was invoked. Workers Builds may now create version or preview state from branch and `main` pushes but must not promote active traffic; the checked-in manual GitHub workflow is the sole authorized production-promotion path. Successful Lighthouse release run `33086080869` later proved that its configured `CLOUDFLARE_API_TOKEN` could perform the approved 1.30.0 deployment at that time; current availability or broader scope must not be inferred from workflow text or that historical success.

## Canonical operations and diagnostics — v1.29.3 documentation release

Version 1.29.3 establishes `OPERATIONS.md` as the canonical runbook, subordinate to this SOT, for choosing Lighthouse diagnostic surfaces, identifying credential and ownership boundaries, classifying evidence side effects, and reporting `ACCESS_BLOCKED` when approved access is unavailable. It also marks the Phase 2, Phase 3, and policy-alignment documents as historical or scoped references rather than current incident authority.

This is an owner-approved documentation-only governance release. It changes no Worker source code or deployed behavior: no endpoint, response contract, auth, configuration, binding, storage, retention, schedule, integration, migration, secret, or deployment behavior changes. The repository and lockfile version advance because the documented operator workflow changed. No active-production Worker promotion is required or authorized by this release. The last production deployment recorded in repository history is Lighthouse 1.29.2, Cloudflare Worker version `f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`, with CEO report and metric-definition contract `1.1`; active-production state was not independently control-plane verified during this documentation release. Publishing the review branch caused the separately connected Cloudflare Workers Builds integration to upload version `33f4db25-9faf-435d-a83e-83d7d1c17eac`; its check classified the upload as a preview, reported version/branch preview URLs, and did not report an active-production promotion. That check is not proof of current active-production state and does not authorize a merge.

## Service-probe truth repair — v1.29.2 deployed

Version 1.29.2 removes two false-positive service failures without weakening the checked surfaces. The `lead_endpoint` probe remains a GET-only, non-persisting liveness check and accepts either a successful `2xx` response or `405 Method Not Allowed`; a 405 proves that the route exists and enforces its method boundary even when the response omits an `Allow` header. Lighthouse never submits a synthetic lead.

The `github_release` probe no longer consumes the unauthenticated GitHub REST API quota shared by Cloudflare Worker egress. It sends a public `HEAD` request to the configured repository's `/releases/latest` page and accepts either `200` or a same-origin redirect to that repository's non-empty `/releases/tag/<tag>` path. Redirects to another repository or a non-release path fail. The separate scheduled GitHub snapshot remains best-effort and may continue using the API; its availability does not determine the `github_release` service check.

This is a probe-conformance change only. It does not alter the CEO report contract or metric-definition version `1.1`, report windows, source freshness/coverage semantics, public routes, ingestion, storage, retention, auth, secrets, or scheduled cadence. No migration or secret change is required. Version 1.29.2 was deployed on 2026-08-10 at `2026-08-10T15:02:09.239256Z` as Cloudflare Worker version `f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`.

## Trust and privacy conformance — v1.29.1 deployed

Version 1.29.1 is a conformance patch over the deployed 1.29.0 Worker. Scheduled/public metadata `HEAD` probe failures do not increment the general `metrics_daily.errors` counter, because recurring probes would make that counter an ambiguous mixture of probe traffic and genuine manifest-read failures; the bounded service-probe record remains the health authority. Genuine manifest `GET` failures continue to increment the error counter, and ordinary public artifact `HEAD` requests retain their raw/HEAD counter semantics. CEO possible-download-interest values require an accepted, production, non-test BUS Core `download_click` whose value is a canonical versioned Lighthouse artifact URL, rather than a page view, unrelated action, or generic click; the contract truthfully states that the signal distinguishes page visits from file clicks. This trusted-click metric begins on `2026-08-10`: earlier `buscore_download_intent_daily` rows are excluded from both CEO sums and the source watermark, wholly pre-definition windows return `null`, and spanning or later windows return partial totals from the definition day forward.

CEO source coverage is based on the evidence actually available to each metric. The contract retains `full` for a future source that can prove daily completeness. Current sources are sparse event/counter tables, not daily completeness ledgers, so an available current source reports every window as `partial`; an unavailable source reports every window as `unavailable`. Source-dependent inquiry attribution, product-version/failure detail, and service-probe detail are `null` when their source is unavailable rather than plausible empty arrays. For rolling TGC producer compatibility, ingestion accepts either `small`, `medium`, or `large` or an exact lowercase `WIDTHxHEIGHT` value. Exact dimensions are immediately reduced by width to `small` below 768, `medium` from 768 through 1199, or `large` from 1200 upward; only the bucket is stored. Form values are reduced to `infrastructure`, `audit`, `contact`, `general`, or `other`; `js_error` and `outbound_click` use their own bounded category sets with unrecognized non-empty values collapsed to `other`; absent/blank and all other accepted TGC event values are stored as `null`.

Version 1.29.1 changes no D1 schema and required no migration. It was deployed on `2026-08-09T16:41:20.004814Z` as Cloudflare Version ID `ee320e1a-9ceb-4d88-a848-fd7ae0e9e3bc` after typecheck, 162 tests, a Wrangler dry run, and remote confirmation that no migration was pending. The owner-approved release used the authenticated local Wrangler session; at that time, no Cloudflare credential secret was configured for the checked-in GitHub Actions deployment path, and no secret value changed. Current deployment-token availability remains unverified by the 1.29.4 local bundle.

## CEO decision-report contract — v1.28.0 route; contract 1.1 rollback compatibility

This section retains the deployed `1.1` contract as rollback authority; the `1.31.0` section above governs the additive `1.2` response contract. Authenticated `GET /report?view=ceo` is the versioned decision-report contract for Agent Smith. Contract and metric-definition version `1.1` read existing aggregate and bounded raw-event tables directly; they do not depend on the scheduled `daily_rollup`, add a migration, rewrite history, or change any existing report view. Version 1.1 marks the strict nullable-detail and trusted-artifact-click semantics; bare `/report`, `fleet`, `site`, `tgc`, `source_health`, `asset`, and `monthly` remain compatibility contracts.

The CEO contract exposes current-day activity as partial and exposes the latest complete UTC day, the latest seven complete UTC days, the preceding seven complete UTC days, and the latest thirty complete UTC days with exact boundaries. Each source reports availability, freshness, coverage, data-through time, and a bounded reason code. A successful aggregate query can return numeric zero, but without an all-history observation watermark its source fails closed as `unknown` with `source_history_missing`; an old watermark is `stale` with `source_data_stale`. A failed query or absent optional binding is `null` and unavailable; one failed source does not become a believable zero or prevent unrelated sections from returning.

Conservative metric-definition start days are artifact delivery `2026-07-18`, qualified update checks `2026-07-15`, minimized product telemetry `2026-07-24`, the combined CEO BUS Core site source and trusted artifact-click metric `2026-08-10`, TGC consented site reporting `2026-07-18`, voluntary-inquiry reporting `2026-06-01`, Lighthouse error totals `2026-03-10`, and scheduled service probes `2026-07-06`. BUS Core page-view history remains literal, but the combined source watermark does not use pre-cutover intent history. A window beginning before an otherwise available source’s definition start is partial; a trusted-click window ending before its definition start is `null`.

CEO BUS Core facts are literal page views, trusted possible download-interest actions from the `2026-08-10` definition boundary, full artifact responses offered, daily source credits, acknowledged opt-in product events, known-version request counts, and enumerated failure evidence. Pre-boundary generic intent rows are not relabeled as trusted clicks. Full responses exclude partial Range responses. Daily source credits may repeat across days or releases and are not people or installations. TGC business facts are consented `page_view` events and voluntary inquiry rows only. Inquiry attribution is merged into the fixed privacy-safe buckets `(direct)`, `github`, `reddit`, `hacker_news`, `discord`, `google`, `bing`, `linkedin`, `x_twitter`, `meta`, `youtube`, `email`, `partner`, and `other`; raw attribution labels never leave Lighthouse. The contract contains no composite score, inferred adoption, identity, visitor/session identifier, request identifier, IP/user-agent material, form content, or lead PII.

The CEO read is bounded to nine D1 statements when the optional lead binding is configured, executed in sequential batches of at most three. Product totals and named failures use a fixed conditional aggregate, while client-supplied app versions are ranked and limited to ten in D1 before reaching Worker memory. Tests compile the shared Draft 2020-12 schema in strict mode with format validation, validate every acceptance fixture and representative live producer state, and reject producer drift.

Scheduled health checks never call counted `/download/latest` or `/update/check`. Manifest liveness uses public `HEAD /manifest/core/stable.json`; a HEAD miss/error does not increment `metrics_daily.errors`, while a genuine public manifest GET miss/error does. The release-artifact probe reads and validates the exact canonical URL from the bound R2 manifest, then publicly HEADs that artifact, requiring `200` and positive `Content-Length`. `global_fetch_strictly_public` forces both same-zone HEAD requests through Cloudflare’s public routing path. Artifact HEAD method semantics keep the probe out of full-response, source-credit, counted-intent, and CEO artifact metrics while still proving Worker routing and artifact delivery; its raw/HEAD traffic semantics are unchanged.

Agent Smith owns status, trust, wording, and action. Lighthouse owns facts and availability. `contracts/ceo-v1/` is the shared strict schema and fixture authority. CEO contract 1.0 was deployed with Worker 1.29.0 on `2026-08-09T15:03:15.858733Z` as Cloudflare Version ID `757c24b7-fa98-40a5-8ea0-0e551d69c64f`; contract 1.1 was deployed with Worker 1.29.1 on `2026-08-09T16:41:20.004814Z` as Cloudflare Version ID `ee320e1a-9ceb-4d88-a848-fd7ae0e9e3bc`.

## BUS Core acknowledged minimal product signals — v1.27.0 deployed

`POST /telemetry/v1/events` acknowledges the submitted `event_id` only after its bounded deduplication key and aggregate increment have atomically succeeded, or the ID is recognized as a duplicate. BUS Core may remove a queued event only when that exact ID appears in `acknowledged_event_ids`; a generic 2xx response is not delivery proof. Receiver errors and rate limits remain unacknowledged. Migration 0015 removes raw BUS Core product-event history and persistent installation identifiers, retaining only bounded event-ID deduplication keys and aggregate counters.

Current events contain only `event_id`, `event_name`, client timestamp, app version, release channel, and OS category. No persistent installation identifier or event-specific content is accepted into persistence. Legacy payloads containing an installation ID are accepted temporarily for rollout compatibility, but that field is discarded before persistence. The allowlist is limited to first launch, locally deduplicated version adoption and successful feature-use milestones, startup/manual update checks, successful update staging, and reliability events.

Lighthouse must not collect or report module opens, active days, sessions, returning installations, engagement, retention, cross-day profiles, or any measure built by linking unrelated events from one machine. Bare BUS Core reports return literal accepted aggregate counts only. Route-level `/update/check` requests remain separate request counts; acknowledged product events distinguish startup and manual checks.

Migration `0015_minimize_buscore_product_telemetry.sql` was applied remotely on 2026-07-24 before Worker deployment. Remote verification confirmed the raw table and legacy trigger were removed, the bounded dedup table exists, and the existing aggregate remained unchanged. Worker 1.27.0 was deployed at `2026-07-24T16:17:29.479Z` as Cloudflare Version ID `bff7362e-1896-4a1c-b104-ff2afc2351bc`. Non-persisting production probes confirmed the current no-installation-ID payload shape and rejection of removed `active_day`; dedup and aggregate product-event counts remained unchanged.

## TGC aggregate commercial analytics — v1.29.0 deployed

The protected `GET /report?view=tgc` view remains the canonical on-demand diagnostic source for True Good Craft website analytics. Its response shape stays backward-compatible, but the v2 producer no longer supplies identity, scroll, engaged-time, section, field-level form, or first-party web-vital events. Agent Smith's daily/weekly/monthly decision surface uses only consented TGC page views and voluntary inquiry aggregates from `GET /report?view=ceo`.

TGC is aggregate-only. For `site_key=tgc_site`, Lighthouse discards `anon_user_id`, `session_id`, and `is_new_user` even if an older producer sends them. The exact server allowlist is `page_view`, `outbound_click`, `contact_click`, `email_click`, `buscore_outbound_click`, `services_interest`, `infrastructure_cta_click`, `infrastructure_package_interest`, `ops_care_interest`, `audit_cta_click`, `form_start`, `form_submit_attempt`, `form_submit_success`, `form_submit_failure`, `form_submit_fallback`, and `js_error`. It rejects the superseded identity lifecycle, internal-navigation, field-level form, scroll/engagement/section, and first-party web-vital event families.

The server enforces the TGC event allowlist, production-origin match, path/URL consistency, origin-and-path-only URL storage, bounded context, and test-mode exclusion. Viewports are stored only as `small`, `medium`, or `large`; during producer rollout an exact lowercase `WIDTHxHEIGHT` input is accepted and immediately bucketed by width before persistence. Event values are reduced to event-specific sanitized enums/categories or `null`. Form values, typed content, keystrokes, raw IP addresses, user-agent hashes, exact location, fingerprints, cross-site advertising identifiers, and session replay are prohibited. Minute-scoped abuse identifiers use keyed HMAC and are retained for two days; they are not copied into raw events. Scheduled maintenance also nulls legacy IP-hash, user-agent-hash, and request-ID columns in existing site-event rows. Raw TGC events are pruned after 90 days; other site-event raw rows are pruned after 30 days. No migration is required; 1.29.1 tightens the CEO response contract to version 1.1 as documented above.

Lighthouse remains the source of truth. Agent Smith may present this protected aggregate view through `/tgc`. Airtable may receive curated periodic KPI/campaign/content/experiment summaries later, but must not receive raw events or stable identifiers.

Worker 1.29.1 was deployed on `2026-08-09T16:41:20.004814Z` as Cloudflare Version ID `ee320e1a-9ceb-4d88-a848-fd7ae0e9e3bc`; it superseded the earlier 1.29.0 deployment. Current repository publication and production-promotion authority is defined by the v1.29.4 section above and `OPERATIONS.md`; the earlier 1.29.3 control-plane uncertainty is retained only as historical evidence. Wrangler production deployment preserves separately provisioned Worker secrets and, through the approved workflow, preserves dashboard-managed variables. Schema migrations remain separate, explicitly approved operations. Migration 0015 was remotely verified before Worker 1.27.0 deployment; versions 1.29.0 through 1.29.4 add no migration.

## BUS Core traffic truth and bounded delivery work — v1.25.0 deployed

`BUS_CORE_TRAFFIC_TRUTH.md` is the authoritative metric/privacy/retention/rollout contract for the new additive fields. Lighthouse now distinguishes Worker-visible artifact requests, successful 200/206 handoffs, full and partial responses, HEAD and Range traffic, declared response bytes, cache outcomes, daily HMAC/IP/version client-network buckets, repeats excluded from that proxy, inferred download intent, confirmed product events, and voluntary leads. None of these fields may be renamed to people, users, installations, completed downloads, or revenue.

Public delivery remains open. Canonical versioned full responses use the Worker Cache API and one-year immutable cache headers; range requests use R2 byte ranges and return 206; HEAD returns metadata without a body. Cache, D1, and qualification failures fail soft for delivery. Phase 3 hard artifact limiting is disabled because the 2026-07-18 audit did not establish repeat abuse inside the existing daily HMAC bucket.

Migration `0014_add_artifact_traffic_truth.sql` was applied remotely on 2026-07-18 at `17:12:45 UTC`, creating aggregate-only `artifact_traffic_daily` and `buscore_download_intent_daily` tables before Worker deployment. Production Worker version 1.25.0 was then deployed; the initial post-migration Cloudflare deployment is Version ID `1279aeb4-8904-491e-8130-b0d5a6657ef3`. New report fields return null with `artifact_measurement_available=false` only when the schema is unavailable. Daily truth aggregates retain 400 days; HMAC rate buckets retain two days. The legacy `metrics_daily.downloads` and `release_downloads_daily` fields remain compatibility data with mixed historical qualification semantics.

## Qualified BUS Core release-signal counting — v1.24.0 deployed

Lighthouse remains the versioned contract and ingestion authority for limited BUS Core product telemetry. Migration `0013_add_buscore_product_telemetry.sql` and Worker version 1.23.0 are deployed. A production VPN verification on 2026-07-17 recorded two qualified BUS Core v1.4.0 stable repeat checks; four attempts from the same daily HMAC scope were reduced to the configured two-count limit, confirming the update-check chain and abuse control end to end.

Production Worker version 1.24.0 (Cloudflare Version ID `4abf7160-518d-4474-81f2-da8a27f1182a`) applies the same privacy-preserving abuse-control model to release artifacts. Public artifact delivery is unchanged, but analytics count at most one qualified full request per HMAC-scoped IP, release version, and UTC day. The artifact scope is isolated from update-check and product-telemetry scopes. Missing client IP or secret, ignored IPs, `Range` requests, over-limit requests, and rate-storage failures contribute zero analytics without blocking valid artifact delivery. Raw IPs are not stored. No new migration is required because migration 0013's rate-control table is reused.

Historical download aggregates are not destructively rewritten; they remain visible until their normal report windows age out. Going forward, `downloads` means qualified, rate-bounded artifact requests, not people, installations, lifetime-unique downloaders, or proof that a response body completed transfer.

The implemented contract provides:

- a versioned BUS Core event schema;
- an event-name allowlist where every v1 event accepts the same exact common root/context fields and no event-specific content fields;
- rejection of unknown events and unexpected fields;
- separation of release/update signals from product-usage events;
- bounded retention and privacy-preserving rate controls;
- literal aggregates for first-launch/release observations, version distribution, one-time successful feature-use milestones, startup/manual update checks, staged updates, and reliability; voluntary Managed BUS inquiries remain a separate lead-system contract and are not product telemetry;
- a prohibition on customer, supplier, employee, item, recipe, invoice, document, filepath, exact financial, exact quantity, raw database, machine-fingerprint, or persistent raw-IP content.

Current BUS Core product events contain no persistent installation identifier. Legacy payloads may be accepted during rollout compatibility, but any legacy installation-ID field is discarded before persistence and cannot be used for linking. Lighthouse availability must remain optional and non-blocking for the self-managed product.

The contract endpoint is `POST /telemetry/v1/events`. Its current payload is defined by `contracts/buscore-product-telemetry-v1.json`; root and context keys are exact, not extensible, and the server derives the category. Event-ID deduplication keys are retained for 30 UTC-day buckets, aggregates for 400, and rate buckets for 2 days. No persistent installation identifier or raw product-event history is retained. Rate keys are HMAC-SHA256 values keyed by `TELEMETRY_RATE_LIMIT_SECRET`. Event IDs provide idempotent retry deduplication, and the batched deduplication insert plus conditional aggregate increment is atomic.

Bare BUS Core `/report` output includes additive `product_telemetry` windows for today, 7 days, and 30 days. Output is literal: category and event counts, version/channel/OS distributions, acknowledged first-launch and first-success counts, version-first-seen events, startup/manual update-check observations, staged updates, and reliability events. It contains no installation IDs, active-day counts, returning-installation measures, sessions, engagement, or retention. The route-level `/update/check` counter remains a qualified request total rather than an authenticated-client count.

Existing public-site `/metrics/event` and legacy `/metrics/pageview` behavior remain unchanged. The Lighthouse migration, Worker deployment, and non-persisting production contract verification required before the narrowed BUS Core client ships are complete.

## 1. System Overview

  - Lighthouse is a single Cloudflare Worker that acts as a minimal, privacy-first, aggregate-first stats source with a multi-site event ingestion spine and a legacy BUS Core pageview ingestion path.
- Lighthouse is a generic, deterministic metrics primitive; BUS Core is a current observed client/use-case, not a runtime dependency.
- It serves/proxies manifest data from R2, records daily aggregate counters in D1, records daily Buscore traffic snapshots in D1, accepts first-party pageview events into D1, and exposes a credential-protected multi-view `GET /report` endpoint.
- It does not post reports to Discord. Discord/operator report requirements are satisfied by authenticated local report payloads unless an outbound sender is explicitly approved in this SOT.
- Runtime surface: Worker `fetch` handler plus one scheduled daily job whose independently fail-soft tasks capture the previous completed traffic day, write rollups and public GitHub/probe snapshots, and prune bounded-retention data.

### Version and Release Authority

Shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned in `package.json`.
No behavioral, contract, storage, configuration, auth, or scheduling change is considered released unless all three are updated together in the same change set.
Lighthouse mirrors only implementation-relevant policy truth from `TGC Analytics Policie.md`; it does not duplicate full company policy prose that Lighthouse does not implement.

### Governance and Release Ownership

- Update `SOT.md` and `CHANGELOG.md` in the same change as any operator-visible, report-contract, endpoint, schema, privacy/security, or cross-repository change.
- Keep the `package.json` and `package-lock.json` version aligned with `CHANGELOG.md` when a repository change requires a version bump under the local governance policy.
- The governance workflow runs type-checking and the full Node test suite. Test discovery must remain shell-independent so local Windows validation and GitHub's Ubuntu runner execute the same tests.
- D1 migrations must be additive and backward-compatible where practical.
- Jamie/the user owns commits, deployments, D1 migration approval, and release approval. Agents prepare changes only and must not print secret values.

### Operational Independence Rule

Operational Independence Rule: Lighthouse must remain an independently runnable service. It may observe, receive traffic from, or report on BUS Core and other systems, but its core operation must not require BUS Core or any other external service to be available. All integrations must be optional, additive, and non-blocking.

Additional constraints:
- Lighthouse is a standalone service, not an architectural submodule of BUS Core or any other product.
- External services may call Lighthouse or consume Lighthouse outputs, but no Lighthouse core feature may require those services to be up.
- Proposed features that create hard runtime dependencies on external products are out of scope unless reworked to preserve independent operation.

### Operational Diagnostics Authority

`OPERATIONS.md` is the canonical access and diagnostic runbook for the shipped behavior in this SOT. It is subordinate to this SOT and may not introduce or authorize a route, credential, query, storage meaning, or status that is not grounded here and in current code.

Operational access rules:

- Default diagnosis is local and zero-mutation. Any production, Cloudflare, Discord, GitHub, D1, or other external interaction requires explicit scope approval.
- When an approved endpoint, credential source, account context, or tool authorization is unavailable, the result is `ACCESS_BLOCKED`, not a Lighthouse outage. Agents must not substitute guessed URLs, unrelated credentials, direct D1 SQL, or broader probes.
- Protected `view=ceo`, `view=tgc`, `view=source_health`, `view=asset`, and `view=monthly` skip the best-effort traffic refresh and are the read-mostly report surfaces. They are not guaranteed zero-write because a report-assembly failure best-effort increments `metrics_daily.errors`.
- Bare `/report`, `view=fleet`, and `view=site` perform a best-effort previous-completed-day traffic capture/upsert before assembly. Public manifest GET failures, update checks, download redirects, artifact requests, telemetry submissions, admin POST routes, scheduled work, D1 operations, migrations, deployments, and releases can also mutate evidence or state as specified by their route contracts.
- `HEAD /manifest/core/stable.json` does not increment `metrics_daily.errors`. `HEAD /releases/:filename` still records raw/HEAD artifact truth and therefore is not a zero-mutation diagnostic.
- `view=source_health` is telemetry-ingestion integrity, not endpoint liveness. Scheduled `health_checks` and CEO `details.service_probes` are the service-probe evidence.
- Agent Smith owns WATCH/ALERT/UNAVAILABLE and report-delivery wording. Lighthouse owns facts, availability, exact windows, source state, limitations, and scheduled probe rows. A WATCH is not automatically an outage.
- Repository publication is operational state, not a zero-mutation diagnostic. The 1.29.3 `main` merge proved that the former Workers Builds production command `npx wrangler deploy` could promote traffic independently of `.github/workflows/deploy.yml`. On 2026-08-26, the production command was changed to `npx wrangler versions upload`, and durable readback after reload confirmed that both production Deploy and Version commands match that value. No build, upload, or deployment was invoked during the change. Pushes can still create version/preview state, while production promotion remains a separate, explicitly approved manual workflow action. If the external setting later becomes inaccessible or differs from the verified value, merge is `BLOCKED BEFORE MERGE` until reconciled.
- Known producer-side drift must be reported rather than normalized. BUS Core `1.4.2` emits repeatable `restore_attempted`, `restore_completed`, `import_completed`, and `import_failed` events that the current Lighthouse contract accepts, but those events remain outside BUS Core's SOT-authorized signal set. Lighthouse acceptance does not grant producer authority; BUS Core's SOT governs pending a separate resolution.
- Lighthouse, Agent Smith, BUS Core, buscore-site, and tgc-site remain independent failure domains; one unavailable producer, consumer, optional binding, or presentation layer must not be promoted into an unsupported cross-service diagnosis.

## 1a. Phase 2 Analytics Foundation (v1.17.0)

Phase 2 of `BUS-Core-Analytics-Plan.md`. Additive, aggregate/operator-only, no PII, no new user telemetry. Lighthouse remains the data layer and still does not post to Discord. `PHASE2_ANALYTICS_NOTES.md` is a historical implementation record; use this SOT and `OPERATIONS.md` for current behavior and diagnostics.

Four additive D1 tables and their scheduled writers:
- `daily_rollup` — one aggregate row per completed UTC day. Writer runs in the daily cron for the **previous completed UTC day** (never partial-day). Reuses existing report query helpers; `wqpi = artifact_downloads + attributed_leads` (same definition as the Phase 1 brief). Missing inputs (e.g. no `BUSCORE_LEADS_DB`) are stored `null`, never faked. `return_rate` is stored `null` (a 7-day windowed metric, not an honest single-day value). Idempotent: `INSERT ... ON CONFLICT(day) DO UPDATE`, `day` is PRIMARY KEY.
- `campaign_log` — operator-authored community-post annotations. No user data, no lead PII. Indefinite retention. Written via the admin-token-protected `POST /campaign` route; manual `wrangler d1 execute` insert is also supported.
- `github_snapshots` — daily public GitHub project-health snapshot. Each field fetched under its own guard; unavailable fields stored `null`, never faked. Idempotent per `day`. Stars are a weak signal; cadence/releases/issues/PRs/contributors matter more.
- `health_checks` — active funnel liveness probes, once per daily cron (low frequency). Each probe is isolated and never throws; a failure records `ok = 0` with a note and cannot break reporting or the rest of the scheduled run. Pruned to ~90 days.

New routes/views:
- `POST /campaign` — administrative-write protected through `X-Admin-Token`/`ADMIN_TOKEN`; `REPORT_READ_TOKEN` is never accepted. Operator/aggregate data only. `201 {ok,id}` on success; `401` without valid admin authentication; `400 invalid_json`/`invalid_campaign`; `503 campaign_insert_failed`.
- `GET /report?view=asset` — protected read of stored Phase 2 aggregates: latest + recent `daily_rollup`, latest `github_snapshots`, latest-per-target `health_checks`, and recent `campaign_log` with downstream event/lead counts joined by `tagged_src`/`utm_campaign`. It accepts the current report-read contract defined in the v1.30.0 section and skips the best-effort traffic refresh (reads stored aggregates only). Existing `legacy`/`fleet`/`site`/`source_health` views are unchanged.

Scheduling: the existing daily cron `5 0 * * *` now also runs, after traffic capture (so the rollup sees the day's traffic row), the daily-rollup / github-snapshot / health-check / prune writers. Each is independently fail-soft; one failing cannot break the others or core reporting.

Health-probe safety invariants:
- Manifest route liveness is validated with public `HEAD /manifest/core/stable.json`; a HEAD miss/error does not increment `metrics_daily.errors`, while a genuine public GET miss/error does. Probes never call `/update/check` or `/download/latest`.
- Artifact routing and reachability read/parse the bound R2 manifest to select the exact canonical `/releases/...` URL, then validate it with a public HEAD. A pass requires status `200` and `Content-Length > 0`; HEAD remains excluded from full-response, daily source-credit, counted-intent, and CEO artifact metrics while ordinary raw/HEAD artifact accounting remains unchanged.
- `global_fetch_strictly_public` is required so same-zone probe fetches traverse Cloudflare’s public Worker route rather than bypassing it to origin.
- The lead endpoint is probed with **GET only**; `2xx` or `405 Method Not Allowed` proves route liveness. `404` fails, and Lighthouse never POSTs a synthetic lead.
- GitHub release liveness uses public `HEAD /<configured-repository>/releases/latest`, independent of REST API quota. A `200` or same-repository release-tag redirect passes; an unrelated redirect or missing release fails.

Privacy: all four tables are aggregate/operator-authored. No emails, no `bc_uid`/`bc_sid`, no `anon_user_id`/`session_id`, no raw or hashed IPs, no user-agent, no fingerprints. `top_source`/`top_referrer` are channel/domain names, not identities. `view=asset` exposes none of the above.

Configuration additions (both optional): `GITHUB_REPO` (defaults to `True-Good-Craft/TGC-BUS-Core`) and `GITHUB_TOKEN` (optional; raises GitHub API rate limits). Absence degrades GitHub fields to `null`, never fake data.

## 1b. Phase 3 Analytics: Monthly Asset Brief, Scoring, Archival (v1.18.0)

Phase 3 of `BUS-Core-Analytics-Plan.md`. Additive, aggregate-only, no PII, no new telemetry, no AI. Lighthouse remains the data/scoring layer and still does not post to Discord (Agent Smith posts and archives). `PHASE3_ANALYTICS_NOTES.md` is a historical implementation record; use this SOT and `OPERATIONS.md` for current behavior and diagnostics.

Two additive D1 tables (migration `0011_add_phase3_report_and_notes.sql`):
- `report_snapshots(id, generated_at, kind, status, wqpi, summary_json, narrative)` — dated archive of each generated brief. Aggregate only, indefinite retention.
- `operator_notes(id, created_at, note, tag)` — operator annotations feeding the monthly narrative.

Deterministic scoring (pure, exported functions; documented weights):
- `computeProductIntentScore`, `computeCommunityResponseScore`, `computeGithubTrustScore`, `computeReliabilityScore`, `computeLeadQualityScore`, and the composite `computeAcquisitionReadinessScore`.
- Each returns `{ score: number|null, available, reason, weight, inputs }`.
- **Honesty invariants (non-negotiable):** a score is `null` (never faked) when its primary input is missing, with a reason such as `awaiting first scheduled rollup` / `insufficient data`; every score carries its raw `inputs` (raw numbers are never hidden); a score is explicitly **not a valuation**; Acquisition Readiness is **capped by Reliability** and returns `null` if Reliability is unavailable; **stars are weighted ≤10%** of GitHub Trust. Downloads are not users; update checks are not active users.

New routes/views:
- `GET /report?view=monthly` — protected by the current report-read contract defined in the v1.30.0 section; returns the previous completed calendar month's structured asset data: wQPI MoM, downloads, attributed leads + lead quality, known-version check-in average + adoption (labelled proxy), community posts → downstream (per channel), reliability (uptime/errors/freshness), GitHub health, the five scores with inputs, previous-month Acquisition Readiness for the delta, and recent operator notes. Skips the traffic refresh (reads stored aggregates). Missing pieces are `null`/`awaiting first scheduled rollup`, never faked.
- `POST /notes` — administrative-write protected through `X-Admin-Token`/`ADMIN_TOKEN`; insert an operator note `{ note, tag? }`.
- `POST /report/snapshot` — administrative-write protected through `X-Admin-Token`/`ADMIN_TOKEN`; archive a generated brief `{ kind (daily|weekly|monthly), status?, wqpi?, summary_json?, narrative? }`.

Privacy: `report_snapshots`, `operator_notes`, and `view=monthly` are aggregate/operator-authored. No emails, `bc_uid`/`bc_sid`, `anon_user_id`/`session_id`, raw or hashed IPs, user-agent, or fingerprints. `summary_json` carries compact aggregate numbers only.

## 2. Architecture Invariants

The following rules are non-negotiable unless this SOT is explicitly revised:

- Lighthouse is a single Cloudflare Worker.
- Lighthouse is privacy-first and aggregate-first.
- Lighthouse is operationally independent and independently runnable.
- Core operation must not depend on BUS Core or any external service.
- Reporting is on-demand.
- Scheduled behavior is limited to the one approved daily cron and its independently fail-soft traffic capture, completed-day rollup, public GitHub snapshot, service probes, and bounded-retention pruning defined in this SOT.
  - Two unauthenticated first-party event ingestion endpoints are approved and documented in this SOT: `POST /metrics/pageview` (BUS Core legacy) and `POST /metrics/event` (multi-site standard).
- No outbound posting or outbound integrations unless explicitly approved in this SOT.
- The current fixed metric model (`update_checks`, `downloads`, `errors`) is shipped behavior unless this SOT explicitly changes it.
- Buscore traffic telemetry is an additive extension for operator visibility and system understanding; it must not break or reinterpret the shipped core metric model.
- Raw pageview retention must remain narrow, short-lived, and non-identifying.
- SOT, changelog, and implementation must stay aligned.

## 3. Entry Points

`fetch(request, env, ctx)` in `src/index.ts` handles:

`scheduled(controller, env, ctx)` in `src/index.ts` handles:

### Daily Buscore Traffic Capture and Retention

- Runs once per day on a Worker cron.
- Uses one Cloudflare GraphQL Analytics API query per scheduled run for traffic totals.
- Always queries the previous completed UTC day.
- Never queries the current UTC day.
- Never persists rolling-window traffic snapshots.
- Uses `CF_API_TOKEN` bearer auth against `https://api.cloudflare.com/client/v4/graphql`.
- Scopes the query by `CF_ZONE_TAG` and hostname `buscore.ca`.
- **Traffic Totals Query:**
  - Queries daily request `count` and visitor `sum.visits` on `httpRequestsAdaptiveGroups`.
  - Lighthouse validates that the response includes a numeric daily request count metric (`count`); if missing/undefined/non-numeric, the entire capture for that day fails and skips the row.
- On successful pull, upserts one final row into `buscore_traffic_daily` for the selected UTC day.
- Capture is idempotent per day: reruns converge to one final row for that day.
- If the traffic totals Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day entirely.
- If the traffic query returns no daily row for the selected day and hostname, Lighthouse treats that run as failed and skips the row.
- The same scheduled run prunes raw pageview rows older than about 30 UTC days and prunes stale rate-limit buckets older than about 2 days.
- This scheduled behavior is additive and non-blocking. Lighthouse core request handling and core metric reporting remain operational if the Cloudflare pull path is unavailable.

### Manifest Service

- `GET /manifest/core/stable.json` — **Canonical public manifest read route**
  - Returns manifest JSON from `MANIFEST_R2` to web pages, downloads pages, and other clients.
  - Does not count successful reads; a miss/error increments `metrics_daily.errors`.
  - Returns `200` manifest JSON on success.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when unavailable.
- `HEAD /manifest/core/stable.json` — **Public manifest metadata/liveness route**
  - Returns `200` with manifest metadata and no body when the R2 object exists.
  - Returns `503` with no body when unavailable, but a HEAD miss/error does not increment `metrics_daily.errors`.

- `GET /update/check` — **Manifest proxy with update check counting**
  - Returns manifest JSON from `MANIFEST_R2`.
  - Manifest delivery is public and independent from counting. Ineligible or rate-limited callers still receive the same successful manifest response and contribute zero analytics.
  - Counting requires exactly one each of `current_version`, `channel`, and `first_check` as query parameters, with no extra parameters. Legacy `version` aliases and `X-BUS-Core-*` header fallbacks are not count-eligible.
  - `current_version` must be canonical strict `major.minor.patch` SemVer, at least `1.4.0`, and no newer than the selected channel's manifest version.
  - `channel` must be one of `stable`, `test`, `partner-3dque`, `lts-1.1`, or `security-hotfix`. Stable uses top-level `latest`; every non-stable channel requires an explicit `channels.<channel>.version` entry.
  - `first_check` must be exactly lowercase `true` or `false`. Qualified requests increment only `first_check_true` or `first_check_false`; new qualified traffic never creates unknown-version/channel/first-check rows. Historical unknown rows remain reportable.
  - Counting also requires `CF-Connecting-IP`, configured `TELEMETRY_RATE_LIMIT_SECRET`, a non-ignored IP, and allowance under the two-count-per-IP-per-UTC-day gate. The stored rate key is a daily, scope-separated HMAC; raw IP is never stored or reported.
  - Eligibility and rate control reduce scanner and casual abuse pollution but are not cryptographic proof that a request came from an authentic BUS Core binary.
  - Any validation or rate-control failure skips both `metrics_daily.update_checks` and `release_update_checks_daily` writes without failing manifest delivery.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` on manifest errors.

### Download Service

- `GET /download/latest` — **Redirect intent endpoint**
  - Redirects (`302`) to the validated release artifact URL from `manifest.latest.download.url`.
  - Accepts either a relative release URL (for example `/releases/BUS-Core-1.0.4.zip`) or an absolute URL using the same release path format.
  - Never increments `downloads` directly.
  - Returns `503` JSON `{ "ok": false, "error": "manifest_unavailable" }` when URL is missing/invalid.

- `GET /releases/:filename` — **Raw asset delivery with qualified artifact-request counting**
  - Serves release artifacts directly from `MANIFEST_R2` using key `releases/:filename`.
  - An existing artifact increments `downloads` in `metrics_daily` and `release_downloads_daily` only for a full `GET` with `CF-Connecting-IP`, configured `TELEMETRY_RATE_LIMIT_SECRET`, a non-ignored IP, and allowance under the one-count-per-IP-per-release-per-UTC-day gate.
  - The stored gate key is a daily, scope-separated HMAC. Raw IP is never stored or reported, and the artifact scope cannot consume update-check or product-telemetry allowance.
  - Any eligibility or rate-control failure skips both download-counter writes without blocking valid artifact delivery.
  - Does not increment counters for `404` missing artifacts, invalid filenames, non-`GET` requests, `HEAD`, ignored IPs, missing secret/IP, over-limit requests, rate-storage failures, or conservative non-full requests carrying `Range`.
  - `downloads` means qualified, rate-bounded artifact requests, not redirect intent, people, installations, lifetime-unique downloaders, or confirmed completed transfers.
  - Allowed filename formats: `BUS-Core-<semver>.zip` (current) and `TGC-BUS-Core-<semver>.zip` (legacy, preserved for backward compatibility).
  - Returns `200` with artifact body when object exists.
  - Returns `404` JSON `{ "ok": false, "error": "not_found" }` when missing or filename is invalid.

### First-Party Pageview Ingestion

### Tracked-Site Registry

  - Lighthouse maintains a code-level tracked-site registry (`TRACKED_SITES`) defining every site/property for which it may receive events or capture traffic.
  - Each registry entry carries: `site_key`, `label`, `status` (`active` | `staging` | `planned`), `production_hosts`, `allowed_origins`, `staging_hosts`, `cloudflare_traffic_enabled`, `cloudflare_host`, and `production_only_default`.
  - BUS Core is registered as `site_key: "buscore"` with `status: "active"`. Its CORS allow-list (`https://buscore.ca`, `https://www.buscore.ca`) and Cloudflare traffic capture host (`buscore.ca`) are derived from its registry entry.
  - Star Map Generator is registered as `site_key: "star_map_generator"` with `status: "active"`, production host `starmap.truegoodcraft.ca`, and allowed browser origin `https://starmap.truegoodcraft.ca`.
  - True Good Craft website is registered as `site_key: "tgc_site"` with `status: "active"`, production hosts `truegoodcraft.ca` and `www.truegoodcraft.ca`, allowed browser origins `https://truegoodcraft.ca` and `https://www.truegoodcraft.ca`, and Cloudflare traffic capture disabled.
  - CORS origin policy for `POST /metrics/pageview` is scoped exclusively to the `buscore` registry entry.
  - CORS origin policy for `POST /metrics/event` is derived from the union of all `active` tracked-site `allowed_origins` entries.
  - Adding a new tracked site requires only a registry entry update. No structural changes to Lighthouse endpoints are needed.

### Cross-Site Developer/Operator Analytics Exclusion Standard

  - Lighthouse relies on site-side telemetry loaders to gate telemetry emission before requests are sent.
  - The canonical developer/operator analytics suppression cookie for Lighthouse-integrated public sites is `dev_mode`.
  - `dev_mode` is presence-based: if the cookie is present for the current page load, telemetry emission is suppressed regardless of cookie value.
  - This suppression contract applies to both BUS Core legacy pageview telemetry (`POST /metrics/pageview`) and standardized multi-site event telemetry (`POST /metrics/event`).
  - Under active suppression, site-side loaders are expected to suppress all analytics work for that page load, including Cloudflare Web Analytics injection and Lighthouse telemetry emission.
  - This is an integration-contract expectation for tracked public sites; Lighthouse ingestion routes do not enforce cookie checks server-side.
  - This developer/operator suppression standard is separate from public privacy opt-out controls (for example `localStorage.noAnalytics === "1"`).
  - Because tracked sites can span separate registrable domains, the standard is shared by cookie name and semantics (`dev_mode`), not by one universal cookie instance.

### Standard Multi-Site Event Ingestion

  - `POST /metrics/event`
    - Unauthenticated by design.
    - Accepts JSON payloads from any registered tracked site.
    - Always returns `204 No Content` with no response body.
    - CORS is limited to `allowed_origins` of active tracked sites; wildcard `Access-Control-Allow-Origin` is never used on this route.
    - Validates the standard event contract: required fields `site_key`, `event_name`, `client_ts`, `path`, `url`, `referrer`, `device`, `viewport`, `lang`, `tz`, and required object `utm` (which may be `{}`). Optional fields: `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, `is_new_user`, `event_value`, `test_mode`.
    - Validates that `site_key` is present in the tracked-site registry.
    - Contract validation follows the same shape rules as `POST /metrics/pageview`; malformed or invalid submissions are silently dropped and still return `204`.
    - Accepted events are persisted to `site_events_raw` in D1 with standard server-side enrichment: `received_at`, `received_day`, `referrer_domain`, `country`, and `ingest_version`.
    - Standardized-event rows store `ip_hash`, `user_agent_hash`, and `request_id` as `null`; raw IP and user-agent values are never stored in those rows.
    - Uses `ctx.waitUntil(...)` so response completion stays fast.
    - When `TELEMETRY_RATE_LIMIT_SECRET` and a client IP are available, abuse control uses a purpose-scoped, keyed HMAC-SHA256 identifier that rotates each UTC minute (approximately 50 events per keyed minute identifier). The identifier exists only in `site_event_rate_limit` and is not analytics identity.
    - Rate-limited submissions still return `204`, are persisted with `accepted = 0` and `drop_reason = "rate_limited"`, and are excluded from accepted aggregations.

### First-Party Pageview Ingestion

  - `POST /metrics/pageview`
  - Unauthenticated by design.
  - Accepts JSON request bodies from the already-deployed BUS Core site emitter contract.
  - Always returns `204 No Content` with no response body.
  - CORS is explicitly limited to first-party BUS Core origins `https://buscore.ca` and `https://www.buscore.ca`; Lighthouse does not use wildcard `Access-Control-Allow-Origin` on this route.
  - When the request `Origin` matches one of those two origins, Lighthouse returns `Access-Control-Allow-Origin` echoing that origin, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, and `Vary: Origin`.
  - Requests from other origins still receive the normal `204` response semantics, but Lighthouse does not grant broad cross-origin browser access for this route.
  - Never emits client-visible error detail for malformed, partial, or rate-limited submissions.
  - Uses `ctx.waitUntil(...)` so response completion stays fast for beacon and keepalive callers.
  - Reads request body exactly once as raw text and then JSON-decodes from that same raw string, without requiring strict request `Content-Type` matching for valid JSON bodies.
  - For `POST /metrics/pageview`, raw body capture is completed on the request path before returning `204`, and ingest persistence/parsing work continues in `ctx.waitUntil(...)`.
  - Validates the canonical emitter shape: `type = "pageview"`, required string fields `client_ts`, `path`, `url`, `referrer`, `device`, `viewport`, `lang`, `tz`, and required object field `utm` (which may be `{}`).
  - Optional fields `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, and `is_new_user` may be omitted and are stored as nullable/default values when missing.
  - Empty-string values are accepted for `referrer`, `lang`, and `tz` and are stored as empty strings.
  - `anon_user_id` and `session_id` are nullable anonymous UUID-like continuity fields; malformed values are nulled and ingestion continues.
  - `is_new_user` is coerced from boolean-like inputs into integer `0/1` and defaults to `0` when absent or malformed.
  - If the body is unreadable, empty, invalid JSON, or contract-invalid on required fields, Lighthouse still returns `204` and records the submission as dropped-invalid when persistence is available.
  - Temporary ingest debugging aid (version-scoped) logs body-capture snapshots for accepted and invalid-json ingest paths, including `body_capture_stage_reached`, `raw_body_length`, and `capture_error`.
  - The same temporary debug aid includes invalid-json raw body preview logging (first about 500 characters) plus request `Content-Type` and inferred beacon/fetch transport hint from request metadata.
  - Performs server-side enrichment with canonical `received_at`, canonical `received_day`, parsed `referrer_domain`, Cloudflare `country` when available, `request_id` from `CF-Ray` when available, and fixed `ingest_version`.
  - Canonical ordering and aggregation are always based on `received_at` / `received_day`, never `client_ts`.
  - Accepted submissions are marked `js_fired = true`.
  - Lighthouse accepts the deployed site emitter contract as authoritative and does not add auth, retries, synthetic identity reconstruction, unload analytics, or client/server reconciliation logic.

### Pageview Noise Control

- Lighthouse applies a narrow anti-noise guard of approximately 50 events per IP hash per UTC minute.
- Rate limiting uses D1 minute buckets keyed by SHA-256 IP hash only; raw IPs are never stored.
- Rate-limited submissions still return `204` but are excluded from accepted aggregates.

### Reporting

- `GET /report`
  - Accepts either the exact usable `X-Report-Token`/`env.REPORT_READ_TOKEN` match or the backward-compatible exact non-empty `X-Admin-Token`/`env.ADMIN_TOKEN` match.
  - `REPORT_READ_TOKEN` is optional and usable only when it is an independently generated cryptographically random string containing 32 to 128 URL-safe ASCII characters (`A-Z`, `a-z`, `0-9`, `_`, and `-`). Absence or malformed configuration never disables a distinct administrative fallback and never authorizes a request.
  - If non-empty `REPORT_READ_TOKEN` and `ADMIN_TOKEN` values are identical, both report-read paths and all three administrative writes fail closed with `401` before database or deferred work.
  - Header names are not interchangeable: the read credential is accepted only through `X-Report-Token`, and placing it in `X-Admin-Token` does not grant administrative access.
  - On auth failure: returns `401` JSON `{ "ok": false, "error": "unauthorized" }`.
  - If `view` is omitted, blank, or absent, `/report` preserves the legacy response shape with `today`, `yesterday`, `last_7_days`, additive top-level `last_30_days`, `month_to_date`, `trends`, additive top-level `traffic`, additive top-level `human_traffic`, additive top-level `identity`, additive top-level `site_events`, and additive top-level `release_signals`.
  - Bare legacy `/report` continues to support `site_key` with optional flags `exclude_test_mode` (default `true`) and `production_only` (default from tracked-site `production_only_default`) for the additive `site_events` block only.
  - `production_only` defaulting is per tracked-site declaration, not one hard global runtime constant. BUS Core is explicitly grandfathered as the legacy-hybrid exception with `production_only_default = false`; Star Map and TGC remain `true`.
  - If legacy `/report` omits `site_key`, `site_events` is `null` to avoid silently blending multiple tracked sites.
  - `GET /report?view=fleet` returns `{ view, generated_at, sites }` for all tracked properties.
  - `GET /report?view=site&site_key=<site_key>` returns `{ view, generated_at, scope, summary, traffic, events, identity, health }` for exactly one tracked property and accepts the same `exclude_test_mode` and `production_only` flags as the legacy `site_events` scope. For BUS Core only, it also returns additive `operator_summary`.
  - `GET /report?view=source_health` returns `{ view, generated_at, sites }` as a telemetry-integrity view.
  - Invalid `view` returns `400` JSON `{ "ok": false, "error": "invalid_view" }`.
  - `view=site` without `site_key` returns `400` JSON `{ "ok": false, "error": "missing_site_key" }`.
  - Unknown `site_key` on legacy `/report` or `view=site` returns `400` JSON `{ "ok": false, "error": "invalid_site_key" }`.
  - Before assembling legacy `/report`, `view=fleet`, or `view=site`, Lighthouse performs one best-effort refresh capture for the previous completed UTC day using the same traffic capture logic as the scheduled path.
  - `view=source_health` intentionally skips that best-effort traffic refresh because it is a telemetry-integrity view over already persisted ingestion/state data rather than a Cloudflare traffic KPI view.
  - When the best-effort refresh runs, it remains idempotent via per-day upsert semantics and keeps one stored row per completed UTC day.
  - If a best-effort refresh attempt fails, `/report` still returns successfully using only currently stored traffic data.
  - This behavior is additive and does not replace the scheduled daily capture job.

### Release Signals

- Bare `/report` includes additive `release_signals.today`, `release_signals.last_7_days`, and `release_signals.last_30_days` windows.
- Each release-signal window contains:
  - `artifact_downloads`
  - `artifact_downloads_by_release[]` with `release_version`, `filename`, and `downloads`
  - `raw_update_checks` = `SUM(metrics_daily.update_checks)` for the window
  - `breakdown_update_checks` = `SUM(release_update_checks_daily.checks)` for the window
  - `raw_breakdown_delta` = `raw_update_checks - breakdown_update_checks`
  - `update_checks`
  - `update_checks_with_known_client_version`
  - `update_checks_unknown_client_version`
  - `update_available_impressions`
  - `latest_version_checkins`
  - `first_seen_checkins` = `SUM(first_check_true)`
  - `repeat_checkins` = `SUM(first_check_false)`
  - `unknown_first_checkins` = `SUM(first_check_unknown)`
  - `first_seen_share` = `first_seen_checkins / (first_seen_checkins + repeat_checkins)`, or `0` when that denominator is `0`
- `update_available_impressions` means a known client version was older than the latest manifest version served.
- `latest_version_checkins` means a known client version matched the latest manifest version served.
- The raw-versus-breakdown fields are reconciliation instrumentation: a positive `raw_breakdown_delta` means raw update checks were counted but the versioned daily-breakdown total is lower for the same window. Existing `update_checks` remains the versioned breakdown total for backward compatibility.
- `raw_update_checks` is the authoritative qualified, rate-bounded update-check total for decisions. It is not an authenticated-client count. The compatible `update_checks` field is deprecated for decision use and remains only to avoid breaking older consumers.
- `first_seen_checkins`, `repeat_checkins`, and `unknown_first_checkins` are aggregate check-in bucket counts. Qualified v1.23.0+ counting requires `first_check=true|false`; `unknown_first_checkins` remains for historical rows written under the earlier optional-param contract. These fields are not users, installs, devices, or unique anything; there is no reported identity or install ID.
- Lighthouse does not claim installs, successful update completion, or completed artifact transfer; it reports only qualified, rate-bounded request signals.

### Fallback Behavior

- `OPTIONS` returns `200`.
- `OPTIONS /metrics/pageview` advertises `POST, OPTIONS` for the ingestion route.
- `OPTIONS /metrics/pageview` returns first-party CORS allow headers only for `Origin` values `https://buscore.ca` and `https://www.buscore.ca`, and never returns wildcard `Access-Control-Allow-Origin` on that route.
  - `POST /metrics/pageview`, `POST /metrics/event`, and `POST /telemetry/v1/events` are the approved public non-`GET` ingestion routes; public `HEAD` is also supported for the stable manifest and canonical release artifacts.
  - `OPTIONS /metrics/event` advertises `POST, OPTIONS` and returns CORS allow headers for the origin if it matches an active tracked-site entry; never returns wildcard on that route.
  - Other non-`GET` methods return `405` JSON `{ "ok": false, "error": "method_not_allowed" }`.
- Unmatched routes return `404` JSON `{ "ok": false, "error": "not_found" }`.

## 4. Persistence

- D1 binding: `DB`
- Table: `metrics_daily`
- Table: `buscore_traffic_daily`
- Table: `pageview_events_raw`
- Table: `pageview_daily`
- Table: `pageview_daily_dim`
- Table: `pageview_rate_limit`
- Table: `site_events_raw`
- Optional external read binding: `BUSCORE_LEADS_DB`, pointing at the BUS Core site `early_access_leads` D1 database for aggregate `operator_summary` reporting and CEO voluntary-inquiry totals only.
- Table: `site_event_rate_limit`
- Table: `release_downloads_daily`
- Table: `release_update_checks_daily`
- Table: `buscore_product_event_dedup`
- Table: `buscore_product_events_daily`
- Table: `buscore_telemetry_rate_limit`
- Aggregate counters: `update_checks`, `downloads`, `errors`
- `downloads` means qualified, rate-bounded Lighthouse release artifact requests. It is not a completed-transfer counter.
- Day key format: UTC `YYYY-MM-DD`
- `buscore_traffic_daily` schema:
  - `day TEXT PRIMARY KEY`
  - `visits INTEGER NULL`
  - `requests INTEGER NOT NULL`
  - `captured_at TEXT NOT NULL`
- `buscore_traffic_daily` stores one row per completed UTC day only.
- `requests` is sourced from daily request `count` on `httpRequestsAdaptiveGroups`.
- `visits` is sourced from `sum.visits` on `httpRequestsAdaptiveGroups` when present, and remains nullable.
- `pageview_events_raw` stores append-only first-party pageview submissions for about 30 UTC days with only narrow event fields required for inspectability, debugging, and source/path attribution.
- `pageview_events_raw` stores `ip_hash` and `user_agent_hash` as SHA-256 hashes when those source values are present; Lighthouse does not store raw IPs.
- `pageview_events_raw` also stores optional anonymous continuity fields `anon_user_id`, `session_id`, and `is_new_user` from first-party payloads.
- `pageview_events_raw.accepted = 1` means the submission counted toward accepted pageview aggregates.
- `pageview_events_raw.drop_reason` is currently limited to `invalid_json` and `rate_limited` when populated.
- `pageview_daily` stores one row per `received_day` with accepted pageview totals, drop counters, and the latest observed `received_at` for that day.
- `pageview_daily.pageviews` and `pageview_daily.accepted` increment together for accepted submissions.
- `pageview_daily_dim` stores accepted dimension counts for exactly four dimension types: `path`, `referrer_domain`, `src`, and `utm_source`.
- `pageview_rate_limit` stores approximate per-minute IP-hash counters only for ingestion noise control and has no reporting role.
- `site_event_rate_limit` stores approximate per-minute keyed HMAC identifiers only for standardized event-ingestion noise control, is pruned after two days, and has no reporting role.
- `site_events_raw` stores bounded-retention multi-site event submissions with standard enrichment fields. `site_key` is the per-site discriminator for report isolation. `event_name` identifies the event type within a site. `accepted = 1` means the event was accepted and persisted. Current standardized ingestion writes `ip_hash`, `user_agent_hash`, and `request_id` as `null`; short-lived keyed abuse identifiers live only in the rate table.
- `BUSCORE_LEADS_DB` is read only by the BUS Core `operator_summary` report path and the CEO voluntary-inquiry source. These paths aggregate `early_access_leads` attribution columns (`src`, `utm_source`, `utm_campaign`, `referrer_domain`, and timestamps) and never return lead emails, workflow details, analytics IDs, IP addresses, hashed IPs, user-agent hashes, or raw lead rows.
- `release_downloads_daily` stores one row per day, filename, and release version for qualified, rate-bounded Lighthouse artifact requests.
- `release_update_checks_daily` stores one row per day, channel, client version bucket, latest manifest version bucket, and `update_available` state for qualified, rate-allowed `GET /update/check` responses.
- `release_update_checks_daily` also carries the additive first-check counters `first_check_true`, `first_check_false`, and `first_check_unknown` (all `INTEGER NOT NULL DEFAULT 0`). `first_check` is not part of the row key: each qualified, rate-allowed check increments exactly one known-status counter on the existing row. The unknown counter is retained for historical compatibility, so reporting remains aggregate-only with no identity or install ID.

## 5. Configuration

Required bindings/secrets used by code:

- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN` — required exact-match administrative credential accepted through `X-Admin-Token` for the three protected writes and retained as a backward-compatible report credential.
- `REPORT_READ_TOKEN` — optional secret; when it is an independently generated cryptographically random string containing 32 to 128 URL-safe ASCII characters (`A-Z`, `a-z`, `0-9`, `_`, and `-`) and differs from `ADMIN_TOKEN`, its exact value is accepted only through `X-Report-Token` for `GET /report`. It is never accepted by a write route and is not configured in `[vars]`. An identical non-empty admin/read configuration disables every protected read and write until corrected.
- `IGNORED_IP` — optional; if set, requests whose `CF-Connecting-IP` exactly matches this value skip counter increments but receive normal responses.
- `CF_API_TOKEN` — required for the approved daily Buscore traffic capture job.
- `CF_ZONE_TAG` — required for the approved daily Buscore traffic capture job.
- `TELEMETRY_RATE_LIMIT_SECRET` — required in production; keys scope-separated standardized-site and BUS Core product-telemetry identifiers that rotate by UTC minute and qualified update-check/artifact-request identifiers that use UTC-day buckets. Update-check and artifact-request counting fail closed when this secret is absent. A random per-isolate fallback remains local-development compatibility for product telemetry only, not the production contract.
- `BUSCORE_LEADS_DB` — optional external read binding used only for aggregate BUS Core operator reporting and CEO voluntary-inquiry totals; Lighthouse core operation and all unrelated report sources remain available when it is absent.
- `GITHUB_REPO` — optional configured repository slug for the scheduled GitHub snapshot and latest-release probe; defaults to `True-Good-Craft/TGC-BUS-Core` when absent.
- `GITHUB_TOKEN` — optional secret used by the scheduled GitHub API snapshot to raise rate limits. It is not required by the public latest-release HEAD probe; absence degrades unavailable snapshot fields to `null` rather than fabricated values.

Not used by current code:

- Discord webhook secrets

No new bindings or secrets are introduced by pageview ingestion.

## 6. Reporting Model

- Reporting is on-demand only via authenticated `GET /report`.
- No outbound report delivery.
- Scheduled work is separate from report delivery. Its traffic capture, completed-day rollup, GitHub snapshot, service probes, and retention tasks are independently fail-soft.
- Legacy `/report`, `view=fleet`, and `view=site` each include one best-effort refresh capture for the previous completed UTC day before assembling the response.
- `view=ceo`, `view=tgc`, `view=source_health`, `view=asset`, and `view=monthly` intentionally skip the external refresh path and read currently persisted data directly.
- When used, the refresh reuses the same per-day capture logic as scheduled capture, remains idempotent via per-day upsert, and does not block successful report responses on capture failure.

### Semantic Layer Terminology (Canonical)

Four semantic data-layer terms are established for Lighthouse reporting vocabulary:

- `page_execution_events` — standardized first-party site events accepted via `POST /metrics/event` and stored in `site_events_raw`. Physical storage remains `site_events_raw`; this is a reporting label, not a table rename.
- `legacy_pageview` — first-party BUS Core pageview telemetry accepted via `POST /metrics/pageview` and stored in `pageview_events_raw` / aggregated in `pageview_daily`. Continues to function unchanged.
- `traffic_layer` — Cloudflare-edge-observed traffic signals derived from `buscore_traffic_daily`. Edge-observed metrics and not confirmed human usage. Applies only to sites with `cloudflare_traffic_enabled = true`.
- `intent_counters` — Lighthouse aggregate operator counters (`update_checks`, `downloads`, `errors`) stored in `metrics_daily`. Represent application-level intent signals, not site analytics.

These terms must be kept distinct in all reporting surfaces. They must not be blended, bridged, or used interchangeably.

### Report Contract Stability

- `GET /report` is an operator-facing contract, not an ad-hoc analytics surface.
- Bare `/report` preserves the shipped legacy response shape: `today`, `yesterday`, `last_7_days`, `month_to_date`, `trends`, `traffic`, `human_traffic`, `identity`, and additive `site_events` (nullable unless `site_key` is provided).
- Bare `/report` additionally exposes `legacy_pageview` (same data as `human_traffic`; semantic alias identifying the BUS Core `/metrics/pageview` telemetry layer) and `intent_counters` (groups `today`, `yesterday`, `last_7_days`, `month_to_date` counter windows under a single semantic label for the Lighthouse intent-counter layer).
- `legacy_pageview` and `human_traffic` in bare `/report` are the same object; `human_traffic` is retained for backward compatibility and `legacy_pageview` is the canonical semantic name.
- `intent_counters.today`, `intent_counters.yesterday`, `intent_counters.last_7_days`, and `intent_counters.month_to_date` reference the same objects as the top-level `today`, `yesterday`, `last_7_days`, and `month_to_date` fields; those top-level fields are retained for backward compatibility.
- Additional shipped view modes are `view=fleet`, `view=site`, and `view=source_health`.
- Current shipped `trends` fields include: `downloads_change_percent`, `update_checks_change_percent`, `weekly_downloads_change_percent`, `weekly_update_checks_change_percent`, `conversion_ratio`.
- `conversion_ratio` is defined as today downloads divided by today update checks (with safe zero-denominator handling).
- `traffic.latest_day` contains the most recent completed UTC day stored in `buscore_traffic_daily` with fields `day`, `visits`, `requests`, `captured_at`.
- `traffic.last_7_days` contains aggregate traffic fields `visits`, `requests`, `avg_daily_visits`, `avg_daily_requests`, and `days_with_data` across stored rows in the last seven UTC days.
- Existing `traffic` remains the Cloudflare-derived traffic summary and its semantics are unchanged by pageview ingestion.
- `human_traffic` is additive only and represents JS-fired first-party pageview telemetry, not verified-human analytics.
- `human_traffic.today` contains `pageviews` and `last_received_at` for the current UTC day.
- `human_traffic.last_7_days` contains accepted `pageviews`, `days_with_data`, `top_paths`, `top_referrers`, and `top_sources` across the current UTC day plus the previous six UTC days.
- `human_traffic.last_7_days.top_paths` entries use `{ path, pageviews }`.
- `human_traffic.last_7_days.top_referrers` entries use `{ referrer_domain, pageviews }`.
- `human_traffic.last_7_days.top_sources` entries use `{ source, pageviews }` with deterministic precedence `src -> utm.source -> (direct)`.
- `human_traffic.observability` is cumulative across stored pageview aggregate rows and contains `accepted`, `dropped_rate_limited`, `dropped_invalid`, and `last_received_at`.
- `identity` is additive only and summarizes anonymous continuity from accepted rows with non-null identity/session fields when present.
- `identity.today` contains `new_users`, `returning_users`, and `sessions` for the current UTC day.
- `identity.last_7_days` contains `new_users`, `returning_users`, `sessions`, and `return_rate` across the current UTC day plus previous six UTC days.
- `identity.top_sources_by_returning_users` contains ranked `{ source, users }` using precedence `src -> utm.source -> (direct)`.
- `identity.last_7_days.return_rate` is defined as `returning_users / distinct_users` where `distinct_users` means distinct non-null `anon_user_id` values in the same 7-day window; zero denominator returns `0`.
- `site_events` is populated only when `site_key` is supplied on `GET /report`.
- `site_events.scope` echoes `site_key`, `exclude_test_mode`, and `production_only` used for the standardized-event summary.
- `site_events.totals` contains `accepted_events` and `unique_paths` for the selected site over the current UTC day plus previous six UTC days.
- `site_events.by_event_name` contains ranked `{ event_name, events }` for accepted events, with shared-name alias normalization in report assembly so equivalent shared actions are not split across multiple names.
- `site_events.top_paths` contains ranked `{ path, events }` for accepted events by path. Populated for all sites with event telemetry, including `event_only` sites.
- `site_events.top_sources` contains ranked `{ source, events }` using deterministic precedence `src -> utm.source -> referrer classification -> (direct)`.
- `site_events.top_campaigns` contains ranked `{ utm_campaign, events }` for non-empty `utm_campaign` values.
- `site_events.top_referrers` contains ranked `{ referrer_domain, events }` for non-empty referrer domains.
- `site_events.top_contents` contains ranked `{ utm_content, events }` for non-empty `utm_content` values. Useful for ad and creative-variant evaluation.
- `site_events.observability` exposes `included_events`, `excluded_test_mode`, `excluded_non_production_host`, `dropped_rate_limited`, `dropped_invalid`, and `last_received_at`.
- `site_events.production_only` filtering is host-based against the selected tracked site `production_hosts` and is operator-controllable through the `production_only` query flag.
- `view=fleet` returns one entry per tracked site with fields `site_key`, `label`, `status`, `backend_source`, `cloudflare_traffic_enabled`, `production_hosts`, `last_received_at`, `accepted_events_7d`, `pageviews_7d`, `traffic_requests_7d`, `traffic_visits_7d`, and `has_recent_signal`.
- `view=site` returns top-level sections `scope`, `summary`, `traffic_layer`, `traffic`, `page_execution_events`, `events`, `legacy_pageview`, `identity`, and `health` for the selected site.
- `view=site.traffic_layer` is a metadata section with fields `source` (`"cloudflare_edge"`), `semantics` (`"edge_observed_not_confirmed_human"`), and `enabled` (boolean matching the site's `cloudflare_traffic_enabled` flag). It is always present and identifies whether and how the Cloudflare traffic layer applies; `enabled: false` means traffic values remain `null` by design and are not faked.
- `view=site.page_execution_events` contains the standardized first-party event summary from `site_events_raw`: `accepted_events`, `unique_paths`, `by_event_name`, `top_paths`, `top_sources`, `top_campaigns`, `top_referrers`, and `top_contents` for the selected site over the 7-day window. This is the canonical semantic name for the standardized event layer.
- `view=site.events` is a compatibility alias for `view=site.page_execution_events`; both fields carry identical data. `events` is retained for backward compatibility; `page_execution_events` is the canonical name.
- `view=site.legacy_pageview` is populated only for sites with legacy pageview support (currently BUS Core `legacy_hybrid`) and contains `pageviews_7d`, `days_with_data`, and `last_received_at` derived from `pageview_daily`. Returns `null` for all other sites. This field is absent from the physical storage; it is computed from the existing `pageview_daily` queries.
- All breakdown arrays in `page_execution_events` / `events` are populated for any site with event telemetry (`event_only` included); empty arrays are valid when no matching attribution data is present for a breakdown dimension.
- `view=site.scope.support_class` exposes the deterministic normalization support class for the selected site.
- `view=site.scope.section_availability` exposes deterministic section support flags by support class.
- `view=site.identity` is populated only for support classes with identity support (currently `legacy_hybrid` via BUS Core pageview continuity) and returns `null` for event-only support classes.
- `view=site.operator_summary` is populated only for BUS Core. It uses the current UTC day plus previous six UTC days and contains aggregate-only sections: `lead_attribution`, `source_to_lead`, `source_to_intent`, `conversion_summary`, `telemetry_health`, and `operator_note`. Lead attribution is read from `BUSCORE_LEADS_DB` when configured; if unavailable, lead fields report `not available` rather than synthetic zeroes.
- `operator_summary.lead_attribution` reports the 7-day aggregate lead attribution status. It distinguishes `unavailable`, `no_leads`, `no_attributed_leads`, and `available`; includes `leads_7d_total`, `leads_7d_attributed`, `leads_7d_unknown`, `top_sources`, `top_campaigns`, and `attribution_window_days`; and uses safe non-PII error reasons such as `binding_not_configured` or `query_failed` when unavailable. `No leads recorded yet.` means the binding is available but no leads exist in the window. `Leads recorded, but no attributed leads yet.` means leads exist but `src`, `utm_source`, and `referrer_domain` are all empty for the window.
- `operator_summary.source_to_lead` reports top sources by early-access leads, top campaigns by early-access leads, and direct/unknown lead count. `operator_summary.source_to_intent` reports top sources for BUS Core extension-layer events `download_click`, `early_access_submit_success`, `github_click`, `discord_click`, `support_click`, and `docs_click` when present.
- `operator_summary.conversion_summary` reports page views by source, counted intent by source, leads by source, and simple lead conversion percentages only where the pageview denominator is available. `operator_summary.telemetry_health` reports last received standardized event timestamp, accepted events in the window, persisted rate-limited drops, and a warning when no recent signal exists.
- `operator_summary` does not expose PII or persistent identifiers. It must not include lead emails, `bc_uid`, `bc_sid`, `anon_user_id`, `session_id`, raw IPs, hashed IPs, user-agent hashes, or raw event dumps.
- `view=source_health` returns one entry per tracked site with fields `site_key`, `label`, `backend_source`, `cloudflare_traffic_enabled`, `production_only_default`, `last_received_at`, `accepted_signal_7d`, `dropped_invalid`, and `dropped_rate_limited`.
- `backend_source` is deterministic and reflects the current persisted reporting surfaces actually used by Lighthouse for that site, joined with `+` from this set: `pageview_daily`, `site_events_raw`, `buscore_traffic_daily`.
- All `*_7d` metrics use the current UTC day plus the previous six UTC days.
- In `view=fleet`, `view=site`, and `view=source_health`, `last_received_at` means the latest accepted telemetry `received_at` currently included for that site across the reporting surfaces used by that view. BUS Core considers both legacy pageview telemetry and standardized site events; other sites consider standardized site events only.
- `has_recent_signal` is `true` when the selected site has at least one accepted supported signal in the current 7-day UTC window. BUS Core supported signals are accepted legacy pageviews plus accepted standardized site events. Other sites use accepted standardized site events only.
- `accepted_signal_7d` in `view=source_health` is the same supported-signal count used for `has_recent_signal`, but returned as a numeric total.
- `pageviews_7d` is supported only for BUS Core legacy pageview telemetry and returns `null` for other tracked sites.
- Site-scoped traffic metrics (`traffic_requests_7d`, `traffic_visits_7d`, `traffic.latest_day`, `traffic.last_7_days`) are supported only for sites whose tracked-site registry entry has `cloudflare_traffic_enabled = true`; otherwise Lighthouse returns the availability flag with `null` traffic metrics.
- `health.last_received_at` in `view=site` follows the same cross-source meaning as `summary.last_received_at`.
- `health.included_events`, `health.excluded_test_mode`, and `health.excluded_non_production_host` in `view=site` are derived from the standardized-event filter scope for that site.
- `health.included_events` is the count of events that pass all active filter conditions (`accepted = 1`, `test_mode` filter, and production-host filter when `production_only` is active) over the same 7-day window used for `events.accepted_events`. These two fields are computed from the same filter predicate and must be equal. A mismatch between them indicates a querying defect.
- `dropped_rate_limited` in `view=site` and `view=source_health` sums persisted rate-limited drops from all supported reporting surfaces for that site.
- `dropped_invalid` in `view=site` and `view=source_health` is supported only where Lighthouse persists invalid-drop counters. Today that means BUS Core legacy pageview telemetry only. Standardized-event invalid submissions are not persisted, so non-BUS Core sites return `null` for `dropped_invalid`.
- Existing non-traffic `/report` fields remain intact and semantically unchanged.
- If a requested traffic window has no stored traffic rows, its traffic fields return `NULL` rather than synthetic zeroes.
- If a requested field is unsupported for a site or reporting surface, Lighthouse returns `null` rather than a synthetic zero.
- `avg_daily_visits` and `avg_daily_requests` are computed using `days_with_data` (stored rows in the 7-day window) as the divisor; Lighthouse does not divide by seven unless seven rows exist.
- `traffic.requests` comes from daily request `count` on `httpRequestsAdaptiveGroups` in the Cloudflare GraphQL Analytics API.
- `traffic.visits` is populated from `sum.visits` when provided by the same single-query path and remains nullable when absent.
- Changes to `/report` response fields or semantics require explicit SOT update and changelog entry in the same change set.

### Fleet Normalization Standard

- `TRACKED_SITES` is the canonical property registry for tracked public properties.
- `POST /metrics/event` is the canonical fleet telemetry path.
- `POST /metrics/pageview` remains supported only as a documented BUS Core legacy path.
- `dev_mode` is the canonical cross-site developer/operator telemetry suppression contract.
- Shared report field names and shared payload field names must keep one documented meaning across views where applicable.
- Normalization must not manufacture parity: unsupported sections/metrics stay `null` or are omitted by documented rule.
- Cloudflare traffic, standardized first-party events, and BUS Core legacy pageviews remain distinct telemetry layers and must not be treated as equivalent sources.

### Support Class Taxonomy (Canonical Operator Vocabulary)

Each tracked site is classified as exactly one of:
- `legacy_hybrid`
- `event_only`
- `event_plus_cf_traffic`
- `not_yet_normalized`

Support class definitions:
- `legacy_hybrid`:
  legacy plus richer telemetry/reporting surfaces; may expose traffic, events, and identity-style sections where supported. BUS Core is the explicit grandfathered legacy-hybrid property and keeps its richer surface without parity-forcing other sites.
- `event_only`:
  first-party event telemetry only; no fake traffic richness; identity remains `null` unless a real supported layer is added.
- `event_plus_cf_traffic`:
  first-party event telemetry plus Cloudflare traffic layer.
- `not_yet_normalized`:
  registered or partially tracked, but not yet brought onto the standard.

Current classification:
- `buscore`: `legacy_hybrid`
- `star_map_generator`: `event_only`
- `tgc_site`: `event_only`

### Capability Layers (Canonical Operator Vocabulary)

Capability layers are the operator language for what a site actually has:
- Layer 1 - Registry layer:
  site_key, hosts, allowed origins, reporting registration.
- Layer 2 - Event layer:
  first-party Lighthouse events such as `page_view`, `outbound_click`, `contact_click`, `service_interest`.
- Layer 3 - Traffic layer:
  Cloudflare-style traffic/request/visit surfaces.
- Layer 4 - Identity layer:
  session/user identity-style reporting where actually supported.
- Layer 5 - Extension layer:
  site-specific events beyond the shared taxonomy.

Current site capability matrix:

| Site | support_class | Layer 1 Registry | Layer 2 Event | Layer 3 Traffic | Layer 4 Identity | Layer 5 Extension | Notes |
|---|---|---|---|---|---|---|---|
| BUS Core (`buscore`) | `legacy_hybrid` | Yes | Yes | Yes | Yes | Not active by default | Intentionally richer; do not force false parity onto other sites. |
| Star Map Generator (`star_map_generator`) | `event_only` | Yes | Yes | No | No | Yes | Keep event-only posture unless an explicit supported layer change is requested. |
| True Good Craft (`tgc_site`) | `event_only` | Yes | Yes | No | No | Yes | Active bounded commercial-interest, form-outcome, and sanitized-reliability extensions; no identity layer. |

Operator language rule:
- Future telemetry requests and handoffs must be written using support classes and capability layers.
- Replace vague phrasing like "make it like Buscore", "make telemetry richer", or "make all site reports the same".
- Use explicit requests such as:
  - "Add a traffic layer to TGC"
  - "Add an extension layer to Star Map"
  - "Keep Star Map event_only"
  - "Add shared outbound_click coverage to Buscore"
  - "Do not add identity to this site"

### Canonical Normalized Per-Site Report Contract

Per-site normalized reporting logically targets these sections where supported:
- Summary
- Today
- Traffic
- Human Traffic / Events
- Observability
- Identity
- Read

Rules:
- Unsupported sections must remain `null` or omitted by documented rule.
- Section meanings must not drift by site.
- Fleet summaries must remain comparable without pretending unsupported metrics exist.

### Shared Field Meaning Freeze

Shared field semantics:
- `accepted_signal_7d`: accepted supported telemetry signal count for current UTC day plus previous six days.
- `accepted_events_7d`: accepted standardized events only (never includes legacy pageviews).
- `has_recent_signal`: boolean equivalent of `accepted_signal_7d > 0`.
- `last_received_at`: latest accepted telemetry `received_at` included for the site in that view.
- `cloudflare_traffic_enabled`: tracked-site capability flag, not a count metric.

Rules:
- If a field is only valid in one view or section, that scope must be explicitly documented.
- Meanings must not drift between fleet/site/source-health outputs.

### Shared Event Naming Rule

- Runtime keeps permissive ingest compatibility and accepts any non-empty `event_name` on `POST /metrics/event`.
- Fleet shared comparable event names are frozen to: `page_view`, `outbound_click`, `contact_click`, `service_interest`.
- Report normalization aliases equivalent shared names to the canonical shared names (for example `pageview -> page_view`, `link_click -> outbound_click`) so shared-action reporting semantics stay stable without breaking live ingest compatibility.
- Shared taxonomy is for comparable cross-site actions.
- Site-specific event names remain allowed as legitimate extension-layer events and are treated as site-scoped/non-comparable unless explicitly mapped into the shared catalog.
- Event names outside the shared taxonomy are either legitimate site-specific extensions or drift that should be cleaned up.

## 7. Privacy and Security

- Aggregate-first storage in D1 with narrow raw pageview retention for about 30 UTC days.
- Lighthouse does not introduce account-linked identity, cookies, browser fingerprinting, or cross-device identity reconstruction.
- First-party pageview ingestion stores hashed IP and hashed user-agent values only when present and does not store raw IPs.
- Anonymous continuity values are first-party random UUID-like values and remain independent from `ip_hash` and `user_agent_hash`.
- Lighthouse must not combine `anon_user_id` with `ip_hash` or `user_agent_hash` into synthetic identity.
- Traffic capture uses Cloudflare aggregate analytics only; no raw request logging is introduced outside the documented narrow pageview ingestion path.
- `GET /report` accepts an exact `X-Report-Token` match to an optional 32-to-128-character URL-safe-ASCII `env.REPORT_READ_TOKEN`, or the backward-compatible exact non-empty `X-Admin-Token` match to `env.ADMIN_TOKEN`, only while the two configured secrets do not collide.
- `ADMIN_TOKEN` remains a broad administrative credential. It protects the mutating `POST /campaign`, `POST /notes`, and `POST /report/snapshot` routes and remains accepted for report reads. `REPORT_READ_TOKEN` is GET-report-only and is never valid for those writes. Authorization to read a report does not imply authorization to call a write.
- `X-Report-Token` is not added to browser CORS allow-headers. Version 1.30.0 does not create a browser-readable report surface.

## 8. Explicit Non-Features

- No `/health` route in current code.
- Star Map Generator launch registration is tracked via the tracked-site registry (`production_hosts` and `allowed_origins`) and must remain registry-configurable.
- No scheduled outbound reporting.
- No Discord webhook integration.
- No automatic push reporting.
- No broad analytics warehousing.
- No retries, unload-trigger analytics, account identity semantics, or fingerprinting behavior for pageview ingestion.
