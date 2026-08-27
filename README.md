# buscore-lighthouse

## 1.29.4 release-control reconciliation

Repository version 1.29.4 records the verified 1.29.3 production promotion and repairs repository-controlled release authority. Active production is Worker version `ba611ac1-653d-47a2-a465-a85f4124b6b6`, promoted from merged `main` commit `59231d09084d0fa4db71012b6f29550886c5b605` by Cloudflare build `793715ef-6123-4d98-a4a7-797634d07812`. The canonical production hostname is `lighthouse.buscore.ca`, attached as a Production Custom Domain rather than a Worker Route. The additional public `workers.dev` surface and branch/version previews are not canonical diagnostic endpoints. The cron remains `5 0 * * *`; CEO report and metric-definition contract remain `1.1`.

The repository now pins the verified Cloudflare account, uses the primary D1 control-plane name `lighthouse` without changing its database ID, provides explicit version-upload, status, and history commands, and deliberately provides no direct production-deploy script. The checked-in production workflow is manual-only, main-only, serialized, fully validated, strict, variable-preserving, and receipted. No Worker runtime contract, endpoint, auth, schema, retention, schedule, metric, secret, or active deployment changes in this local bundle.

> **External release-control verification — 2026-08-26:** the Cloudflare Workers Builds production Deploy command was changed from `npx wrangler deploy` to exactly `npx wrangler versions upload`. Durable readback after reload confirmed that both Deploy and Version commands match. No build, upload, or deployment action was invoked. Git publication can still create version and preview state, but active production promotion is reserved for the checked-in manual workflow.

## 1.29.3 operations documentation release

Repository version 1.29.3 adds the canonical operations and diagnostics runbook and a narrow owner-approved documentation-only governance path. It changes no Worker code, route, contract, auth, binding, storage, retention, schedule, integration, migration, secret, or deployment behavior. The last production deployment recorded in repository history is Lighthouse 1.29.2 (`f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`) with CEO report and metric-definition contract `1.1`; active-production state was not independently control-plane verified during this documentation release. This release does not authorize or require an active-production promotion. Publishing the review branch did cause the separately connected Cloudflare Workers Builds integration to upload a version that its check classified as a preview and for which it reported version/branch preview URLs, as recorded in `CHANGELOG.md` and `OPERATIONS.md`.

## Operations and diagnostics

Use [`OPERATIONS.md`](OPERATIONS.md) as the canonical runbook for Lighthouse alerts, analytics diagnosis, endpoint selection, credential boundaries, and request side effects. Read it after `SOT.md` and before contacting production or Cloudflare. `PHASE2_ANALYTICS_NOTES.md` and `PHASE3_ANALYTICS_NOTES.md` are historical implementation records, not current runbooks.

## 1.29.2 service-probe truth repair

Version 1.29.2 keeps the non-persisting lead liveness check on GET but recognizes `405 Method Not Allowed` as a healthy method boundary even when the endpoint omits `Allow`. GitHub release liveness uses the public latest-release page rather than the quota-limited unauthenticated REST API and validates same-repository release-tag redirects. CEO contract `1.1`, stored metrics, report windows, ingestion, auth, retention, and cron cadence are unchanged; no migration or secret change was required. It is deployed as Cloudflare Worker version `f07d4af2-a8d6-4df6-adfa-aad7eb9f578d`.

## 1.29.1 trust/privacy conformance

Version 1.29.1 keeps scheduled/public metadata `HEAD` probe failures out of the general Lighthouse error counter while genuine manifest `GET` failures remain counted; service-probe records remain authoritative and raw/HEAD artifact accounting is unchanged. CEO contract and metric-definition version `1.1` require a canonical Lighthouse artifact URL for possible download interest and start that trusted metric on `2026-08-10`; earlier intent rows are excluded rather than relabeled. Available sparse sources report partial—not full—coverage, and unavailable source-dependent detail is `null` instead of a plausible empty array. For `tgc_site`, Lighthouse stores only coarse `small`/`medium`/`large` viewport buckets and event-specific sanitized values. It does not change the D1 schema and requires no migration.

Worker 1.29.1 was deployed on `2026-08-09T16:41:20.004814Z` as Cloudflare Version ID `ee320e1a-9ceb-4d88-a848-fd7ae0e9e3bc` after the full gate and a no-pending-migration check. The prior 1.29.0 deployment was Cloudflare Version ID `757c24b7-fa98-40a5-8ea0-0e551d69c64f`.

## CEO decision report

Version 1.28.0 introduced authenticated `GET /report?view=ceo`; contract 1.0 was deployed with Worker 1.29.0, and strict contract and metric-definition version 1.1 are deployed with Worker 1.29.1. It reports exact UTC windows, source availability/freshness/coverage, literal BUS Core discovery/distribution/product/reliability facts, consented TGC page views, and voluntary inquiry aggregates. Query failures are `null` and unavailable, never zero; a successful source with no observation history is explicitly `unknown`, not believable fresh zero. The contract and aggregate-only fixtures live in `contracts/ceo-v1/`.

The CEO lane changes no existing report view or database table. It uses the current UTC day only for explicit partial activity, uses completed UTC days for daily and weekly decisions, and never calls artifact responses or daily source credits people, installations, completed downloads, or adoption. Agent Smith owns the final status and wording.

## BUS Core minimal product telemetry

Worker 1.29.0 introduced the retained 1.27.0 exact event-ID acknowledgement contract with bounded deduplication and aggregate-only product reporting; verified active Worker 1.29.3 retains that behavior. Current BUS Core product events contain no persistent installation identifier and are limited to first launch, locally deduplicated release/first-success milestones, startup/manual update checks, staged updates, and reliability. Module opens, active days, returning-installation measures, engagement, sessions, retention, and cross-day profiles are prohibited.

Migration `0015_minimize_buscore_product_telemetry.sql` was applied before the 2026-07-24 Worker deployment. Product telemetry retains event-ID deduplication keys for 30 UTC-day buckets, aggregate counters for 400 UTC-day buckets, and rate-control buckets for two days. It retains no raw product-event history.

## TGC website analytics

Worker 1.29.0 introduced the narrowed consented `site_key=tgc_site` lane; verified active Worker 1.29.3 retains it. Lighthouse is the raw-event and aggregate-report source of truth; the protected operator view remains `GET /report?view=tgc` using the existing `X-Admin-Token` contract.

