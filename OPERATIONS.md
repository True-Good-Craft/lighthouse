# Lighthouse Operations and Diagnostics

- Status: current operational runbook
- Scope: Lighthouse analytics access, evidence interpretation, and incident diagnosis
- Runtime baseline: last production deployment recorded in repository history is Lighthouse Worker `1.29.2`; repository documentation release `1.29.3`; CEO report and metric-definition contract `1.1`; current active-production state not independently control-plane verified
- Last reconciled: 2026-08-26
- Live Lighthouse endpoint and Cloudflare control-plane verification during this documentation change: not performed
- Repository-publication evidence: the PR branch push triggered Cloudflare Workers Builds, whose check classified uploaded version `33f4db25-9faf-435d-a83e-83d7d1c17eac` as a preview, reported version/branch preview URLs, and did not report an active-production promotion; this is not independent proof of current active-production state

## Authority and Purpose

Use this file to locate the correct diagnostic surface without rediscovering the system or probing every endpoint.

Authority order remains:

1. `SOT.md` — intended and shipped Lighthouse behavior.
2. `CHANGELOG.md` — shipped-change history.
3. `src/index.ts` and `contracts/` — implementation and machine-readable contracts.
4. `OPERATIONS.md` — canonical access and diagnostic procedure, subordinate to the sources above.
5. `README.md` — implementation overview and setup.

If this runbook conflicts with `SOT.md`, stop and report the conflict. Do not improvise a route, credential, query, storage meaning, or status interpretation.

## Safety Default

The default diagnostic posture is local and zero-mutation:

- Read repository documentation, contracts, fixtures, configuration names, and code.
- Inspect local Git state without changing it.
- Do not contact production, Cloudflare, Discord, GitHub, Airtable, or another service unless the user has authorized that scope.
- Do not treat `git push` as local-only. This repository's Cloudflare Workers Builds integration uploaded a preview Worker version for the 1.29.3 review-branch push; future branch and production-branch behavior depends on external build settings.
- Do not run migrations, deployments, scheduled handlers, retention jobs, report snapshots, notes, campaign writes, telemetry submissions, or release downloads during passive diagnosis.
- Never print, persist, or commit secret values, raw lead data, identifiers, IP material, or other private payloads.

If the approved endpoint, credential source, account context, or tool authorization is unavailable, record `ACCESS_BLOCKED` and stop that diagnostic branch. Do not substitute guessed URLs, unrelated credentials, direct D1 queries, or broader probes.

## System Ownership

| System | Owns | Does not prove |
|---|---|---|
| Lighthouse | Analytics ingestion, aggregate storage, source availability/freshness/coverage, scheduled service-probe evidence, protected report payloads, and CEO contract `1.1` | Agent Smith delivery, Discord delivery, or producer-side transmission success |
| Agent Smith | Report-mode selection, strict CEO validation, status/trust wording, daily/weekly/monthly presentation, Discord delivery orchestration/attempts, and monthly archive attempts | That every Lighthouse scheduled task ran, every source is fresh, Discord received a message, the watch channel is configured, posting permission exists, or a monthly archive write succeeded merely because Smith's private `/health` command responds |
| BUS Core | Optional, fail-soft product-event production; default-config startup/manual reads of Lighthouse `/update/check`; and user-triggered staging that re-reads the configured manifest URL without analytics query parameters before GETting the manifest-declared artifact | Lighthouse acceptance, availability, producer authenticity, or completed staging; the canonical client does not call Lighthouse `/manifest/core/stable.json` or `/download/latest` |
| `buscore-site` | BUS Core public-site event production; `dev_mode`/`noAnalytics` suppression; early-access and Managed BUS routes; Turnstile/KV controls; and D1 lead writes | Lighthouse acceptance or persistence after a fail-soft browser send |
| `tgc-site` | Consent-gated TGC event and Cloudflare Web Analytics production; `dev_mode`, privacy-signal, origin, and `test_mode` controls; and the static `/api/intake` client | Lighthouse acceptance or persistence after a fail-soft browser send, or proven backend delivery for `/api/intake` |
| `tgc-ops` | Pointer-first cross-asset documentation in principle | Current analytics truth: its telemetry/dependency records contain known stale claims and must be reconciled before use |

