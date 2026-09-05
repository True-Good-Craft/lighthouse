# Kingston Food Help analytics contract

Version: ingestion `1`, report `1.0`; Lighthouse `1.32.0` review candidate, 2026-09-04.

The owner authorized staging and review PRs. No migration, deployment, secret operation or website collection has been activated. Kingston's approved product policy remains the privacy ceiling; this implementation intentionally collects less context. Lighthouse owns measurements; Agent Smith owns the private `/kfh` presentation.

## Ingestion

`POST /metrics/event`, with `Origin` exactly `https://kingstonfoodhelp.ca` or `https://www.kingstonfoodhelp.ca`. These origins are registered with the dedicated `kfh_daily` reporting profile and `event_only` support class. No Pages preview, HTTP, localhost, wildcard or foreign origin is accepted. CORS does not allow credentials for Kingston. The browser must send with credentials omitted and no referrer.

The Kingston-origin path reads at most 1,024 UTF-8 bytes and accepts only this exact common object:

```json
{"site_key":"kingston_food_help","contract_version":1,"consent":true,"page":"directory","event_name":"page_view","source":"facebook","campaign":"launch_2026_09","content":"post_01"}
```

| Event | Allowed event value | Daily counter |
| --- | --- | --- |
| `page_view` | No `event_value` field | `page_views` |
| `contact_click` | `resource_call` | `resource_calls` |
| `contact_click` | `help_211` | `help_211` |
| `outbound_click` | `directions` | `directions` |
| `outbound_click` | `official_source` | `official_sources` |
| `pwa_install` | No `event_value` field | `pwa_installs` |

Only page views may include `source`, `campaign` or `content`. The exact allowlists are:

- Source: `direct_unknown`, `facebook`, `community`, `search`, `other`. Missing defaults to `direct_unknown`.
- Campaign: `none`, `launch_2026_09`. Missing defaults to `none`.
- Content: `none`, `post_01`, `poster_01`. Missing defaults to `none`.

These are public campaign/creative labels, never group names, neighborhood tags or personalized links. Additional campaign labels require a governed change to both pinned contracts and the database constraint. Source, campaign and content are separate marginal counts: no join among these dimensions or with an action is retained.

Unknown keys, unknown values, malformed JSON, wrong site/version/page, absent affirmative consent, or explicit HTTP `Sec-GPC: 1` / `DNT: 1` are dropped. Kingston-origin requests cannot impersonate an existing raw-event site. A Kingston site key from any other origin also cannot enter raw-event storage. No resource identifier/name, telephone, address, search, filter, eligibility, typed content, coordinates, URL, referrer, client timestamp, viewport, language, timezone, country, identity, test flag, device or request identifier is accepted. Server time supplies only the UTC day.

The producer must still enforce default-off affirmative consent, GPC/DNT overriding older preferences, presence-based `dev_mode` suppression, `noAnalytics` suppression, production-origin-only emission, and a non-blocking site. There is no server-side proof that a consent assertion or event comes from a human. No offline queue, retry, delayed replay, service-worker caching or background tracking is permitted. The website producer and public consent wording are not part of this backend PR and remain disabled.

## Storage and failure behavior

Migration `0016_add_kfh_daily.sql` creates `kfh_daily(day, metric, value, count)`, a constrained aggregate-only table with no raw event rows. Event increments and the three page-view dimension increments use one atomic D1 batch. Action rows have no attribution. SQL constraints reject unsupported dimensions and values.

Counting requires a client IP, the existing rate-limit secret, a non-ignored IP, and allowance under 50 events per IP per UTC minute. A keyed HMAC includes the Kingston scope and minute; raw IPs are never persisted. This is an approximate abuse control, not deduplication, identity or a unique-person measurement. Repeated clicks may count, and shared-network activity can be undercounted. The keyed bucket exists only in the existing rate table for about two days. An aggregation failure can consume rate allowance without recording activity.

Kingston stores zero raw accepted or dropped events. Daily aggregates retain the current UTC day and previous 399 days. The existing daily cron gains an independently fail-soft prune task; cadence and other tasks are unchanged. Reports exclude older days even if cleanup has been delayed. Pruning is not performed by a report read.