The server accepts page views, selected commercial/contact/outbound interest, form start/attempt/outcome, and sanitized errors. Version 1.29.1 accepts a producer-supplied coarse viewport label or, for rolling compatibility, exact lowercase `WIDTHxHEIGHT`; exact dimensions are immediately normalized by width to `small` below 768, `medium` from 768 through 1199, or `large` from 1200 upward, and only that bucket is stored. Event-specific value sanitization turns recognized form, error, and outbound values into bounded categories, unrecognized non-empty values into `other`, and discards absent/blank values or values on the remaining TGC events. Lighthouse discards visitor/session fields and rejects the superseded lifecycle, field-level form, scroll/engagement/section, and first-party web-vital event families. The existing TGC report shape remains available for rollback and historical rows; Smith's CEO lane uses page views and voluntary inquiries only. Raw TGC events are retained for 90 days; other standardized-site raw events retain the general 30-day policy, and rotating keyed rate identifiers are retained for two days. See `TGC_SITE_ANALYTICS_POLICY.md` for the current boundaries.

## Production release control

`.github/workflows/governance.yml` validates every pull request and `main` push but does not deploy. `.github/workflows/deploy.yml` is the sole repository-authorized production-promotion path following the verified 2026-08-26 external release-control repair: it is manual-dispatch only, rejects non-`main` refs, serializes deployments under `lighthouse-production`, runs `npm ci`, typechecking, and the full test suite, deploys with `wrangler deploy --keep-vars --strict`, and then attempts `wrangler deployments status --json` whenever the deploy step ran, including an uncertain reported failure. The workflow reads the pinned account from `wrangler.toml`; its deployment token must be verified rather than inferred from workflow text.

Cloudflare Workers Builds is a separate external publication path. The initial 2026-08-26 audit found non-production branches using `npx wrangler versions upload` with previews enabled while production branch `main` still used `npx wrangler deploy` without a validation build command. Later that day, the production Deploy command was changed to `npx wrangler versions upload`; durable readback after reload confirmed that both Deploy and Version commands are exactly `npx wrangler versions upload`. No build, upload, or deployment action was invoked. Git publication can still create Worker versions and previews, but it must not promote active traffic. Migrations remain separate and are never implied by an upload or deployment.

## BUS Core artifact traffic truth

BUS Core artifact delivery and demand semantics are defined in `BUS_CORE_TRAFFIC_TRUTH.md`. Version 1.25.0 keeps downloads public while separating raw Worker traffic, successful artifact responses, privacy-preserving daily client-network buckets, probable-human intent proxies, confirmed product telemetry, and leads. Migration `0014_add_artifact_traffic_truth.sql` was applied remotely before the 2026-07-18 v1.25.0 deployment.

## BUS Core transition direction

Lighthouse currently serves release data, accepts public-site analytics events, and produces deterministic reports. Migrations 0013 and 0015 plus the current Worker lineage provide strict aggregate-only BUS Core product telemetry and qualified, rate-bounded `/update/check` and artifact-request analytics.

The contract accepts only versioned, allowlisted events and fields; rejects unexpected content; enforces retention; and excludes business content such as customer, supplier, employee, item, recipe, invoice, document, filepath, financial, quantity, raw database, and machine-fingerprint data. BUS Core must continue working normally when Lighthouse is unavailable or telemetry is disabled.

Contract artifacts:

- `contracts/buscore-product-telemetry-v1.json`
- `migrations/0013_add_buscore_product_telemetry.sql`
- `migrations/0015_minimize_buscore_product_telemetry.sql`
- `tests/product-telemetry-contract.test.mjs`

Retention is 30 UTC-day buckets for product event-ID deduplication keys, 400 UTC-day buckets for daily aggregates, and 2 days for rate-control buckets. Rate identifiers are scope-separated HMAC-SHA256 values keyed with `TELEMETRY_RATE_LIMIT_SECRET`: product telemetry rotates by UTC minute; qualified update-check and artifact-request counting use UTC-day buckets. Raw IP addresses, unsalted IP hashes, raw product-event history, and persistent BUS Core installation identifiers are never stored. Production must configure the secret; update-check and artifact-request counting fail closed without it.

Lighthouse is a single Cloudflare Worker that provides a small, deterministic, privacy-first, aggregate-first metrics primitive with one narrow first-party JS-fired pageview ingestion path.

Architectural rule:
- Lighthouse is a standalone service and operationally independent.
- It is independently runnable and not hard-dependent on BUS Core or any other external service.
- BUS Core is a current observed client/traffic source, but Lighthouse core operation must remain independent.
- Integrations must remain optional, additive, and non-blocking.

Release authority:
- Shipped Lighthouse behavior is authorized by `SOT.md`, recorded in `CHANGELOG.md`, and versioned by `package.json`.
- No behavioral, contract, storage, configuration, auth, or scheduling change is considered released unless all three are updated together in the same change set.

## Glossary

- Aggregate-first: stores daily aggregate counters as the primary reporting model and retains only a narrow, short-lived raw pageview log for inspectability.
- Operationally independent: can run and serve core routes without requiring any other service to be available.
- Observed client: an external system that calls Lighthouse (for example BUS Core) without becoming a runtime dependency.
- Core operation: manifest serving, aggregate counting, first-party pageview ingestion, and protected on-demand reporting.
- Optional integration: an additive external integration that does not block core operation when unavailable.
- Shipped behavior: behavior currently implemented and documented as present reality.
- Future direction: planned or proposed behavior not yet shipped.

## Current System

Lighthouse currently does seven things:

1. Serves the BUS Core manifest from R2.
2. Increments fixed daily aggregate counters in D1.
3. Accepts first-party site-emitted pageview events on `POST /metrics/pageview`.
4. Accepts standardized multi-site events on `POST /metrics/event`.
5. Exposes protected, on-demand aggregate reporting.
6. Pulls one daily Buscore traffic snapshot from the Cloudflare GraphQL Analytics API into D1 on a scheduled cron.
7. Accepts strict BUS Core product telemetry and exposes literal aggregate product-telemetry windows when migration 0013 is present.

For BUS Core, the authenticated site report also includes an aggregate-only `operator_summary` that combines Lighthouse counted-intent events with early-access lead attribution totals when the optional `BUSCORE_LEADS_DB` binding is configured. The CEO report uses the same optional read binding for voluntary-inquiry totals and fixed privacy-safe attribution buckets. It does not post to Discord.