Lighthouse remains independently runnable. A failure in one producer, consumer, optional binding, or presentation layer is not automatically a Lighthouse outage.

## Canonical Locations

| Need | Canonical location |
|---|---|
| Governance and approval boundaries | `AGENTS.md` |
| Shipped behavior, routes, auth, storage, scheduling | `SOT.md` |
| Diagnostic sequence and side-effect classification | `OPERATIONS.md` |
| Shipped history | `CHANGELOG.md` |
| Runtime bindings and cron | `wrangler.toml` |
| Route implementation | `src/index.ts` |
| D1 schema history | `migrations/` |
| CEO response contract | `contracts/ceo-v1/report.schema.json` |
| BUS Core product telemetry contract | `contracts/buscore-product-telemetry-v1.json` and `src/productTelemetry.ts` |
| Representative CEO states | `contracts/ceo-v1/*.json` |
| Metric meanings | `SOT.md`, `README.md`, `BUS_CORE_TRAFFIC_TRUTH.md`, and `TGC_SITE_ANALYTICS_POLICY.md` |
| Historical Phase 2/3 implementation record | `PHASE2_ANALYTICS_NOTES.md` and `PHASE3_ANALYTICS_NOTES.md`; never use alone as current operations authority |
| Agent Smith mode, commands, status, schedules, and delivery | `../Agent_Smith/SOT.md`, `../Agent_Smith/CHANGELOG.md`, `../Agent_Smith/wrangler.toml`, `../Agent_Smith/CONTRACTS.md`, `../Agent_Smith/BUS_CORE_REPORTING_CONTRACT.md`, and `../Agent_Smith/src/commands/` |
| BUS Core product producer | `../TGC-BUS-Core/SOT.md`, `../TGC-BUS-Core/OPERATIONS.md`, `../TGC-BUS-Core/CHANGELOG.md`, `../TGC-BUS-Core/core/telemetry/client.py`, `../TGC-BUS-Core/core/services/update.py`, `../TGC-BUS-Core/core/services/update_stage.py`, and `../TGC-BUS-Core/core/api/routes/telemetry.py` |
| BUS Core site producer | `../buscore-site/SOT.md`, `../buscore-site/CHANGELOG.md`, `../buscore-site/SITE_ANALYTICS_IMPLEMENTATION.md`, `../buscore-site/manifest/core/stable.json`, `../buscore-site/assets/js/site-analytics.js`, and `../buscore-site/tests/browser/deploy-analytics.test.mjs` |
| TGC site producer | `../tgc-site/SOT.md`, `../tgc-site/contracts/lighthouse-analytics-contract.md`, `../tgc-site/assets/js/telemetry.js`, and `../tgc-site/tests/telemetry-payload.test.js` |

Sibling paths above describe the audited local checkout layout. If a repository is absent, stop that cross-repository branch rather than searching unrelated locations. A checked-in buscore-site manifest is a repository release projection that can lag production; it is not live endpoint proof. BUS Core facts were last reconciled against released version `1.4.2`, and buscore-site source facts against its merged `1.4.2` release-sync change, on 2026-08-26. Agent Smith facts remain reconciled against shipped version `0.25.2`; an unshipped local `0.25.3` documentation bundle is not current authority. Older Agent Smith SOT paragraphs that call `/report` a raw diagnostic product are superseded: in current production `ceo_v1`, the private `/report` command renders the CEO business/decision product. The retained `formatDiagnosticReport()` is test-only and has no command/runtime route.

## Deployed Resource Map

The following identifiers are checked into `wrangler.toml`:

| Binding or trigger | Configured resource | Purpose |
|---|---|---|
| Worker name | `buscore-lighthouse` | Cloudflare Worker service name |
| `DB` | D1 database `buscore-lighthouse` | Primary Lighthouse aggregates and bounded evidence |
| `BUSCORE_LEADS_DB` | D1 database `buscore-leads` | Optional read binding for aggregate inquiry reporting |
| `MANIFEST_R2` | R2 bucket `bus-core` | Stable manifest and versioned release artifacts |
| Cron | `5 0 * * *` | Daily traffic capture, rollup, GitHub snapshot, service probes, and retention |

The checked-in production consumer endpoint is `https://lighthouse.buscore.ca/report` in `../Agent_Smith/wrangler.toml`. Lighthouse's own `wrangler.toml` does not declare the custom hostname/route, so the consumer configuration is the current repository-visible pointer, not independent deployment proof. A control-plane read is required to verify route attachment; do not infer a `workers.dev` URL from the Worker name.

## Repository Publication and Deployment Paths

| Path | Proven or repository-visible behavior | Operational boundary |
|---|---|---|
| `.github/workflows/governance.yml` | Runs dependency installation, typechecking, and the full test suite for every PR and `main` push | Validation only; it does not deploy |
| `.github/workflows/deploy.yml` | Triggers on `main` push or manual dispatch; both its validation gate and downstream deploy run only for manual dispatch or the workflow's explicit commit-message release opt-in | This release gate governs only the checked-in deploy workflow |
| Cloudflare Workers Builds, non-production branch | The 1.29.3 review-branch push uploaded a Worker version and produced version/branch preview URLs; the check classified it as a preview and did not report an active-production promotion | This is external preview state created by `git push`, not independent proof of current active-production state. Do not call a preview URL during passive diagnosis because its effective bindings and request side effects have not been separately verified |
| Cloudflare Workers Builds, configured production branch | Cloudflare-managed production branch and deploy-command settings are outside this repository | A merge or production-branch push is potentially active-production-deploying even if the GitHub Actions deploy job skips; require explicit owner approval and either control-plane verification or explicit acceptance of that consequence |

The absence of Cloudflare deployment secrets in GitHub Actions does not disable Cloudflare Workers Builds, which uses separately managed integration credentials. Do not describe the checked-in workflow as the sole deployment control.

`tgc-ops` is not yet safe as an analytics source of truth: its current records include stale future-tense BUS Core telemetry claims and a reversed Lighthouse/buscore-site dependency. Use owning repositories until that separate repository is explicitly reconciled.

## Credentials and Access Boundaries

| Name | Where used | Boundary |
|---|---|---|
| `ADMIN_TOKEN` | Lighthouse runtime | Exact-match credential accepted through `X-Admin-Token` |
| `LIGHTHOUSE_ADMIN_TOKEN` | Agent Smith runtime | Consumer-side name for the Lighthouse admin credential |
| `LIGHTHOUSE_REPORT_URL` | Agent Smith runtime | Canonical report endpoint; checked-in production value points to `https://lighthouse.buscore.ca/report` |
| `CF_API_TOKEN` and `CF_ZONE_TAG` | Lighthouse scheduled traffic capture | Cloudflare GraphQL traffic source, not report authentication |
| `GITHUB_REPO` and optional `GITHUB_TOKEN` | Lighthouse scheduled GitHub snapshot/probe configuration | Repository selection and optional API quota; not Lighthouse report authentication |
| `TELEMETRY_RATE_LIMIT_SECRET` | Lighthouse ingestion/release counting | Keys rotating abuse-control identifiers; never a diagnostic credential |

`ADMIN_TOKEN` is not a read-only credential. The same token authorizes protected report reads and the mutating `POST /campaign`, `POST /notes`, and `POST /report/snapshot` routes. Possession of the token does not authorize those writes. Do not paste it into commands, logs, chat, files, or screenshots.

## Diagnostic Access Classes

### Class 0 — local zero-mutation

Safe default:

- Read the authority files and CEO fixtures.
- Inspect `wrangler.toml`, route code, tests, and migrations.
- Run local searches and `git status`.
- Review a supplied alert/report without contacting any service.

