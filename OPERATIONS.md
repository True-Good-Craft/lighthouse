# Lighthouse Operations and Diagnostics

## Kingston default-on rollout — 1.33.0

Jamie explicitly changed Kingston to default-on aggregate analytics with an opt-out in Your privacy and no popup, and authorized the coordinated changes and production deployment. Existing saved no choices, GPC/DNT, dev_mode and noAnalytics suppression remain effective. No additional context, identifiers, raw history, queue, retries or third-party analytics are introduced.

Deploy Smith 0.28.0 first and verify its exact 1.0/1.1 consumer support; then publish Lighthouse main and dispatch only its validated manual deployment workflow after upload-only Builds readback. Verify active Worker version and a bounded v2 event in D1; HTTP 204 alone remains insufficient. Publish the v2 website last. Preserve migration 0016; no new schema or secret change. The older 1.32.0 worker drops v2 traffic, so disable/revert the website producer first for rollback. Static KFH error categories in Smith distinguish access, timeout, transport and validation without logging credentials or payloads.

## Kingston review candidate — 2026-09-04

The new isolated Kingston path is governed by [KFH_ANALYTICS_CONTRACT.md](KFH_ANALYTICS_CONTRACT.md). Source version is `1.32.0`. No production state is inferred from this branch. `view=kfh` reads only stored Kingston aggregates and skips traffic refresh; no live read is performed. Migration 0016 requires separate approval/remote verification before Worker promotion. Existing CEO consumer-parity and external Workers Builds verification gates remain in force.

The website emitter remains disabled. Cloudflare/Discord/D1 production access was unavailable and no endpoint, control-plane, secret or storage operation was attempted. Repository review publication is separately authorized and may trigger CI or non-promoting preview/version uploads.