It does not implement retries, unload analytics, or a broad analytics warehouse.
It exposes limited anonymous continuity and identity-style reporting only where supported (BUS Core legacy_hybrid), while `event_only` sites keep identity as `null`.

## Fleet Normalization Standard

Normalization intent:
- Preserve classic BUS Core operational discipline.
- Use tracked-site event ingestion as the fleet standard.
- Keep BUS Core legacy pageview ingestion supported, but legacy-only.
- Normalization does not mean equal telemetry richness across all sites.

Canonical rules:
1. `TRACKED_SITES` is the canonical tracked-property registry.
2. `POST /metrics/event` is the canonical fleet telemetry path.
3. `POST /metrics/pageview` is BUS Core legacy-only support.
4. `dev_mode` is the canonical cross-site suppression contract.
5. Shared event names must be standardized by documented catalog.
6. Shared report and payload field names must keep one meaning.
7. Normalization must not manufacture parity.
8. Unsupported sections/metrics must remain `null` or omitted by documented rule.

### Support Classes (Canonical)

Support class means the structural type of telemetry a site has.

Use these exact support classes:
- `legacy_hybrid`
- `event_only`
- `event_plus_cf_traffic`
- `not_yet_normalized`

Definitions:
- `legacy_hybrid`:
  legacy plus richer telemetry/reporting surfaces; may expose traffic, events, and identity-style sections where supported.
- `event_only`:
  first-party event telemetry only; no fake traffic richness; identity remains `null` unless a real supported layer is added.
- `event_plus_cf_traffic`:
  first-party event telemetry plus Cloudflare traffic layer.
- `not_yet_normalized`:
  registered or partially tracked, but not yet brought onto the standard.

Current site mapping:
- BUS Core (`buscore`): `legacy_hybrid`
- Star Map Generator (`star_map_generator`): `event_only`
- True Good Craft (`tgc_site`): `event_only`

### Capability Layers (Canonical)

Capability layers are the practical operator language for what a site actually has.

Use these exact layers:
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
| BUS Core (`buscore`) | `legacy_hybrid` | Yes | Yes | Yes | Yes | Not active by default | Intentionally richer; do not force false parity. |
| Star Map Generator (`star_map_generator`) | `event_only` | Yes | Yes | No | No | Yes | No traffic layer and no identity layer by current design. |
| True Good Craft (`tgc_site`) | `event_only` | Yes | Yes | No | No | Yes | Active bounded commercial-interest, form-outcome, and sanitized-reliability extensions; no identity layer. |

Operator request language standard:
- Future telemetry requests should be expressed with support classes and layers.
- Preferred examples:
  - "Add a traffic layer to TGC"
  - "Add an extension layer to Star Map"
  - "Keep Star Map event_only"
  - "Add shared outbound_click coverage to Buscore"
  - "Do not add identity to this site"
- Avoid vague requests:
  - "make it like Buscore"
  - "make telemetry richer"
  - "make all site reports the same"

Propagation note:
- This terminology is now canonical for Lighthouse telemetry docs and should be propagated in future telemetry documentation and handoffs.

### Shared Taxonomy Rule

Fleet shared event taxonomy remains:
- `page_view`
- `outbound_click`
- `contact_click`
- `service_interest`

Rule:
- Shared taxonomy is for comparable cross-site actions.
- Other event names are either legitimate site-specific extension-layer events or drift that should be cleaned up.

## Cross-Site Analytics Suppression Standard

All Lighthouse-integrated public sites must use one shared developer/operator analytics exclusion standard:

- The canonical suppression cookie name is `dev_mode`.
- Detection is presence-based, not value-based: if a `dev_mode` cookie is present, suppression is active for that page load.
- Suppression is site-side loader behavior. Lighthouse server routes do not perform cookie checks.
- When suppression is active, shared site telemetry loaders must suppress all analytics work for that page load:
  - Do not inject Cloudflare Web Analytics.
  - Do not emit Lighthouse pageview telemetry (`POST /metrics/pageview`).
  - Do not emit Lighthouse standardized site-event telemetry (`POST /metrics/event`).
- This developer/operator suppression standard is separate from user privacy opt-out controls (for example `localStorage.noAnalytics === "1"`).
- Because cookies do not cross registrable domains, this standard is one logical cookie contract with multiple domain-scoped cookie instances.
- Domain scoping guidance:
  - Use the highest valid shared domain for each site family.
  - Use `.buscore.ca` for BUS Core properties.
  - Use `.truegoodcraft.ca` for True Good Craft properties and subdomains, including `starmap.truegoodcraft.ca`.

Practical cookie examples:

```text
dev_mode=1; Domain=.truegoodcraft.ca; Path=/; Max-Age=31536000; SameSite=Lax; Secure
dev_mode=1; Domain=.buscore.ca; Path=/; Max-Age=31536000; SameSite=Lax; Secure
```