This class changes neither local tracked files nor external state.

### Class 1 — approved control-plane reads

Cloudflare deployment, route, binding, cron, log, or D1 metadata reads may establish infrastructure state without intentionally changing Lighthouse application data. They still require explicit authorization, a valid account context, and the least-privileged supported command. A Cloudflare/Wrangler access failure is infrastructure evidence, not a Lighthouse application failure.

Do not use direct D1 SQL as a fallback merely because a protected report cannot be accessed. SQL can bypass report semantics, expose data outside the contract, or be accidentally executed as a write.

### Class 2 — approved read-mostly report calls

These protected views skip the best-effort Cloudflare traffic refresh and read currently persisted evidence:

| Request | Primary use |
|---|---|
| `GET /report?view=ceo` | First diagnostic read; strict CEO `1.1` facts, windows, source state, limitations, failures, and latest service probes |
| `GET /report?view=source_health` | Ingestion integrity by tracked site; not service-probe truth |
| `GET /report?view=asset` | Stored Phase 2 rollup, GitHub snapshot, service checks, and campaign evidence |
| `GET /report?view=tgc` | Detailed TGC compatibility diagnostics |
| `GET /report?view=monthly` | Historical monthly asset/scoring compatibility surface |

These are read-mostly, not guaranteed zero-write: if report assembly throws, Lighthouse best-effort increments `metrics_daily.errors` before returning `503 report_unavailable`.

Agent Smith surfaces inherit downstream behavior:

| Smith surface | Current behavior and diagnostic boundary |
|---|---|
| Private `/health` Discord command | Fetches the active Lighthouse report and publicly GETs the stable manifest. A manifest miss/read error or CEO report-assembly failure can therefore alter `metrics_daily.errors`. It does not validate cron execution, watch-channel configuration, Discord posting permission/receipt, TGC freshness, or monthly archive success. An unsigned HTTP GET to the Smith Worker is not this command and proves no health. |
| Private `/report` Discord command | In production `ceo_v1`, fetches `GET /report?view=ceo` and renders the CEO business/decision product. It is not a raw diagnostic command and never falls back to legacy. |
| Private `/tgc` Discord command | Fetches the stored-data `view=tgc` compatibility diagnostic. It remains owner/channel gated and is not used for CEO scheduled facts. |

Missing `DISCORD_WATCH_CHANNEL_ID` skips scheduled posting. Post failures are logged rather than converted into delivery proof, and a monthly archive attempt can occur even after a Discord post failure. An archived snapshot is therefore not proof of Discord delivery.

### Class 3 — evidence-mutating or explicitly mutating surfaces

Do not call these during passive diagnosis:

| Surface | Side effect or risk |
|---|---|
| Bare `GET /report`, `view=fleet`, `view=site` | Performs a best-effort previous-completed-day Cloudflare traffic capture/upsert before report assembly |
| `GET /manifest/core/stable.json` | A missing object or read error attempts a best-effort `metrics_daily.errors` increment; successful GET is non-mutating |
| `HEAD /manifest/core/stable.json` | Does not increment the Lighthouse error counter; it still contacts production and is reserved for an explicitly approved liveness check |
| `GET /update/check` | Can increment qualified update-check aggregates and rate-control state; failures can increment errors |
| `GET /download/latest` | A successful redirect schedules a best-effort increment of `buscore_download_intent_daily.successful_redirects`; the `302` does not prove persistence. Failures attempt a best-effort error increment |
| `GET /releases/:filename` | Can change raw/success/cache/rate/source-credit and qualified-download evidence and transfers artifact content |
| `HEAD /releases/:filename` | Records raw/HEAD artifact truth even though it does not count a full response, source credit, or download |
| `POST /metrics/pageview` and `POST /metrics/event` | Return `204` after body capture, then asynchronously validate, rate-limit, and persist. The HTTP response is not acceptance or persistence proof; invalid pageview bodies can still write dropped-invalid evidence |
| `POST /telemetry/v1/events` | After basic content-type/size checks, mutates product-telemetry rate-control state before parsing the payload. Valid events then persist deduplication/aggregate state and return an event-ID acknowledgement. The receiver is public and has no diagnostic authentication |
| `POST /campaign`, `POST /notes`, `POST /report/snapshot` | Explicit protected writes |
| `git push` to a non-production branch | Connected Cloudflare Workers Builds can upload a preview Worker version and create preview URLs, as observed for the 1.29.3 review branch; the check did not report an active-production promotion, but active-production state was not independently verified |
| Merge or push to the Cloudflare-configured production branch | May run the integration's externally configured deploy command and promote the active production deployment independently of the checked-in GitHub Actions gate |
| Scheduled handler, D1 command, migration, secret operation, deployment, release | Operational mutation requiring separate explicit approval |