All public ingestion responses remain empty `204`, including rejected and failed submissions. `204` is transport completion, not a persistence acknowledgement. Missing rate storage or aggregate storage drops the event. Kingston failure logs are static and contain no payload, error object, IP, secret or raw context.

## Protected report

`GET /report?view=kfh` uses the existing report-read authorization. The optional GET-only `X-Report-Token` path and compatible admin path retain existing collision/fail-closed rules. The response is `Cache-Control: no-store`; there is no browser read-token CORS expansion.

The exact shared TypeScript contract and strict runtime validator are `src/kfhContract.ts`, copied unchanged into Agent Smith `src/contracts/kfhContract.ts`. Representative producer fixtures are `contracts/kfh-v1/{sample,empty,unavailable}.json`. Contract copies and fixtures must be updated and reviewed together. The report never falls back to BUS Core, TGC or CEO data.

| Window | UTC day span relative to generation day |
| --- | --- |
| `today` | Today, partial as of `generated_at` |
| `latest_complete_day` | Yesterday |
| `last_7_complete_days` | Days -7 through -1 |
| `previous_7_complete_days` | Days -14 through -8 |
| `last_30_complete_days` | Days -30 through -1 |

Each window has exact dates, an explicit partial flag, and all six counters. A successful empty query yields zero **observed** counts and `no_observed_history`; failed, incompatible or missing storage yields null counts, null discovery and `query_failed`. These are not zero audience or outage assertions. First/last observed days describe retained activity only, not launch time, complete coverage, source health or reachability.

`discovery_last_7_complete_days` reports only page-view source/campaign/content totals. Each dimension independently reconciles to the page-view total. Strict validation rejects unknown fields, unsafe numbers, wrong site/version, conflicting windows and invented coverage. Every report explicitly limits interpretation to observed consented activity; clicks are not completed calls, visits, installs, households or food received. There are no visitor counts, sessions, retention, engagement duration, conversion rates or population estimates.

The dedicated report does not perform Cloudflare traffic refresh, probe, snapshot or outbound posting. It catches Kingston storage failure locally. Unexpected outer report-assembly failure retains Lighthouse's existing possible global error-counter side effect, so production reads still require explicit scope.

Kingston is deliberately excluded from raw-event `view=fleet` and `view=source_health`; legacy and `view=site` selectors reject its key. This preserves those contracts without manufacturing raw-event zeroes or a heartbeat. Use `view=kfh` for Kingston. CEO contracts and existing clients are unchanged.

## Review, rollout and rollback

1. Review both PRs and the matching contract/fixtures. Run typecheck, the existing suites, new privacy/SQL/command tests, and Smith governance/bundle checks.
2. Separately approve and verify migration 0016 on the intended D1 before any Lighthouse promotion. Local SQL tests are SQLite WASM through a D1-shaped adapter; they do not prove remote D1 deployment or native Worker lifecycle.
3. Preserve the existing CEO consumer-first parity gate. Smith already contains the 0.26.1 validator patch; verify the required consumer deployment before promoting a Lighthouse version that emits CEO 1.2.
4. Coordinate owner-approved Smith merge/deployment/Discord registration and Lighthouse promotion. Smith's main merge can auto-deploy; Lighthouse publication may upload a preview/version. No PR merge, manual promotion, migration or live verification is performed by this review work.
5. If separately approved, provision Smith's optional GET-only read credential from the existing Lighthouse capability. Do not rotate/remove the broad credential still used for monthly snapshots.
6. Review and verify the separate default-off website producer/consent change before collecting anything. Cloudflare Web Analytics remains off. After authorized deployment, validate rejected payloads and controlled aggregate persistence without claiming a 204 proves storage.

Rollback is an explicitly approved Worker/consumer operation, not a destructive database change. Retain the additive table; prior workers ignore it. Disable website emission first if it was activated. An older Lighthouse returns an unavailable `/kfh` product in Smith; existing BUS Core/CEO rollback compatibility remains intact. Daily retained aggregates cannot be attributed to individual visitors or selectively removed by an identity that is never stored.

## Verification ownership

`tests/kfh-analytics.test.mjs` covers strict ingestion, privacy rejection, real SQLite constraints/atomic rollback, route suppression/rate failure, report windows, null/zero honesty, retention, auth and no external refresh. Existing tests cover preserved clients and CEO contracts. `sql.js` is a pinned test-only dependency; production runtime dependencies are unchanged.