## Routes

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/manifest/core/stable.json` | Return manifest JSON from R2; success is uncounted, while a genuine GET miss/error increments the error counter |
| HEAD | `/manifest/core/stable.json` | Return public manifest metadata with no body; scheduled liveness uses this route and a miss/error does not increment the error counter |
| GET | `/update/check` | Always return public manifest JSON; count only strict, plausible, rate-allowed BUS Core v1.4.0+ request tuples |
| GET | `/download/latest` | Validate latest manifest download URL and return `302` redirect intent only |
| GET | `/releases/:filename` | Serve a release artifact and count at most one qualified full request per IP, release, and UTC day |
| HEAD | `/releases/:filename` | Return public release metadata with no body; record raw/HEAD truth but never a successful artifact response or daily source credit |
| POST | `/metrics/pageview` | Accept first-party JS-fired pageview JSON, always return `204`, and persist/aggregate best-effort in D1 |
| POST | `/metrics/event` | Accept standardized multi-site event JSON, always return `204`, and persist/aggregate best-effort in D1 |
| POST | `/telemetry/v1/events` | Accept one strict BUS Core schema-1.0 event, apply a keyed rotating rate control, and return `202 accepted`, `200 duplicate`, or a bounded error |
| GET | `/report` | Return protected aggregate report; legacy BUS Core output includes literal `product_telemetry` windows when migration 0013 is available |
| GET | `/report?view=ceo` | Return the protected CEO contract and metric-definition version `1.1` with exact windows and per-source availability; no legacy view is changed |

This table documents route behavior; it does not authorize production probing. Some GET and HEAD routes refresh, count, persist, or otherwise alter evidence. Consult `OPERATIONS.md` before using any route diagnostically.

Notes:
- Successful `/manifest/core/stable.json` requests are uncounted. A genuine GET miss/error increments `metrics_daily.errors`; a HEAD miss/error does not.
- `/download/latest` never increments `downloads` directly.
- `/releases/:filename` increments `downloads` only when an existing artifact receives a full `GET` with Cloudflare client IP context, the configured rate secret, a non-ignored IP, and allowance under the one-count-per-IP-per-release-per-UTC-day gate.
- Artifact delivery remains public and independent from counting. Missing-secret/IP, ignored-IP, over-limit, `Range`, and rate-storage-failure cases contribute zero analytics without blocking a valid artifact response.
- `downloads` is a qualified, rate-bounded request signal. It is not a person, installation, lifetime-unique downloader, or proof that the response body completed transfer.
- `/update/check` manifest delivery remains public. Counting requires exactly `current_version`, `channel`, and lowercase `first_check=true|false`, canonical plausible SemVer, an explicit selected manifest channel, Cloudflare client IP context, the configured rate secret, and allowance under the two-count-per-IP-per-UTC-day gate.
- Missing, duplicated, legacy-alias, header-only, extra, malformed, implausible, unserviceable-channel, ignored-IP, missing-secret/IP, and over-limit requests receive the manifest but contribute zero analytics.
- `/update/check` remains the authoritative qualified release-route request total, not proof of authentic-client origin. A product-telemetry `update_check` event is reported separately as an accepted delivery observation and is never added to or substituted for the release-route counter.
- If `IGNORED_IP` is configured and matches `CF-Connecting-IP`, counting is suppressed while normal responses are still returned.
- `POST /metrics/pageview` is unauthenticated by design, parses raw request text then JSON, and still returns `204` for malformed, invalid, or rate-limited submissions.
- Valid accepted payloads follow the deployed BUS Core site emitter contract: `type = "pageview"`; required fields `client_ts`, `path`, `url`, `referrer`, `utm` object, `device`, `viewport`, `lang`, and `tz`; optional omitted fields `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, and `is_new_user`.
- Empty-string values for `referrer`, `lang`, and `tz` are accepted and preserved as empty strings in raw storage.
- `POST /metrics/pageview` and its `OPTIONS` preflight only grant browser CORS access to `https://buscore.ca` and `https://www.buscore.ca`; Lighthouse does not use wildcard allow-origin on that route.
- The deployed site emitter contract is accepted as-is: page-load-only, beacon-first, `fetch(..., { keepalive: true })` fallback, no retries, and no session logic.
- `POST /metrics/event` is site-aware through the tracked-site registry in `src/index.ts`: each site entry defines `site_key`, `production_hosts`, `allowed_origins`, `staging_hosts`, and `production_only_default`.
- Standardized-event rows store `ip_hash`, `user_agent_hash`, and `request_id` as `null`. When a client IP and `TELEMETRY_RATE_LIMIT_SECRET` are available, a purpose-scoped keyed HMAC identifier rotates each minute and exists only in the two-day `site_event_rate_limit` abuse-control table.

## Report Response

### CEO V1.1

`GET /report?view=ceo` is the preferred decision-report input. Its strict schema is `contracts/ceo-v1/report.schema.json`. The window keys are `today`, `latest_complete_day`, `last_7_complete_days`, `previous_7_complete_days`, and `last_30_complete_days`. Every metric carries those same keys and is either a finite aggregate or `null` when its source is unavailable.

Source state distinguishes `available` from `unavailable`, `fresh` from `stale` or `unknown`, and `full`, `partial`, or `unavailable` coverage. The contract retains `full` for a future source with explicit completeness proof. Current sparse event/counter sources do not prove that every day in a decision window was observable, so available current windows remain partial; they do not claim full coverage from a recent watermark alone. Trusted artifact-click interest begins on `2026-08-10`: earlier intent rows are excluded from sums and the watermark, wholly earlier windows are `null`, and spanning or later windows contain partial totals from the boundary forward. The `buscore_site` source definition reflects that boundary and the limitations explicitly state that pre-definition history is excluded. A successful aggregate query can return numeric zero, but without an all-history watermark its source is `unknown` with `source_history_missing`; an old watermark is `stale` with `source_data_stale`. When a source is unavailable, dependent inquiry-attribution, product-version/failure, or service-probe detail is `null`, not an empty list. Voluntary-inquiry attribution uses only 14 fixed privacy-safe buckets and never emits a raw label. The endpoint is independently guarded per source, aggregate-only, admin-token protected, and contains no PII or persistent identifiers. Its configured-leads path uses nine D1 statements in batches of at most three; client-supplied app versions are SQL-ranked and limited to ten before reaching Worker memory. Strict Ajv 2020 tests validate all fixtures plus representative live producer outputs. Existing views remain available for diagnostics and rollback.

The current protected report families are bare legacy `/report`, `view=fleet`, `view=site`, `view=tgc`, `view=source_health`, `view=asset`, `view=monthly`, and `view=ceo`. `view=site` requires a registered `site_key`; the specialized views retain their existing required parameters and response contracts. Explicit `view=legacy` is invalid; omit `view` for the legacy contract.

### Legacy

Bare `GET /report` preserves the legacy operator contract and returns:

```json
{
  "today": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "yesterday": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "last_7_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "last_30_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "month_to_date": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "trends": {
    "downloads_change_percent": 0,
    "update_checks_change_percent": 0,
    "weekly_downloads_change_percent": 0,
    "weekly_update_checks_change_percent": 0,
    "conversion_ratio": 0
  },
  "traffic": {
    "latest_day": {
      "day": "2026-03-22",
      "visits": null,
      "requests": 0,
      "captured_at": "2026-03-23T00:05:02.123Z"
    },
    "last_7_days": {
      "visits": null,
      "requests": 0,
      "avg_daily_visits": null,
      "avg_daily_requests": 0,
      "days_with_data": 1
    }
  },
  "human_traffic": {
    "today": {
      "pageviews": 0,
      "last_received_at": null
    },
    "last_7_days": {
      "pageviews": 0,
      "days_with_data": 0,
      "top_paths": [],
      "top_referrers": [],
      "top_sources": []
    },
    "observability": {
      "accepted": 0,
      "dropped_rate_limited": 0,
      "dropped_invalid": 0,
      "last_received_at": null
    }
  },
  "legacy_pageview": "<same object as human_traffic — semantic alias for BUS Core /metrics/pageview layer>",
  "intent_counters": {
    "today": { "update_checks": 0, "downloads": 0, "errors": 0 },
    "yesterday": { "update_checks": 0, "downloads": 0, "errors": 0 },
    "last_7_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
    "last_30_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
    "month_to_date": { "update_checks": 0, "downloads": 0, "errors": 0 }
  },
  "release_signals": {
    "today": {
      "artifact_downloads": 0,
      "artifact_downloads_by_release": [],
      "raw_update_checks": 0,
      "breakdown_update_checks": 0,
      "raw_breakdown_delta": 0,
      "update_checks": 0,
      "update_checks_with_known_client_version": 0,
      "update_checks_unknown_client_version": 0,
      "update_available_impressions": 0,
      "latest_version_checkins": 0,
      "first_seen_checkins": 0,
      "repeat_checkins": 0,
      "unknown_first_checkins": 0,
      "first_seen_share": 0
    },
    "last_7_days": {
      "artifact_downloads": 0,
      "artifact_downloads_by_release": [],
      "raw_update_checks": 0,
      "breakdown_update_checks": 0,
      "raw_breakdown_delta": 0,
      "update_checks": 0,
      "update_checks_with_known_client_version": 0,
      "update_checks_unknown_client_version": 0,
      "update_available_impressions": 0,
      "latest_version_checkins": 0,
      "first_seen_checkins": 0,
      "repeat_checkins": 0,
      "unknown_first_checkins": 0,
      "first_seen_share": 0
    },
    "last_30_days": {
      "artifact_downloads": 0,
      "artifact_downloads_by_release": [],
      "raw_update_checks": 0,
      "breakdown_update_checks": 0,
      "raw_breakdown_delta": 0,
      "update_checks": 0,
      "update_checks_with_known_client_version": 0,
      "update_checks_unknown_client_version": 0,
      "update_available_impressions": 0,
      "latest_version_checkins": 0,
      "first_seen_checkins": 0,
      "repeat_checkins": 0,
      "unknown_first_checkins": 0,
      "first_seen_share": 0
    }
  },
  "identity": {
    "today": {
      "new_users": 0,
      "returning_users": 0,
      "sessions": 0
    },
    "last_7_days": {
      "new_users": 0,
      "returning_users": 0,
      "sessions": 0,
      "return_rate": 0
    },
    "top_sources_by_returning_users": []
  }
}
```

Contract note:
- `/report` is treated as an operator contract.
- Field additions/removals or semantic changes must be deliberate and documented in SOT/changelog, not ad-hoc.
- Existing top-level fields `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends` remain intact. Additive `last_30_days` extends the same intent-counter model.
- Existing top-level `traffic` remains the Cloudflare-derived traffic summary and is not renamed or reinterpreted by pageview ingestion.
- Additive top-level `human_traffic` is JS-fired first-party pageview telemetry, not verified-human analytics. `legacy_pageview` is a semantic alias for the same object (BUS Core `legacy_pageview` layer).
- Additive top-level `intent_counters` groups the same `today`, `yesterday`, `last_7_days`, `last_30_days`, and `month_to_date` counter windows under a single semantic label for the Lighthouse intent-counter layer (`update_checks`, `downloads`, `errors`). The individual top-level fields remain for backward compatibility.
- Additive top-level `release_signals` reports observable release signals only: qualified rate-bounded artifact requests, qualified rate-bounded update-check totals, versioned-breakdown totals and deltas, historical known/unknown-version checks, first/repeat/unknown check-in buckets, update-available impressions, and latest-version check-ins. `update_checks` remains a compatibility alias for the breakdown total; decision consumers use `raw_update_checks` and must not interpret either signal as authenticated-client proof. Lighthouse does not claim installs or completed transfers.
- Bare `/report`, `view=fleet`, and `view=site` each perform one best-effort refresh capture for the previous completed UTC day before assembly.
- `view=ceo`, `view=tgc`, `view=source_health`, `view=asset`, and `view=monthly` intentionally skip the refresh path and read currently persisted data directly.
- The refresh reuses the same traffic capture logic as the scheduled path and does not replace cron-based capture.
- If a refresh fails, `/report` still returns successfully with traffic fields based only on currently stored data.
- `traffic.latest_day` is the most recent completed UTC day snapshot stored in D1 and includes `captured_at`.
- `traffic.last_7_days` aggregates stored traffic rows within the last seven UTC days and includes `days_with_data`, `avg_daily_visits`, and `avg_daily_requests`.
- `human_traffic.today` reports accepted JS-fired pageviews for the current UTC day and the latest observed `received_at` value for that day.
- `human_traffic.last_7_days.top_paths` entries use `{ path, pageviews }`.
- `human_traffic.last_7_days.top_referrers` entries use `{ referrer_domain, pageviews }`.
- `human_traffic.last_7_days.top_sources` entries use `{ source, pageviews }` with precedence `src -> utm.source -> (direct)`.
- `human_traffic.observability` is cumulative across stored pageview aggregate rows and reports accepted, dropped-rate-limited, dropped-invalid, and the latest observed `received_at`.
- Additive top-level `identity` summarizes anonymous continuity using accepted pageviews only.
- Additive top-level `site_events` is populated only when `site_key` is provided on `/report`.
- `/report` supports standardized-event scope flags: `site_key` (required for site events), `exclude_test_mode` (default `true`), and `production_only` (default from tracked-site `production_only_default`).
- Lighthouse applies `production_only` defaults per site declaration. BUS Core remains a grandfathered legacy-hybrid exception with its current default preserved (`production_only_default: false`), while Star Map and TGC remain `true`.
- Unknown `site_key` on `/report` returns `400` with `{"ok":false,"error":"invalid_site_key"}`.
- `identity.last_7_days.return_rate` is `returning_users / distinct_users` over non-null `anon_user_id` values in the same 7-day window.
- If a traffic window has no stored data, its traffic fields return `null` instead of synthetic zeroes.
- If a requested field is unsupported for the selected site or reporting surface, Lighthouse returns `null` instead of a synthetic zero.
- Average daily traffic values divide by `days_with_data` (rows that exist), not blindly by 7.
- `requests` come from daily request `count` on Cloudflare `httpRequestsAdaptiveGroups`.
- `visits` come from `sum.visits` on the same single-query path when provided, and remain nullable when absent.