The existence of a route in `README.md` or `SOT.md` is not authorization to probe it.

## Canonical Morning Diagnostic Sequence

Use this order for a Lighthouse `WATCH`, `ALERT`, unavailable report, or analytics concern:

1. **Preserve the initiating evidence.** Record the exact message, timestamp, timezone, delivery lane, requested window, and whether it came from Agent Smith `/health`, `/report`, a scheduled Discord message, Cloudflare, or another surface.
2. **Classify the layer before probing.** Separate report preparation, Lighthouse facts, scheduled service probes, source ingestion, Agent Smith presentation, Discord delivery, and Cloudflare access.
3. **Read local authority.** Read `AGENTS.md`, `SOT.md`, this runbook, the relevant changelog entry, and the CEO schema/fixture matching the observed state. If `source_health` or supplied evidence identifies a producer, also read that producer's canonical files listed above.
4. **Confirm authorization and access material.** Use only the approved production endpoint and an owner-approved, non-echoing credential mechanism. Agent Smith's Cloudflare runtime binding is not a user-facing diagnostic credential source. Never reveal the credential. If the endpoint, mechanism, or authorization is unavailable, report `ACCESS_BLOCKED` and continue only with local evidence.
5. **Read the CEO view first only when both production access and a safe credential mechanism are approved.** Fetch exactly `GET https://lighthouse.buscore.ca/report?view=ceo` with the `X-Admin-Token` header without placing the token literal in command arguments, files, logs, chat, or screenshots. Check HTTP status, JSON parse, `report_contract_version`, `metric_definition_version`, `generated_at`, exact windows, `sources`, `details.service_probes`, and `limitations` before interpreting totals.
6. **Narrow to one secondary view only when evidence requires it.** Use `source_health` for producer-ingestion integrity, `asset` for stored probe/GitHub/rollup detail, or `tgc` for the TGC compatibility diagnostic. Do not fan out across every surface.
7. **Check Agent Smith separately.** Confirm configured mode and active lane. Production is checked in as `ceo_v1`. A Smith `/health` response can show its configuration and CEO readiness; it does not independently prove Discord delivery, Lighthouse cron completion, TGC source freshness, or monthly archive success.
8. **Correlate by timestamp and ownership.** Compare the alert time, CEO `generated_at`, each source's `data_through`, probe `checked_at` values, and the applicable complete or partial window. Do not compare partial today with a complete day as though they were equivalent.
9. **Report diagnosis with confidence and gaps.** State what is proven, what is inferred, what is unavailable, whether any diagnostic action could have changed evidence, and the smallest next check requiring approval.

Do not start by calling bare reports, update checks, download redirects, artifact GET/HEAD routes, POST routes, D1 SQL, or deployment commands.

## Evidence Map