- Status: current operational runbook
- Scope: Lighthouse analytics access, evidence interpretation, incident diagnosis, and release-control boundaries
- Repository baseline: Lighthouse `1.31.0` local governed bundle; CEO response contract `1.2`, metric-definition contract `1.1`; production promotion pending
- Active production baseline: Lighthouse `1.30.0`, CEO response and metric-definition contract `1.1`, Worker version `ab29c0fb-ca9e-4074-a379-18d0943ec02c` at 100% traffic, deployment `526f9fbc-6432-466c-9b39-2ae90b299cae`, from merged `main` commit `4e80d65de01606c15100a99e7852ce19c5e6cd98`
- Production release receipt: GitHub Actions run [33086080869](https://github.com/True-Good-Craft/lighthouse/actions/runs/33086080869) succeeded; no build timestamp is inferred from that receipt
- Consumer compatibility receipt: Agent Smith `0.26.0` merged as `5519764d959cf1d6a505280814c59e82854f9bda`; CI run [33105121602](https://github.com/truegoodcraft/Agent_Smith/actions/runs/33105121602) and deployment run [33105121605](https://github.com/truegoodcraft/Agent_Smith/actions/runs/33105121605) succeeded, including Discord command registration; the owner then confirmed `/report` works against active Lighthouse CEO `1.1`. Exact `1.2` validator parity remains pending after a final Lighthouse schema tightening.
- Last reconciled: 2026-08-27
- Diagnostic access used for the 1.31.0 bundle: local repository inspection and tests plus read-only GitHub receipt checks for the Agent Smith merge, CI, and deployment; no Cloudflare or Discord control-plane read was performed for this change
- Retained approved audit receipt: the prior read-only Cloudflare audit confirmed the active version, 100% traffic, deployment, and source merge above; the separately approved CEO read occurred at `2026-08-27T15:08:12.012Z`
- Production interaction for the 1.31.0 source bundle: no 1.31.0 endpoint request, Lighthouse deployment, Cloudflare read, D1 query, log tail, scheduled invocation, route change, secret operation, or traffic change. The owner separately exercised Agent Smith `/report` against active Lighthouse 1.30.0/CEO `1.1` to verify the deployed rollback-compatible consumer.
- Evidence side effects: local work and GitHub receipt reads were non-mutating. The owner-confirmed Agent Smith `/report` verification was an external read-mostly analytics path that returned a Discord interaction response; a failed Lighthouse assembly could have incremented `metrics_daily.errors`, but no failure was reported and exact downstream audit/evidence state was not independently read.
- Historical 2026-08-26 audit snapshot: the preceding 24-hour Cloudflare overview showed 67 invocations and zero Cloudflare platform/runtime errors. This is historical platform telemetry, not proof of Lighthouse endpoint, report, source, probe, or delivery health

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
- Do not treat `git push` as local-only. Durable readback on 2026-08-26 confirmed that both non-production and production Workers Builds use `npx wrangler versions upload`. Pushes can therefore upload Worker versions and create previews, although they must not promote active traffic.
- Do not run migrations, deployments, scheduled handlers, retention jobs, report snapshots, notes, campaign writes, telemetry submissions, or release downloads during passive diagnosis.
- Never print, persist, or commit secret values, raw lead data, identifiers, IP material, or other private payloads.
- The existence of `npm run --silent diagnostic:ceo` is not production-access approval. Run it only for an explicitly approved production CEO read; that read remains Class 2 and can increment error evidence if report assembly fails.

If the approved endpoint, credential source, account context, or tool authorization is unavailable, record `ACCESS_BLOCKED` and stop that diagnostic branch. Do not substitute guessed URLs, unrelated credentials, direct D1 queries, or broader probes.

## System Ownership

| System | Owns | Does not prove |
|---|---|---|
| Lighthouse | Analytics ingestion, aggregate storage, source availability/coverage, activity-only source recency, scheduled service-probe health evidence, protected report payloads, and CEO contracts `1.1`/`1.2` | Agent Smith delivery, Discord delivery, or producer-side transmission success |
| Agent Smith | Report-mode selection, strict CEO validation, status/trust wording, daily/weekly/monthly presentation, Discord delivery orchestration/attempts, and monthly archive attempts; it must accept both CEO `1.1` and `1.2` before Lighthouse `1.2` promotion | That every Lighthouse scheduled task ran, every direct source is healthy, Discord received a message, the watch channel is configured, posting permission exists, or a monthly archive write succeeded merely because Smith's private `/health` command responds |
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
| CEO response contracts | `contracts/ceo-v1/report.schema.json` for strict `1.2`; `contracts/ceo-v1/report-1.1.schema.json` for strict rollback `1.1` |
| BUS Core product telemetry contract | `contracts/buscore-product-telemetry-v1.json` and `src/productTelemetry.ts` |
| Representative CEO states | `contracts/ceo-v1/*.json` |
| Metric meanings | `SOT.md`, `README.md`, `BUS_CORE_TRAFFIC_TRUTH.md`, and `TGC_SITE_ANALYTICS_POLICY.md` |
| Historical Phase 2/3 implementation record | `PHASE2_ANALYTICS_NOTES.md` and `PHASE3_ANALYTICS_NOTES.md`; never use alone as current operations authority |
| Agent Smith mode, commands, status, schedules, and delivery | `../Agent_Smith/SOT.md`, `../Agent_Smith/CHANGELOG.md`, `../Agent_Smith/wrangler.toml`, `../Agent_Smith/CONTRACTS.md`, `../Agent_Smith/BUS_CORE_REPORTING_CONTRACT.md`, and `../Agent_Smith/src/commands/` |
| BUS Core product producer | `../TGC-BUS-Core/SOT.md`, `../TGC-BUS-Core/OPERATIONS.md`, `../TGC-BUS-Core/CHANGELOG.md`, `../TGC-BUS-Core/core/telemetry/client.py`, `../TGC-BUS-Core/core/services/update.py`, `../TGC-BUS-Core/core/services/update_stage.py`, and `../TGC-BUS-Core/core/api/routes/telemetry.py` |
| BUS Core site producer | `../buscore-site/SOT.md`, `../buscore-site/CHANGELOG.md`, `../buscore-site/SITE_ANALYTICS_IMPLEMENTATION.md`, `../buscore-site/manifest/core/stable.json`, `../buscore-site/assets/js/site-analytics.js`, and `../buscore-site/tests/browser/deploy-analytics.test.mjs` |
| TGC site producer | `../tgc-site/SOT.md`, `../tgc-site/contracts/lighthouse-analytics-contract.md`, `../tgc-site/assets/js/telemetry.js`, and `../tgc-site/tests/telemetry-payload.test.js` |

Sibling paths above describe the audited local checkout layout. If a repository is absent, stop that cross-repository branch rather than searching unrelated locations. A checked-in buscore-site manifest is a repository release projection that can lag production; it is not live endpoint proof. BUS Core facts were last reconciled against released version `1.4.2`, and buscore-site source facts against its merged `1.4.2` release-sync change, on 2026-08-26. Agent Smith facts were reconciled on 2026-08-27 against deployed version `0.26.0`, merged `main` commit `5519764d959cf1d6a505280814c59e82854f9bda`, and the owner-confirmed CEO `1.1` `/report` check. Older Agent Smith SOT paragraphs that call `/report` a raw diagnostic product are superseded: in current production `ceo_v1`, the private `/report` command renders the CEO business/decision product. The retained `formatDiagnosticReport()` is test-only and has no command/runtime route.

## Deployed Resource Map

The following production identities were verified by approved read-only control-plane access on 2026-08-26 and the active deployment was reconciled again through the supplied approved 2026-08-27 audit receipt. Repository-controlled values are pinned in `wrangler.toml`; external attachments remain Cloudflare control-plane state.

| Binding, attachment, or trigger | Verified production resource | Authority and purpose |
|---|---|---|
| Cloudflare account | `eb1a8dd5723031d94e57642e3eaaebda` | Owning account; pinned in `wrangler.toml` |
| Worker service | `buscore-lighthouse` | Cloudflare Worker service |
| Compatibility | `2026-02-26`; `global_fetch_strictly_public` | Matches checked-in runtime compatibility configuration |
| `DB` | D1 `lighthouse`, ID `e46f2daa-7e97-45a3-9bf0-49003a42850c` | Primary aggregates and bounded evidence; name and ID reconciled in `wrangler.toml` |
| `BUSCORE_LEADS_DB` | D1 `buscore-leads`, ID `75c09145-ce89-418c-b0f0-92afa2835bfd` | Optional aggregate inquiry-report read binding |
| `MANIFEST_R2` | R2 bucket `bus-core` | Stable manifest and versioned release artifacts |
| `GITHUB_REPO` | `True-Good-Craft/TGC-BUS-Core` | Scheduled GitHub snapshot and release-probe repository |
| Production hostname | Custom Domain `lighthouse.buscore.ca` | Active Production Custom Domain; not a Worker Route and not declared in `wrangler.toml` |
| Production `workers.dev` | Enabled and public | Additional external surface; not the canonical consumer or diagnostic endpoint |
| Version and branch previews | Enabled | Externally reachable publication state; do not use as production truth or probe without endpoint-specific approval |
| Cron | `5 0 * * *` | Active at `00:05 UTC`; matches checked-in configuration |
| Persistent logs and traces | Disabled | No retained Worker log/trace evidence is available unless separately approved and enabled |

The 2026-08-26 control-plane inventory found active Worker secret names `ADMIN_TOKEN`, `CF_API_TOKEN`, `CF_ZONE_TAG`, `DISCORD_WEBHOOK_URL`, `IGNORED_IP`, `PRICE_GUARD_KEY`, and `TELEMETRY_RATE_LIMIT_SECRET`; values were not read or exposed. Version 1.30.0 added the optional `REPORT_READ_TOKEN` binding contract. The separately approved CEO read at `2026-08-27T15:08:12.012Z` proves that the deployed report-read path worked at that time, but it does not authorize another request, disclose a value, or prove later secret state. `DISCORD_WEBHOOK_URL` and `PRICE_GUARD_KEY` are not referenced by current source; retaining, rotating, or removing them is a separate secret operation requiring explicit approval.

Cloudflare currently displays the historical repository name `True-Good-Craft/buscore-lighthouse`; GitHub redirects it to `True-Good-Craft/lighthouse`. Package metadata now names the canonical repository, but changing the external integration label is a separate control-plane action.

## Repository Publication and Deployment Paths

| Path | Verified or repository-controlled behavior | Operational boundary |
|---|---|---|
| `.github/workflows/governance.yml` | Runs dependency installation, typechecking, and the full test suite for every PR and `main` push | Validation only; it does not deploy |
| `.github/workflows/deploy.yml` | Manual dispatch only; refuses non-`main` refs; serializes under `lighthouse-production`; runs install, typecheck, and tests before `wrangler deploy --keep-vars --strict`; attempts `wrangler deployments status --json` whenever the deploy step ran, including an uncertain reported failure | Sole repository-authorized production-promotion path; the external Workers Builds prerequisite was verified on 2026-08-26 |
| `npm run release:upload` | Runs `wrangler versions upload` | Creates external Worker-version or preview state without intentionally changing active traffic |
| `npm run release:status` / `release:history` | Read JSON deployment metadata using the pinned account context | Approved Class 1 control-plane reads only |
| Cloudflare Workers Builds, non-production | Verified `npx wrangler versions upload`; builds enabled; include rule `*`; previews enabled | A branch push creates external preview/version state |
| Cloudflare Workers Builds, production — pre-repair audit | Branch `main`; root `/`; no build command; `npx wrangler deploy`; cache enabled; no build variables or secrets | Automatically promoted the 1.29.3 merge; historical unsafe parallel production authority |
| Cloudflare Workers Builds, production — verified current state | Branch `main`; Deploy command `npx wrangler versions upload`; Version command `npx wrangler versions upload` | Durable readback after reload confirmed both values on 2026-08-26. No build, upload, or deployment was invoked; future pushes may create version state but must not promote traffic |

The checked-in manual workflow is the sole authorized production-promotion path. Cloudflare Workers Builds is restricted to version uploads by the verified external configuration. The availability and scope of GitHub's `CLOUDFLARE_API_TOKEN` must not be assumed from workflow text; a failed or unverified credential path is `ACCESS_BLOCKED`, not authorization to use another deployment path. Cloudflare Workers Builds uses separately managed integration credentials.

### Canonical Cloudflare control-plane read sequence

Use this sequence only after explicit approval for Cloudflare control-plane reads. It contacts Cloudflare but does not intentionally call Lighthouse endpoints or mutate D1/application evidence.

1. Select account `eb1a8dd5723031d94e57642e3eaaebda`, then select Worker `buscore-lighthouse`. If the Worker is absent under another account context, correct the account; do not classify that as a Lighthouse outage.
2. Read **Deployments** and record the active version ID, traffic percentage, creation time, source commit, and Workers Builds build ID. `npm run release:status` and `npm run release:history` are the repository-provided JSON alternatives for deployment metadata only.
3. Read **Builds** and record the connected repository label, production branch, root directory, build command, production deploy command, version command, non-production include/exclude rules, preview setting, cache setting, and build-variable/secret presence. The mandatory safe production command is exactly `npx wrangler versions upload`.
4. Read **Domains & Routes** and distinguish Custom Domains, Worker Routes, `workers.dev`, and preview URLs. `lighthouse.buscore.ca` is expected as a Production Custom Domain; an empty Worker Routes list is not a missing-domain diagnosis.
5. Read bindings, compatibility settings, and triggers. Match immutable D1 IDs and R2 bucket names against the resource map above; record secret names only, never values; verify cron `5 0 * * *` and both compatibility settings.
6. Read observability enablement separately. Disabled persistent logs/traces means retained evidence is unavailable; it is not proof that no application error occurred.
7. Treat the Worker overview's invocation and platform-error counters as platform telemetry only. A zero platform-error count does not prove Lighthouse application, report, source, probe, or delivery health.
8. Report each fact with its timestamp and classify any inaccessible surface as `ACCESS_BLOCKED`. Do not compensate by calling public or protected Worker endpoints, tailing logs, querying D1 rows, changing settings, uploading a version, or deploying without the corresponding separate approval.

### Production rollback and receipt sequence

A version upload needs no traffic rollback because it does not intentionally promote traffic; its external version/preview state remains part of the publication record. A production deployment rollback is a separate production mutation and is never implied by deployment approval.

1. Confirm that no `lighthouse-production` workflow run, Workers Builds production job, direct deployment, or rollback is in progress. GitHub concurrency serializes only that workflow; it cannot prevent a direct Wrangler or Workers Builds race. If any production mutation is active or uncertain, stop and wait.
2. With approved Class 1 access, read deployment status/history and record the current version, traffic split, and exact immutable candidate rollback version ID. Never select a rollback target by package label, timestamp guess, or branch name.
3. Obtain explicit owner approval naming that version ID. For the first 1.31.0 production promotion, the audited pre-change candidate is 1.30.0 version `ab29c0fb-ca9e-4074-a379-18d0943ec02c`, but it must still be present and verified before use.
4. Run `npx wrangler rollback <verified-version-id> --message "<reason>"` only under that approval. Do not add `--yes`; preserve the interactive confirmation boundary.
5. Read `npm run release:status` and verify that the intended version receives the expected traffic. Record the JSON receipt and time. A successful command without the readback is not rollback proof.
6. Reconcile repository source separately. Reverting a deployment does not revert Git, Cloudflare Workers Builds settings, secrets, custom domains, D1 data, or migrations. Version 1.29.4 has no migration, so its release-control rollback requires no D1 rollback.

The pre-merge Workers Builds repair was completed on 2026-08-26: the prior production value `npx wrangler deploy` was replaced with `npx wrangler versions upload`, and reload/readback confirmed that both Deploy and Version commands exactly match the new value. No build, upload, or deployment was invoked. Restoring the prior value requires new explicit external-change approval and immediately reinstates `BLOCKED BEFORE MERGE`; it must never occur as an automatic fallback.

`tgc-ops` is not yet safe as an analytics source of truth: its current records include stale future-tense BUS Core telemetry claims and a reversed Lighthouse/buscore-site dependency. Use owning repositories until that separate repository is explicitly reconciled.

## Credentials and Access Boundaries

| Name | Where used | Boundary |
|---|---|---|
| `ADMIN_TOKEN` | Lighthouse runtime | Exact-match credential accepted through `X-Admin-Token`; authorizes reports and the three protected writes |
| `REPORT_READ_TOKEN` | Lighthouse runtime | Optional independently generated, cryptographically random, distinct 32-to-128-character URL-safe-ASCII secret accepted through `X-Report-Token` for `GET /report` only; never accepted by an administrative write |
| `LIGHTHOUSE_REPORT_READ_TOKEN` | Local diagnostic helper process | Optional automation input satisfying the same format for `npm run --silent diagnostic:ceo`; captured and removed from that process environment immediately, never loaded from `.env` |
| `LIGHTHOUSE_ADMIN_TOKEN` | Agent Smith runtime | Consumer-side name for the Lighthouse admin credential |
| `LIGHTHOUSE_REPORT_URL` | Agent Smith runtime | Canonical report endpoint; checked-in production value points to `https://lighthouse.buscore.ca/report` |
| `CF_API_TOKEN` and `CF_ZONE_TAG` | Lighthouse scheduled traffic capture | Cloudflare GraphQL traffic source, not report authentication |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions production workflow | Separately scoped Wrangler deployment credential; presence and scope are not proven by repository text. It is not the Worker runtime `CF_API_TOKEN` |
| `GITHUB_REPO` and optional `GITHUB_TOKEN` | Lighthouse scheduled GitHub snapshot/probe configuration | Repository selection and optional API quota; not Lighthouse report authentication |
| `TELEMETRY_RATE_LIMIT_SECRET` | Lighthouse ingestion/release counting | Keys rotating abuse-control identifiers; never a diagnostic credential |

`ADMIN_TOKEN` is not a read-only credential. It remains a backward-compatible report credential and is the only credential accepted by the mutating `POST /campaign`, `POST /notes`, and `POST /report/snapshot` routes. `REPORT_READ_TOKEN` grants GET-report authorization only when it is independently generated, cryptographically random, contains 32 to 128 URL-safe ASCII characters (`A-Z`, `a-z`, `0-9`, `_`, and `-`), and differs from `ADMIN_TOKEN`, but it does not make the report implementation zero-write. A malformed report secret disables that path while preserving a distinct admin fallback; identical non-empty admin/read secrets intentionally fail every protected read and write closed before database or deferred work. Possession of either credential does not itself authorize a production request. Do not paste a production value into commands, logs, chat, files, screenshots, or `.env`; `.dev.vars.example` contains non-secret local placeholders and is not read by the diagnostic helper.

### 1.30.0 deployment receipt and auth rollback boundary

The 1.30.0 credential split is deployed as Worker version `ab29c0fb-ca9e-4074-a379-18d0943ec02c` at 100% traffic under deployment `526f9fbc-6432-466c-9b39-2ae90b299cae`. The approved CEO read at `2026-08-27T15:08:12.012Z` validated the production read path without exposing the credential. This receipt does not authorize another request or secret operation.

Rolling back below Lighthouse 1.30.0 restores the prior admin-only report-read behavior and does not roll back secret state or another repository. A read-token-only client will receive `401` after such a rollback; use the retained, separately authorized admin fallback only as an intentional compatibility path, not an automatic retry. Secret removal or rotation is a separate destructive security operation and is not implied by code rollback.

Agent Smith is not least-privilege after this Lighthouse-only change: it still needs `LIGHTHOUSE_ADMIN_TOKEN` for `POST /report/snapshot`. Splitting its report reads without first separating that write leaves the broad credential in the same runtime. A snapshot-specific credential or removal of the archive write requires a later owner-approved Agent Smith/Lighthouse contract change before the broad Smith secret can be removed and `ADMIN_TOKEN` rotated.

### 1.31.0 CEO contract rollout and rollback boundary

The local 1.31.0 bundle changes the CEO response contract to `1.2` while leaving metric definitions at `1.1`. It performs no production request, secret operation, migration, upload, deployment, or traffic change. Roll out in reversible order, with each external step under its own approval:

1. Validate the complete local Code + contracts + SOT + CHANGELOG + Version bundle, including strict schemas/fixtures and helper validation for both CEO `1.1` and `1.2`.
2. **Compatibility deployed; exact parity pending:** Agent Smith `0.26.0` accepts both response versions, retains `1.1`, passed CI/deployment and Discord command registration at merged commit `5519764d959cf1d6a505280814c59e82854f9bda`, and the owner confirmed `/report` works against active CEO `1.1`. The final Lighthouse audit then added one strict `1.2` rejection for non-null inquiry totals when that source is unavailable. Deploy and verify the matching Agent Smith validator patch before continuing to step 3.
3. Only after step 2 is proven, promote the approved Lighthouse 1.31.0 Worker through the sole authorized production workflow and obtain the immutable deployment receipt.
4. With separate Class 2 endpoint approval, run exactly one `npm run --silent diagnostic:ceo` request and verify strict CEO `1.2`, metric-definition version `1.1`, activity-basis source states, scheduled-probe sparse-history states, and aggregate inquiry-record diagnostics without exposing the credential.

If the 1.31.0 Worker must be rolled back, select and explicitly approve the still-present immutable 1.30.0 version ID, follow the production rollback/receipt sequence above, and expect CEO contract `1.1` again. The dual-version helper and Agent Smith consumer must continue to accept `1.1`; do not roll them back merely because Lighthouse was rolled back. Version 1.31.0 has no migration, secret, route, auth, binding, storage, retention, or schedule change, so those domains require no rollback. Agent Smith is a rollout prerequisite but is not a runtime dependency: Lighthouse remains independently runnable if Smith is unavailable.

## Diagnostic Access Classes

### Class 0 — local zero-mutation

Safe default:

- Read the authority files and CEO fixtures.
- Inspect `wrangler.toml`, route code, tests, and migrations.
- Run local searches and `git status`.
- Review a supplied alert/report without contacting any service.

This class changes neither local tracked files nor external state.

### Class 1 — approved control-plane reads

Cloudflare deployment, route, binding, cron, log, or D1 metadata reads may establish infrastructure state without intentionally changing Lighthouse application data. They still require explicit authorization, account `eb1a8dd5723031d94e57642e3eaaebda`, and the least-privileged supported command. Use the canonical control-plane read sequence above. A Cloudflare/Wrangler access failure is infrastructure evidence, not a Lighthouse application failure.

Do not use direct D1 SQL as a fallback merely because a protected report cannot be accessed. SQL can bypass report semantics, expose data outside the contract, or be accidentally executed as a write.

### Class 2 — approved read-mostly report calls

These protected views skip the best-effort Cloudflare traffic refresh and read currently persisted evidence:

| Request | Primary use |
|---|---|
| `GET /report?view=ceo` | First diagnostic read; strict CEO `1.1` (active 1.30.0/rollback) or `1.2` (1.31.0 target) facts, windows, source state, limitations, failures, and latest service probes; metric definitions remain `1.1` |
| `GET /report?view=source_health` | Ingestion integrity by tracked site; not service-probe truth |
| `GET /report?view=asset` | Stored Phase 2 rollup, GitHub snapshot, service checks, and campaign evidence |
| `GET /report?view=tgc` | Detailed TGC compatibility diagnostics |
| `GET /report?view=monthly` | Historical monthly asset/scoring compatibility surface |

These are read-mostly, not guaranteed zero-write: if report assembly throws, Lighthouse best-effort increments `metrics_daily.errors` before returning `503 report_unavailable`.

For the CEO row only, the canonical operator mechanism is `npm run --silent diagnostic:ceo`. The helper has a fixed production URL, `Accept: application/json`, and `X-Report-Token`; makes at most one request with no retry or redirect; rejects non-200 responses; times out after 15 seconds; caps the response at 1 MiB; and selects the strict schema by `report_contract_version`, accepting exactly `1.1` or `1.2` with `metric_definition_version: "1.1"` before emitting pretty-printed JSON plus one newline. Cross-version shapes and every other contract version fail closed. It accepts a 32-to-128-character URL-safe-ASCII credential through either a hidden TTY prompt or `LIGHTHOUSE_REPORT_READ_TOKEN` supplied by an approved non-echoing automation environment, and removes that environment variable immediately after capture. It accepts no arguments, URL override, token file, report file, or `.env`. Noninteractive failures are nonzero and finite: missing/invalid credentials or HTTP `401`/`403` emit `Lighthouse CEO diagnostic access blocked.`; HTTP `503` emits `Lighthouse CEO report unavailable; metrics_daily.errors may have been incremented.`; every other transport, response-safety, parse, schema, or output failure emits `Lighthouse CEO diagnostic failed.`. No response body, numeric HTTP status, schema detail, or token reaches output. These controls protect credential handling but do not authorize the request or remove the possible error-counter side effect.

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
| `git push` to a non-production branch | Verified Workers Builds configuration runs `npx wrangler versions upload` and can create externally reachable version/branch previews |
| Historical 1.29.3 merge before the external repair | Workers Builds ran `npx wrangler deploy` and promoted production independently of the checked-in GitHub Actions gate |
| Merge or push to `main` after the verified 2026-08-26 repair | Workers Builds runs `npx wrangler versions upload`; it creates external version state but must not promote traffic |
| Scheduled handler, D1 command, migration, secret operation, deployment, release | Operational mutation requiring separate explicit approval |

The existence of a route in `README.md` or `SOT.md` is not authorization to probe it.

## Canonical Morning Diagnostic Sequence

Use this order for a Lighthouse `WATCH`, `ALERT`, unavailable report, or analytics concern:

1. **Preserve the initiating evidence.** Record the exact message, timestamp, timezone, delivery lane, requested window, and whether it came from Agent Smith `/health`, `/report`, a scheduled Discord message, Cloudflare, or another surface.
2. **Classify the layer before probing.** Separate report preparation, Lighthouse facts, scheduled service probes, source ingestion, Agent Smith presentation, Discord delivery, and Cloudflare access.
3. **Read local authority.** Read `AGENTS.md`, `SOT.md`, this runbook, the relevant changelog entry, and the CEO schema/fixture matching the observed state. If `source_health` or supplied evidence identifies a producer, also read that producer's canonical files listed above.
4. **Confirm authorization and access material.** Use only the approved production endpoint and the repository's fixed non-echoing helper with an owner-approved report-read credential mechanism. Agent Smith's Cloudflare runtime binding is not a user-facing diagnostic credential source. Never reveal or copy a credential. If the endpoint, mechanism, authorization, or deployed/provisioned `REPORT_READ_TOKEN` is unavailable, report `ACCESS_BLOCKED` and continue only with local evidence.
5. **Read the CEO view first only when both production access and a safe credential mechanism are approved.** Run exactly `npm run --silent diagnostic:ceo`; do not recreate its request with a broader command, substitute an admin credential, add arguments, redirect output to a file, or retry automatically. On validated success, inspect `report_contract_version`, require `metric_definition_version: "1.1"`, then inspect `generated_at`, exact windows, `sources`, `details.service_probes`, `details.voluntary_inquiry_records` when present, and `limitations` before interpreting totals. For contract `1.2`, interpret direct `freshness_basis: "activity"` separately from `service_probes.freshness_basis: "scheduled_probe"`; do not turn activity silence into health or failure. Classify `Lighthouse CEO diagnostic access blocked.` as `ACCESS_BLOCKED`; classify `Lighthouse CEO report unavailable; metrics_daily.errors may have been incremented.` as report-unavailable application evidence with the stated possible mutation; classify generic `Lighthouse CEO diagnostic failed.` as an unresolved transport/safety/contract failure. None permits response exposure, an alternate endpoint, or an automatic retry.
6. **Narrow to one secondary view only when evidence requires it.** Use `source_health` for producer-ingestion integrity, `asset` for stored probe/GitHub/rollup detail, or `tgc` for the TGC compatibility diagnostic. The fixed CEO helper cannot select these views, so their production access remains `ACCESS_BLOCKED` unless a separately approved endpoint scope and non-echoing mechanism are provided; do not alter the helper or improvise a raw request. Do not fan out across every surface.
7. **Check Agent Smith separately.** Confirm configured mode and active lane. Production is checked in as `ceo_v1`. A Smith `/health` response can show its configuration and CEO readiness; it does not independently prove Discord delivery, Lighthouse cron completion, TGC source freshness, or monthly archive success.
8. **Correlate by timestamp and ownership.** Compare the alert time, CEO `generated_at`, each source's `freshness_basis` and `data_through`, probe `checked_at` values, and the applicable complete or partial window. In contract `1.2`, direct-source `data_through` is an activity watermark—possibly a conservative composite or bounded day-bucket timestamp—not a scheduled heartbeat; only a complete scheduled-probe set supports the 36-hour fresh/stale classification. Do not compare partial today with a complete day as though they were equivalent.
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
| `voluntary_inquiries` | Aggregate reads from optional `BUSCORE_LEADS_DB` | Unique lead-record totals windowed by `created_at`, fixed privacy-safe attribution buckets, and aggregate record diagnostics; never submissions, people, raw lead data, or PII |
| `lighthouse_errors` | `metrics_daily.errors` | Best-effort counter updated only by selected route failures: manifest GET, `/update/check`, `/download/latest`, and report assembly. It is not a complete Worker error log: manifest HEAD, artifact-route failures, product-ingest failures, and scheduled-probe failures do not increment it |
| `service_probes` | Latest active rows in `health_checks` | Scheduled liveness evidence for six named surfaces; only a complete target set supports the oldest-target 36-hour fresh/stale rule |

In CEO contract `1.2`, every direct aggregate row above uses the activity freshness basis. Its `data_through` is an activity watermark, not proof of current producer, transport, or ingestion health. A single-component watermark is its latest trusted observation. A composite watermark is present only when every required component has evidence and uses the conservative earliest required-component watermark. A date-only daily-bucket watermark is normalized to the end of a completed UTC day, or bounded by report generation for the current/future day; it is a reporting bound rather than an exact event timestamp. `service_probes` alone uses the scheduled-probe basis. The two bases are not interchangeable.

`GET /report?view=source_health` is ingestion-integrity evidence. It reports recent accepted signals and persisted drop counters by tracked site. It is not the service-probe table and must not be used as proof that the manifest, artifact, lead, GitHub, or site endpoints are currently reachable.

Update-check aggregates include only GET requests whose query contains exactly one each of `current_version`, `channel`, and `first_check`; whose channel and versions are valid and plausible (`current_version >= 1.4.0` and not newer than the selected manifest release); and whose unsuppressed client IP, configured rate-limit secret, and two-per-IP/day gate permit counting. Successful manifest reads that fail any gate—including BUS Core staging's parameterless manifest read—are not counted.

For producer-side BUS Core product-telemetry truth, use the protected read-only `GET /app/telemetry/status` only with an authorized local BUS Core session and `settings.read` permission. It exposes enabled, pending, acknowledged, rejected, dead-letter, and last-delivery state. Do not use BUS Core `/transparency.report` or the Home “Telemetry Off” card as telemetry-health evidence. A queued retry does not self-wake when `next_attempt_at` arrives; delivery resumes only when a later emit or startup flush starts the worker, so an aging pending item does not by itself prove an ongoing Lighthouse outage.

Producer-specific comparisons are not one-to-one:

- BUS Core site emission is suppressed by `dev_mode` or `localStorage.noAnalytics === "1"` and deduplicates same-path page views within three seconds. It has no producer-side origin guard or `test_mode` label, so an unsuppressed local/staged page can attempt the production endpoint even though Lighthouse may reject it.
- TGC emission requires current optional-analytics consent, honors GPC/DNT and `dev_mode`, refuses non-production origins, and can label `test_mode` traffic for report exclusion. A quiet `tgc_site` source can therefore reflect consent/suppression rather than emitter or Lighthouse failure.
- BUS Core's primary `/download/latest` CTA intentionally emits no `download_click`; only exact versioned Lighthouse artifact links qualify. Website click evidence and artifact delivery should not be expected to match.
- Early-access success may emit `early_access_submit_success`, but suppression can prevent it. Managed BUS success emits no dedicated Lighthouse success event. CEO inquiry totals count unique lead records by `created_at`; a later legitimate submission may update an existing email's record, but it is not counted as a new inquiry record and does not move that record into a later created-at window. `last_updated_at` is an aggregate diagnostic only. Row totals are not submissions or people.
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

CEO contract `1.2` separates query availability from history completeness. A successful query with zero active-target rows is source `available`, freshness `unknown`, reason `probe_history_missing`, `data_through: null`, and empty probe details. A successful query with fewer than all six active targets is source `available`, freshness `unknown`, reason `probe_history_incomplete`, preserves the observed details, and uses the latest observed `checked_at` as `data_through`. Query failure alone is `unavailable` and makes probe details `null`. When all six targets are present, the oldest target timestamp is `data_through`; no older than 36 hours is `fresh`, and older than 36 hours is `stale`/`probe_data_stale`. These response semantics do not change probe execution or create a canary.

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
| `freshness_basis: "activity"` (`1.2`) | Direct aggregate source state. `data_through` is a single-source or conservative composite activity watermark; a date-only bucket becomes a bounded reporting timestamp. It is not a heartbeat, exact event time, completeness proof, or producer-health result. |
| `unknown` / `activity_only` (`1.2`) | The direct query succeeded and has at least one observation. Activity age alone cannot classify the source fresh or stale. |
| `unknown` / `source_history_missing` | The direct query succeeded but no trustworthy observation watermark exists. This is not a failed current endpoint. |
| `freshness_basis: "scheduled_probe"` (`1.2`) | Scheduled six-target probe state. Only this basis can be fresh/stale under the 36-hour rule. |
| `unknown` / `probe_history_missing` (`1.2`) | The probe query succeeded with zero active-target rows; source is available and details are empty. |
| `unknown` / `probe_history_incomplete` (`1.2`) | The probe query succeeded with only part of the active target set; observed rows remain visible, but no whole-set freshness claim is allowed. |
| `stale` / `probe_data_stale` | All six scheduled targets are present and the oldest required target is more than 36 hours old. Narrow the exact target before inferring impact. |
| `stale` / `source_data_stale` (`1.1` only) | Historical rollback-contract direct-source classification. Contract `1.2` replaces it with activity-only/unknown; never apply this 1.1 label to a 1.2 direct source. |
| Coverage `partial` | The source does not establish complete coverage for the whole requested window, often because it is sparse or began later. Partial coverage is expected for multiple current sources and is not automatically an error. |

Additional failure boundaries:

- HTTP `401 unauthorized` from `/report` proves a missing/malformed/mismatched credential or a fail-closed admin/read-secret collision at that request boundary; it does not prove the Worker is down.
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
- Source availability, `freshness_basis`, freshness, coverage, `data_through`, and reason code; identify whether the response is contract `1.1` or `1.2` before interpreting those fields.
- Latest named service-probe states and `checked_at` times.
- Proven impact, likely layer, and alternative explanations.
- Whether any diagnostic request could have changed evidence.
- Confidence level, remaining unknowns, and the smallest approval-gated next action.

Never report a WATCH as an outage, an access failure as application failure, a sparse zero as confirmed inactivity, a download response as a person/installation/completed transfer, an update check as an active user, or `source_health` as endpoint liveness.

## Known Gaps — Do Not Work Around

- Lighthouse 1.31.0 and CEO contract `1.2` are local until an explicitly approved production promotion produces a new deployment receipt. Active production remains 1.30.0/CEO `1.1`; do not diagnose the absence of 1.2 fields there as drift.
- Agent Smith `0.26.0` proves deployed dual-version compatibility and CEO `1.1` rollback operation, but its pinned `1.2` validator predates the final unavailable-inquiry-count rejection. It accepts every valid Lighthouse output, yet exact strict-schema parity remains pending. Retain `1.1`, do not weaken Lighthouse validation or remove the rollback schema, and report `BLOCKED BEFORE LIGHTHOUSE 1.31 PROMOTION` until the matching Agent Smith patch is deployed and verified.
- The helper safely consumes a credential but is not a credential-retrieval system. There is still no owner-approved operator secret-retrieval mechanism; do not copy a value from Agent Smith, Cloudflare displays, shell history, files, or another service.
- Agent Smith still holds the broad `LIGHTHOUSE_ADMIN_TOKEN` because it archives monthly snapshots. Full cross-service least privilege remains blocked on a later snapshot-specific credential split or removal of that write.
- The active `lighthouse.buscore.ca` attachment is an externally managed Production Custom Domain rather than checked-in route configuration. It was verified on 2026-08-26, but future attachment changes require another control-plane read.
- Cloudflare Workers Builds commands remain externally managed rather than checked into this repository. Durable readback on 2026-08-26 verified both production Deploy and Version commands as `npx wrangler versions upload`. If that setting becomes inaccessible or differs, report `BLOCKED BEFORE MERGE` until it is reconciled.
- The checked-in manual deployment workflow is the sole authorized production path. Successful release run `33086080869` proved its configured GitHub `CLOUDFLARE_API_TOKEN` could perform the approved 1.30.0 deployment at that time; current availability or broader scope must not be inferred from that historical success.
- Persistent Worker logs and traces are disabled, limiting retained runtime diagnostic evidence.
- Unused legacy secret names `DISCORD_WEBHOOK_URL` and `PRICE_GUARD_KEY` remain attached. Do not inspect, rotate, or remove them without separate approval.
- Cloudflare displays the historical redirecting repository name `True-Good-Craft/buscore-lighthouse`; package metadata now points to canonical `True-Good-Craft/lighthouse`, but the external label remains unreconciled.
- The current lockfile install reports one low- and five high-severity npm audit findings. Their production relevance and safe remediation are unassessed; handle them in a separate dependency audit and never run an automatic audit fix as part of incident diagnosis or release-control repair.
- `tgc-ops` analytics/dependency records are stale and cannot yet serve as the trusted cross-repository entry point.
- BUS Core `1.4.2` has an explicit producer-side code/SOT authority conflict: its code emits repeatable `restore_attempted`, `restore_completed`, `import_completed`, and `import_failed` events, and the current Lighthouse contract accepts them, but they remain outside BUS Core's SOT-authorized signal set. Lighthouse acceptance does not resolve producer authority. Treat their presence as known drift, not approval or a new metric definition; use BUS Core's SOT, operations runbook, and changelog as authority pending separate resolution.
- Agent Smith exposes no raw diagnostic command. Its retained diagnostic formatter is test-only; current private `/report` is the active business/decision product.
- Browser producers are fail-soft and provide no end-to-end delivery receipt.
- Agent Smith has no independent Discord receipt ledger; a post attempt, log line, or archived monthly snapshot is not receipt proof.

Any additional helper, further token split, further route/config change, cross-repository index repair, receipt mechanism, or automated drift check is a separate future change requiring its owning repository's approval and governance bundle.

## Approval Boundaries

Separate approval is required before:

- Any production endpoint or external-service request.
- Any invocation of `npm run --silent diagnostic:ceo` against its fixed production endpoint, even when a read token is already available; it is a Class 2 request and can increment error evidence on report-assembly failure.
- Any Cloudflare control-plane, log, or D1 access, including `release:status` and `release:history`.
- Any endpoint in Class 3.
- Any commit, branch push, or PR merge. A branch push creates external Worker-version or preview state.
- Any `release:upload`; it creates Cloudflare version state even though it does not intentionally promote traffic.
- Any manual production deployment-workflow dispatch; it is an active-production deployment operation. Direct `wrangler deploy` is not an authorized alternate path.
- Any Cloudflare Workers Builds setting change, custom-domain or route change, observability change, secret operation, direct SQL, migration, scheduled invocation, release, or cross-repository edit.
- Provisioning, verifying, removing, or rotating `REPORT_READ_TOKEN` or `ADMIN_TOKEN`, and any Agent Smith credential migration or snapshot-auth change.
- Any merge when the last approved Workers Builds readback is missing, superseded by a later setting change, or differs from exactly `npx wrangler versions upload`. Report that state as `BLOCKED BEFORE MERGE`. The last durable verification was 2026-08-26.

With the Workers Builds production command verified as `npx wrangler versions upload`, a merge still requires explicit owner approval and still creates external version state, but it must not be treated as a production release. Production promotion remains a separate, explicit manual action.

When authorization covers only read-only diagnosis, stop before the first action that can mutate evidence, configuration, version state, or traffic and ask for the narrower additional approval.