Additional authenticated view modes:

- `GET /report?view=fleet`

```json
{
  "view": "fleet",
  "generated_at": "2026-04-08T12:00:00.000Z",
  "sites": [
    {
      "site_key": "buscore",
      "label": "BUS Core",
      "status": "active",
      "backend_source": "pageview_daily+site_events_raw+buscore_traffic_daily",
      "cloudflare_traffic_enabled": true,
      "production_hosts": ["buscore.ca", "www.buscore.ca"],
      "last_received_at": "2026-04-08T11:00:00.000Z",
      "accepted_events_7d": 12,
      "pageviews_7d": 34,
      "traffic_requests_7d": 5678,
      "traffic_visits_7d": 1234,
      "has_recent_signal": true
    }
  ]
}
```

- `GET /report?view=site&site_key=<site_key>`
- BUS Core `view=site` includes additive `operator_summary` for source-to-lead, source-to-intent, conversion, telemetry health, and operator-note aggregates over the 7-day report window.

```json
{
  "view": "site",
  "generated_at": "2026-04-08T12:00:00.000Z",
  "scope": {
    "site_key": "star_map_generator",
    "label": "Star Map Generator",
    "status": "active",
    "backend_source": "site_events_raw",
    "window": {
      "start_day": "2026-04-02",
      "end_day": "2026-04-08",
      "timezone": "UTC",
      "semantics": "current_utc_day_plus_previous_6_days"
    },
    "exclude_test_mode": true,
    "production_only": true,
    "support_class": "event_only",
    "section_availability": {
      "summary": true,
      "today": true,
      "traffic": false,
      "human_traffic_events": true,
      "observability": true,
      "identity": false,
      "read": true
    }
  },
  "summary": {
    "accepted_events_7d": 8,
    "pageviews_7d": null,
    "traffic_requests_7d": null,
    "traffic_visits_7d": null,
    "last_received_at": "2026-04-08T10:00:00.000Z",
    "has_recent_signal": true
  },
  "traffic_layer": {
    "source": "cloudflare_edge",
    "semantics": "edge_observed_not_confirmed_human",
    "enabled": false
  },
  "traffic": {
    "cloudflare_traffic_enabled": false,
    "latest_day": {
      "day": null,
      "visits": null,
      "requests": null,
      "captured_at": null
    },
    "last_7_days": {
      "visits": null,
      "requests": null,
      "avg_daily_visits": null,
      "avg_daily_requests": null,
      "days_with_data": 0
    }
  },
  "page_execution_events": {
    "accepted_events": 8,
    "unique_paths": 3,
    "by_event_name": [
      { "event_name": "page_view", "events": 5 },
      { "event_name": "preview_generated", "events": 2 },
      { "event_name": "download_completed", "events": 1 }
    ],
    "top_paths": [
      { "path": "/", "events": 5 },
      { "path": "/generate", "events": 3 }
    ],
    "top_sources": [
      { "source": "search", "events": 4 },
      { "source": "(direct)", "events": 4 }
    ],
    "top_campaigns": [
      { "utm_campaign": "spring_launch", "events": 2 }
    ],
    "top_referrers": [
      { "referrer_domain": "google.com", "events": 4 }
    ],
    "top_contents": [
      { "utm_content": "hero_banner_a", "events": 2 }
    ]
  },
  "events": "<same object as page_execution_events — compatibility alias>",
  "legacy_pageview": null,
  "identity": null,
  "health": {
    "last_received_at": "2026-04-08T10:00:00.000Z",
    "included_events": 8,
    "excluded_test_mode": 1,
    "excluded_non_production_host": 0,
    "dropped_rate_limited": 0,
    "dropped_invalid": null,
    "cloudflare_traffic_enabled": false,
    "production_only_default": true
  }
}
```

- `GET /report?view=source_health`

```json
{
  "view": "source_health",
  "generated_at": "2026-04-08T12:00:00.000Z",
  "sites": [
    {
      "site_key": "tgc_site",
      "label": "True Good Craft",
      "backend_source": "site_events_raw",
      "cloudflare_traffic_enabled": false,
      "production_only_default": true,
      "last_received_at": null,
      "accepted_signal_7d": 0,
      "dropped_invalid": null,
      "dropped_rate_limited": 0
    }
  ]
}
```

View notes:
- `backend_source` is deterministic and reflects the current stored reporting surfaces used for that site: `pageview_daily`, `site_events_raw`, and/or `buscore_traffic_daily`, joined with `+`.
- All `*_7d` metrics use the current UTC day plus the previous six UTC days.
- In fleet, site, and source-health views, `last_received_at` is the latest accepted telemetry `received_at` included for that site. BUS Core considers both legacy pageviews and standardized site events; other sites consider standardized site events only.
- `has_recent_signal` is `true` when the selected site has at least one accepted supported signal in the current 7-day UTC window.
- `dropped_invalid` is currently supported only for BUS Core legacy pageview telemetry. Standardized-event invalid submissions are not persisted, so other sites return `null`.
- Site-view payloads expose `scope.support_class` and `scope.section_availability` to make section support deterministic by current support class.
- Site-view `identity` is populated only for support classes with identity support (currently BUS Core `legacy_hybrid`) and is `null` for event-only sites.
- For `event_only` sites, unsupported traffic metrics remain explicitly `null` and `identity` remains `null` by design; useful output is provided through event breakdown arrays.

### Semantic Data Layer Labels (v1.14.0)

Four semantic labels are established for Lighthouse reporting surfaces:

| Label | Meaning | Fields |
|---|---|---|
| `page_execution_events` | Standardized first-party site events from `POST /metrics/event`; physical storage is `site_events_raw` | `page_execution_events` in `view=site` |
| `legacy_pageview` | BUS Core first-party pageview telemetry from `POST /metrics/pageview`; physical storage is `pageview_*` tables | `legacy_pageview` in bare `/report` and `view=site` (BUS Core only) |
| `traffic_layer` | Cloudflare-edge-observed traffic signals; edge requests and visits, not confirmed human usage | `traffic_layer` metadata in `view=site`; `traffic` data section |
| `intent_counters` | Lighthouse aggregate operator counters (`update_checks`, `downloads`, `errors`) from `metrics_daily` | `intent_counters` in bare `/report` |