| CEO source | Backing evidence | What it means |
|---|---|---|
| `artifact_delivery` | `artifact_traffic_daily` and related bounded delivery aggregates | Worker-observed artifact response evidence; not completed transfer, person, or installation |
| `update_checks` | `metrics_daily` and `release_update_checks_daily` | Qualified release-route requests; not active users or authentic-client proof |
| `product_telemetry` | `buscore_product_events_daily` plus bounded event-ID deduplication | Accepted allowlisted events are aggregated once per event ID; duplicate IDs are acknowledged but not re-counted. The canonical BUS Core client transmits only after local enablement plus disclosure acknowledgement, but this public unauthenticated receiver cannot prove sender provenance or consent. Native posts use `Content-Type: application/json` and `User-Agent: BUS-Core/<VERSION>` as honest transport identity only; the user agent is not authentication, a user/device identifier, or sender-provenance proof, and Lighthouse does not persist it as product identity. No persistent installation identity is stored |
| `buscore_site` | `site_events_raw` plus `buscore_download_intent_daily` | Accepted production BUS Core page views and rate-bounded canonical artifact-click interest from its definition boundary |
| `tgc_site` | `site_events_raw` for `tgc_site` | Consented, allowlisted TGC site events with bounded sanitized detail |
| `voluntary_inquiries` | Aggregate reads from optional `BUSCORE_LEADS_DB` | Voluntary inquiry totals and fixed privacy-safe attribution buckets; never raw lead data |
| `lighthouse_errors` | `metrics_daily.errors` | Best-effort counter updated only by selected route failures: manifest GET, `/update/check`, `/download/latest`, and report assembly. It is not a complete Worker error log: manifest HEAD, artifact-route failures, product-ingest failures, and scheduled-probe failures do not increment it |
| `service_probes` | Latest active rows in `health_checks` | Scheduled liveness evidence for six named surfaces |

`GET /report?view=source_health` is ingestion-integrity evidence. It reports recent accepted signals and persisted drop counters by tracked site. It is not the service-probe table and must not be used as proof that the manifest, artifact, lead, GitHub, or site endpoints are currently reachable.

Update-check aggregates include only GET requests whose query contains exactly one each of `current_version`, `channel`, and `first_check`; whose channel and versions are valid and plausible (`current_version >= 1.4.0` and not newer than the selected manifest release); and whose unsuppressed client IP, configured rate-limit secret, and two-per-IP/day gate permit counting. Successful manifest reads that fail any gate—including BUS Core staging's parameterless manifest read—are not counted.

For producer-side BUS Core product-telemetry truth, use the protected read-only `GET /app/telemetry/status` only with an authorized local BUS Core session and `settings.read` permission. It exposes enabled, pending, acknowledged, rejected, dead-letter, and last-delivery state. Do not use BUS Core `/transparency.report` or the Home “Telemetry Off” card as telemetry-health evidence. A queued retry does not self-wake when `next_attempt_at` arrives; delivery resumes only when a later emit or startup flush starts the worker, so an aging pending item does not by itself prove an ongoing Lighthouse outage.

Producer-specific comparisons are not one-to-one:

- BUS Core site emission is suppressed by `dev_mode` or `localStorage.noAnalytics === "1"` and deduplicates same-path page views within three seconds. It has no producer-side origin guard or `test_mode` label, so an unsuppressed local/staged page can attempt the production endpoint even though Lighthouse may reject it.
- TGC emission requires current optional-analytics consent, honors GPC/DNT and `dev_mode`, refuses non-production origins, and can label `test_mode` traffic for report exclusion. A quiet `tgc_site` source can therefore reflect consent/suppression rather than emitter or Lighthouse failure.
- BUS Core's primary `/download/latest` CTA intentionally emits no `download_click`; only exact versioned Lighthouse artifact links qualify. Website click evidence and artifact delivery should not be expected to match.
- Early-access success may emit `early_access_submit_success`, but suppression can prevent it. Managed BUS success emits no dedicated Lighthouse success event. BUS Core lead rows are unique by email and shared across both forms, so row totals are not submission totals.
- A TGC intake endpoint failure emits both `form_submit_failure` and `form_submit_fallback` for one attempt; do not sum them as two failed inquiries. The current TGC form reports category `contact` even when a service is preselected.
- A true return from `navigator.sendBeacon()` proves only browser queue acceptance. Neither it nor a swallowed/fail-soft fetch result proves Lighthouse HTTP acceptance or persistence.