Rules:
- These four labels must be kept distinct in all reporting. They must not be blended or treated as equivalent.
- Physical storage table names are unchanged: `site_events_raw`, `pageview_daily`, `buscore_traffic_daily`, `metrics_daily`.
- `page_execution_events` and `events` in `view=site` carry identical data. `events` is retained as a backward-compatibility alias.
- BUS Core `operator_summary` is aggregate-only. It may include top lead sources/campaigns from `early_access_leads`, counted-intent event sources for `download_click`, `early_access_submit_success`, `github_click`, `discord_click`, `support_click`, and `docs_click`, pageview/intent/lead conversion rows, telemetry health, and two short operator-note strings. If lead attribution is unavailable, the section says so rather than faking zeroes.
- `operator_summary` must not include lead emails, raw event dumps, `bc_uid`, `bc_sid`, `anon_user_id`, `session_id`, raw IPs, hashed IPs, or user-agent hashes.
- `legacy_pageview` and `human_traffic` in bare `/report` carry identical data. `human_traffic` is retained as a backward-compatibility alias.
- `traffic_layer.enabled` is `false` for sites without Cloudflare traffic capture. When disabled, traffic values remain `null` and are never faked.

Normalized section contract (logical per-site sections where supported):
- Summary
- Today
- Traffic
- Human Traffic / Events
- Observability
- Identity
- Read

Section rules:
- Unsupported sections stay `null` or omitted by documented rule.
- No site-specific reinterpretation of shared section meaning.
- Comparable fleet summaries must not imply unsupported metrics exist.

Shared field meaning rules:
- `accepted_signal_7d`: accepted supported telemetry signals in 7-day UTC window.
- `accepted_events_7d`: accepted standardized events only.
- `has_recent_signal`: `accepted_signal_7d > 0`.
- `last_received_at`: latest accepted telemetry timestamp included for the site in the view.
- `cloudflare_traffic_enabled`: support/capability flag from tracked-site registry.
- `health.included_events` and `events.accepted_events` are computed from the same filter predicate over the same 7-day window and must be equal. A mismatch indicates a querying defect.

## Star Map Configuration

Star Map Generator is registered as `site_key: "star_map_generator"` in `TRACKED_SITES` with:
- `production_hosts`: `starmap.truegoodcraft.ca`
- `allowed_origins`: `https://starmap.truegoodcraft.ca`
- `cloudflare_traffic_enabled`: `false` — Star Map is `event_only`; traffic and identity sections are `null` by design.
- `production_only_default`: `true` — operator reports filter to production-host events by default.

Star Map support class: `event_only`. Traffic and identity layers are not active. Extension-layer events (`preview_generated`, `high_res_requested`, `payment_click`, `download_completed`, `error_preview`, `error_high_res`) are accepted as site-specific extensions alongside shared events (`page_view`).

Operator report calls for Star Map:

- `/report?view=site&site_key=star_map_generator`
- `/report?view=site&site_key=star_map_generator&exclude_test_mode=true&production_only=true`

Event naming rules:

- Ingest compatibility remains permissive and accepts any non-empty `event_name`.
- Shared comparable event names are frozen to: `page_view`, `outbound_click`, `contact_click`, `service_interest`.
- Report normalization aliases equivalent shared names into canonical forms (for example `pageview -> page_view`, `link_click -> outbound_click`) to prevent semantic drift in shared-action reporting.
- Site-specific event names remain valid as extensions and are treated as site-scoped unless explicitly added to shared taxonomy.

## D1 Schema

```sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  day           TEXT    PRIMARY KEY,
  update_checks INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS buscore_traffic_daily (
  day         TEXT    PRIMARY KEY,
  visits      INTEGER NULL,
  requests    INTEGER NOT NULL,
  captured_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS pageview_events_raw (
  id              TEXT    PRIMARY KEY,
  received_at     TEXT    NOT NULL,
  received_day    TEXT    NOT NULL,
  client_ts       TEXT    NULL,
  path            TEXT    NULL,
  url             TEXT    NULL,
  referrer        TEXT    NULL,
  referrer_domain TEXT    NULL,
  src             TEXT    NULL,
  utm_source      TEXT    NULL,
  utm_medium      TEXT    NULL,
  utm_campaign    TEXT    NULL,
  utm_content     TEXT    NULL,
  device          TEXT    NULL,
  viewport        TEXT    NULL,
  lang            TEXT    NULL,
  tz              TEXT    NULL,
  anon_user_id    TEXT    NULL,
  session_id      TEXT    NULL,
  is_new_user     INTEGER NOT NULL DEFAULT 0,
  country         TEXT    NULL,
  js_fired        INTEGER NOT NULL DEFAULT 1,
  ip_hash         TEXT    NULL,
  user_agent_hash TEXT    NULL,
  accepted        INTEGER NOT NULL DEFAULT 1,
  drop_reason     TEXT    NULL,
  request_id      TEXT    NULL,
  ingest_version  TEXT    NULL
);

CREATE TABLE IF NOT EXISTS pageview_daily (
  day                  TEXT    PRIMARY KEY,
  pageviews            INTEGER NOT NULL DEFAULT 0,
  accepted             INTEGER NOT NULL DEFAULT 0,
  dropped_rate_limited INTEGER NOT NULL DEFAULT 0,
  dropped_invalid      INTEGER NOT NULL DEFAULT 0,
  last_received_at     TEXT    NULL
);

CREATE TABLE IF NOT EXISTS pageview_daily_dim (
  day       TEXT    NOT NULL,
  dim_type  TEXT    NOT NULL,
  dim_value TEXT    NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, dim_type, dim_value)
);

CREATE TABLE IF NOT EXISTS pageview_rate_limit (
  minute_bucket TEXT    NOT NULL,
  ip_hash       TEXT    NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(minute_bucket, ip_hash)
);
```

Pageview ingestion notes:
- `pageview_events_raw` is retained for about 30 UTC days for inspectability and validation.
- IP and user-agent values are stored as SHA-256 hashes when present; Lighthouse does not store raw IPs.
- Anonymous continuity fields (`anon_user_id`, `session_id`, `is_new_user`) are accepted from first-party payloads only and used for aggregate retention reporting.
- `pageview_daily_dim` only tracks accepted dimensions for `path`, `referrer_domain`, `src`, and `utm_source`.
- `pageview_rate_limit` enforces approximate per-IP minute buckets and stale buckets are pruned during the existing daily scheduled run.

## Configuration

Required bindings/secrets:
- `DB`
- `MANIFEST_R2`
- `ADMIN_TOKEN`
- `IGNORED_IP` (optional)
- `CF_API_TOKEN` (required for scheduled Buscore traffic capture)
- `CF_ZONE_TAG` (required for scheduled Buscore traffic capture)
- `TELEMETRY_RATE_LIMIT_SECRET` (required in production for keyed standardized-site and BUS Core product-telemetry minute controls and qualified update/artifact daily controls)
- `BUSCORE_LEADS_DB` (optional external D1 read binding for aggregate BUS Core operator reporting and CEO voluntary-inquiry totals)
- `GITHUB_REPO` (optional; defaults to `True-Good-Craft/TGC-BUS-Core` for the scheduled GitHub snapshot and latest-release probe)
- `GITHUB_TOKEN` (optional secret; raises scheduled GitHub API snapshot rate limits and is not required by the public latest-release HEAD probe)

`ADMIN_TOKEN` is a broad administrative credential, not a read-only token. It protects report reads and the mutating `POST /campaign`, `POST /notes`, and `POST /report/snapshot` routes. Do not expose its value or treat report-read approval as write approval.

No new bindings or secrets are introduced by pageview ingestion.

## Scheduling

Lighthouse reporting is on-demand; a daily scheduled job maintains its stored evidence.
- The cron captures one previous completed UTC day Buscore traffic snapshot from the Cloudflare GraphQL Analytics API.
- Independently fail-soft tasks also write the completed-day rollup, public GitHub snapshot, and service checks, then prune bounded-retention event, probe, product-telemetry, artifact-truth, and rate-control data.
- No outbound Discord posting.
- Discord report handling remains local/operator-report only. Lighthouse does not create or send Discord webhook messages unless a future SOT change explicitly approves an outbound integration.

Traffic capture notes:
- The cron always queries the previous completed UTC day. It never queries the current UTC day and never stores rolling-window snapshots.
- Each scheduled run executes one GraphQL query only.
- Successful captures upsert one final row per UTC day, so reruns converge to one row for that day.
- If the Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day rather than writing synthetic zeroes.
- If the query returns no daily row for the selected day/hostname, Lighthouse treats the run as failed and skips the row.
- Lighthouse validates that the response includes a numeric daily request `count` field; if missing/undefined/non-numeric, the run is treated as failed and the row is skipped.
- Bare `/report`, `view=fleet`, and `view=site` perform one best-effort refresh capture for the previous completed UTC day before assembly. Stored-data views, including `view=ceo`, skip that external refresh.

## Provisioning is not diagnosis

The setup commands below create resources, apply migrations, set secrets, start a local runtime, or deploy code. They are provisioning and development procedures, not passive diagnostic steps. Do not run them during read-only incident diagnosis or against remote resources without explicit approval.

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) >= 20.18.1
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as dev dependency)
- A Cloudflare account

### 2. Install dependencies

```bash
npm ci
```

### 3. Create the D1 database for a new environment

The production database already exists. Do not recreate, rename, or replace it during ordinary setup or diagnosis. Do not run new-environment provisioning through the checked-in production `wrangler.toml`, because it pins the production account. Prepare a separately approved environment-specific Wrangler configuration with its intended `account_id` first, then run:

```bash
npx wrangler d1 create YOUR_ENVIRONMENT_DATABASE_NAME --config YOUR_ENVIRONMENT_WRANGLER_CONFIG
```

Configure that environment's returned database ID explicitly. The production `DB` binding remains database ID `e46f2daa-7e97-45a3-9bf0-49003a42850c`, named `lighthouse`.

### 4. Apply migrations

Local migration uses the stable binding name and cannot reach remote D1. A new remote environment must use its explicit configuration. The checked-in configuration targets production, so its remote command requires separate production-migration approval. Version 1.29.4 has no migration.

```bash
# local (for wrangler dev)
npx wrangler d1 migrations apply DB --local

# separately approved new remote environment
npx wrangler d1 migrations apply DB --remote --config YOUR_ENVIRONMENT_WRANGLER_CONFIG

# separately approved production only
npx wrangler d1 migrations apply DB --remote
```

### 5. Set secrets

Production secrets already exist; ordinary setup must not recreate, reveal, or rotate them. For a separately approved new environment, target its explicit configuration:

```bash
npx wrangler secret put ADMIN_TOKEN --config YOUR_ENVIRONMENT_WRANGLER_CONFIG
npx wrangler secret put CF_API_TOKEN --config YOUR_ENVIRONMENT_WRANGLER_CONFIG
npx wrangler secret put CF_ZONE_TAG --config YOUR_ENVIRONMENT_WRANGLER_CONFIG
npx wrangler secret put TELEMETRY_RATE_LIMIT_SECRET --config YOUR_ENVIRONMENT_WRANGLER_CONFIG
```

`IGNORED_IP` is optional and, when approved for an environment, is provisioned through the same secret mechanism. Do not provision the legacy unreferenced `DISCORD_WEBHOOK_URL` or `PRICE_GUARD_KEY` names in a new environment.

### 6. Configure `wrangler.toml`

Pin the intended Cloudflare account. Production uses account `eb1a8dd5723031d94e57642e3eaaebda`. Verify `DB`, `BUSCORE_LEADS_DB`, and `MANIFEST_R2` by immutable resource ID or bucket name; do not infer them from the Worker name. Ensure the target environment separately provisions `CF_ZONE_TAG` and `CF_API_TOKEN` for scheduled traffic capture.

### 7. Release inspection, upload, and deployment

These commands contact Cloudflare and require explicit approval. Status and history are control-plane reads. Upload creates external Worker-version or preview state. Deploy changes active production traffic.

```bash
npm run release:status
npm run release:history
npm run release:upload
```

Use `release:upload` only for an approved non-promoting version upload. The only authorized production-promotion path is the manually dispatched `Deploy Lighthouse to Cloudflare` workflow from `main`; it validates before deployment, uses `--keep-vars --strict`, and records an active-deployment JSON receipt. There is intentionally no direct production-deploy package script. No deployment applies a D1 migration or authorizes a secret operation.

For a production rollback, follow the immutable-version and receipt procedure in `OPERATIONS.md`. Rollback requires a separately approved, explicitly named version ID and post-rollback status verification; it is not bundled into upload or deployment approval.

### Local development

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck
```