## Scheduled Service-Probe Truth

The current scheduled probe set is:

| Target | Safe scheduled check | Passing boundary |
|---|---|---|
| `site_home` | Public GET of BUS Core home | `2xx` or `3xx` |
| `site_downloads` | Public GET of BUS Core downloads page | `2xx` or `3xx` |
| `manifest` | Public `HEAD /manifest/core/stable.json` | `200` metadata response |
| `release_artifact` | Bound manifest lookup followed by public HEAD of its exact canonical artifact | `200` and positive `Content-Length` |
| `lead_endpoint` | GET-only request to the early-access endpoint | Lighthouse currently accepts `2xx` or `405 Method Not Allowed` and never POSTs a synthetic lead. The current buscore-site route is expected to return `405` to GET; investigate a `2xx` as possible routing drift |
| `github_release` | Public HEAD of the configured repository's latest-release page | `200` or a same-repository non-empty release-tag redirect |

The Lighthouse daily cron is `5 0 * * *` (00:05 UTC). Agent Smith's checked-in delivery crons are 13:00 UTC daily, 14:00 UTC on Mondays, and 15:00 UTC on the first of each month. These are separate jobs: correlate their timestamps, and do not treat a missing Smith post as proof that the earlier Lighthouse cron failed. Probe rows are bounded to about 90 days. Each Lighthouse probe and scheduled writer is fail-soft; one failure does not prove that the rest of the run failed.

These are BUS Core-oriented liveness probes. They do not probe `truegoodcraft.ca`, either browser emitter, Cloudflare Web Analytics injection, TGC `/api/intake`, Managed BUS intake, or browser-to-Lighthouse delivery. A passing manifest HEAD proves route/object metadata only, not valid manifest JSON, required fields, CORS, or browser hydration. A passing early-access GET/405 proves only that the route/method boundary responded; it does not exercise Turnstile, KV rate control, D1 lead storage, production POST success, Managed BUS, or TGC intake.

## Vocabulary and Interpretation

| Term | Operational meaning |
|---|---|
| `WATCH` | Agent Smith found evidence needing attention or follow-up. It is not, by itself, a current outage. |
| `ALERT` | Agent Smith found current failure evidence requiring action. Identify the exact source/probe and timestamp. |
| `OK` | Agent Smith found no current actionable condition for the report product. Activity may still be zero or absent. |
| `UNAVAILABLE` | The requested report product could not be prepared or validated. It does not authorize fallback or prove every Lighthouse function is down. |
| System Health `OK` / `DEGRADED` | Agent Smith's private `/health` command summary, not a Lighthouse response-contract status. |
| CEO rollout readiness `READY` / `NOT READY` | Agent Smith's configured CEO lane readiness, separate from System Health and active-delivery status. |
| Active report delivery `OK` / `unavailable` | Agent Smith's active-lane fetch/validation result at command time; it is not Discord scheduled-delivery receipt. |
| `ACCESS_BLOCKED` | The diagnostic could not reach an approved endpoint/control plane or lacked approved credentials. This is an operator-access result, not a service-health result. |
| Source `available` | The source query/binding succeeded. Zero may be a real observed zero only when the metric and window support it. |
| Source `unavailable` | The source could not be queried or its binding is absent. Dependent values must be `null`, not zero. |
| Freshness `unknown` / `source_history_missing` | No trustworthy watermark exists yet. This is not the same as a failed current endpoint. |
| Freshness `stale` / `source_data_stale` | The latest stored evidence is older than the contract threshold. It may indicate an emitter, ingestion, schedule, or access issue; narrow the layer. |
| Coverage `partial` | The source does not establish complete coverage for the whole requested window, often because it is sparse or began later. Partial coverage is expected for multiple current sources and is not automatically an error. |

Additional failure boundaries:

- HTTP `401 unauthorized` from `/report` proves credential mismatch/missing configuration at that request boundary; it does not prove the Worker is down.
- HTTP `503 report_unavailable` means report assembly threw and may have incremented `metrics_daily.errors`.
- A Cloudflare/Wrangler authorization or account-context error—including the previously observed `7403` during a control-plane read—is classified as access/tooling failure until independent service evidence says otherwise. The number alone is not a Lighthouse application status.
- Producer-side `sendBeacon`/`fetch` behavior, whether apparently queued or failed, does not create delivery proof. Lighthouse acceptance must be established from Lighthouse evidence.
- A missing optional `BUSCORE_LEADS_DB` affects inquiry-dependent fields only; it must not make unrelated Lighthouse sources unavailable.

## Standard Diagnostic Report

Every diagnosis should state:

- Initiating evidence and timestamp/timezone.
- Environment and endpoint used, without secret values.
- Authorization scope and access class.
- Agent Smith mode/lane if relevant.
- Lighthouse HTTP and contract versions if read.
- Exact report windows and whether each is complete.
- Source availability, freshness, coverage, `data_through`, and reason code.
- Latest named service-probe states and `checked_at` times.
- Proven impact, likely layer, and alternative explanations.
- Whether any diagnostic request could have changed evidence.
- Confidence level, remaining unknowns, and the smallest approval-gated next action.

Never report a WATCH as an outage, an access failure as application failure, a sparse zero as confirmed inactivity, a download response as a person/installation/completed transfer, an update check as an active user, or `source_health` as endpoint liveness.

## Known Gaps — Do Not Work Around

- Lighthouse has no least-privilege report-read credential. The current `ADMIN_TOKEN` also authorizes three write routes.
- This repository has no owner-approved, non-echoing production report helper or canonical operator secret-retrieval mechanism. Until one is separately designed and approved, lack of a safe mechanism is `ACCESS_BLOCKED`.
- Lighthouse's `wrangler.toml` does not declare the checked-in consumer hostname, so local configuration alone cannot prove the production route attachment.
- Cloudflare Workers Builds production-branch, build-command, and deploy-command settings are not checked into this repository and were not control-plane verified for this release. The observed branch-preview upload proves the integration is active, so the GitHub Actions gate cannot be used as sole merge-safety evidence.
- `tgc-ops` analytics/dependency records are stale and cannot yet serve as the trusted cross-repository entry point.
- BUS Core `1.4.2` has an explicit producer-side code/SOT authority conflict: its code emits repeatable `restore_attempted`, `restore_completed`, `import_completed`, and `import_failed` events, and the current Lighthouse contract accepts them, but they remain outside BUS Core's SOT-authorized signal set. Lighthouse acceptance does not resolve producer authority. Treat their presence as known drift, not approval or a new metric definition; use BUS Core's SOT, operations runbook, and changelog as authority pending separate resolution.
- Agent Smith exposes no raw diagnostic command. Its retained diagnostic formatter is test-only; current private `/report` is the active business/decision product.
- Browser producers are fail-soft and provide no end-to-end delivery receipt.
- Agent Smith has no independent Discord receipt ledger; a post attempt, log line, or archived monthly snapshot is not receipt proof.

Any helper, token split, route/config reconciliation, cross-repository index repair, receipt mechanism, or automated drift check is a separate future change requiring its owning repository's approval and governance bundle.

## Approval Boundaries

Separate approval is required before:

- Any production or external-service request.
- Any Cloudflare control-plane, log, or D1 access.
- Any endpoint in Class 3.
- Any branch push or PR merge; a branch push can create Cloudflare preview state and did so for the 1.29.3 review branch, while a merge is potentially active-production-deploying until the integration settings are verified.
- Any POST, scheduled invocation, direct SQL, migration, secret operation, deployment, release, commit, push, or cross-repository edit.

When authorization covers only read-only diagnosis, stop before the first action that can mutate evidence or configuration and ask for the narrower additional approval.
