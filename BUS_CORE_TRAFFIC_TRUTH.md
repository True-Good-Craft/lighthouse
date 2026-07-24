# BUS Core Traffic Truth

This document is the source of truth for BUS Core public artifact delivery and demand reporting. It is additive to `SOT.md`. If an older label conflicts with these definitions, this document governs new fields while the older field remains a compatibility value.

## Non-negotiable product behavior

- Public manifests, update checks, `/download/latest`, and versioned release artifacts remain public. No login, email gate, Turnstile challenge, or lead form may be inserted into artifact delivery.
- Abuse controls must reduce avoidable origin/storage work without manufacturing scarcity or improving a metric by rejecting ordinary demand.
- A request is never a person. An IP-derived bucket is never a person, user, installation, or completed download. A successful response is not proof that the client retained or opened every byte.

## Route inventory and ownership

| Route or event | Owner | Delivery behavior | Measurement class |
| --- | --- | --- | --- |
| `GET /manifest/core/stable.json` | Lighthouse Worker + R2 | Public cached manifest | Delivery only; not artifact demand |
| `GET /update/check` with the exact BUS Core client tuple | Lighthouse Worker + R2 | Public, `no-store` manifest response | Known/unknown version check signals; not artifact traffic |
| Bare or malformed `/update/check` | Lighthouse Worker + R2 | Public manifest or controlled error | Not a qualified update signal |
| `GET /download/latest` | Lighthouse Worker + R2 | Public 302 to a canonical versioned artifact | Successful redirect only; not an artifact response |
| `GET /releases/<canonical>.zip` | Lighthouse Worker + R2/cache | Public 200 or 206 | Raw artifact request and response-layer counters |
| `HEAD /releases/<canonical>.zip` | Lighthouse Worker + R2 metadata | Public metadata response with no body | Raw and HEAD counters; never successful artifact response |
| Invalid or missing release path | Lighthouse Worker | Controlled 404 | Raw valid-route request only when the filename is canonical; failed response |
| Site `download_click` | BUS Core site -> Lighthouse event ingest | Best-effort anonymous intent event | Raw intent; probable-human proxy only after acceptance and daily deduplication |
| `POST /api/early-access` | BUS Core site Worker + leads D1 | Same-origin, Turnstile-validated production lead | Voluntary lead only |
| `POST /api/managed-bus-inquiry` | BUS Core site Worker + leads D1 | Same-origin, Turnstile-validated production inquiry | Voluntary lead only |
| `POST /telemetry/v1/events` | BUS Core app -> Lighthouse Worker + D1 | Optional strict event ingest with exact event-ID acknowledgement after idempotent persistence | Acknowledged opted-in product signal |

Known health checks, update checks, manifest reads, and internal/test traffic are excluded from artifact counters because they do not match the canonical release route. The configured ignored IP is also excluded from deduplicated-client credit, while raw delivery counters remain truthful about Worker traffic.

## Exact metric definitions

- `raw_artifact_requests`: every `GET` or `HEAD` request handled at a syntactically valid canonical release path, including 404, 200, 206, and 416 outcomes. It measures Worker-visible traffic, not demand.
- `successful_artifact_responses`: `GET` responses with status 200 or 206 for which Lighthouse supplied an artifact body. It measures server handoffs, not client completion.
- `full_artifact_responses`: the 200 subset of successful artifact responses.
- `partial_artifact_responses`: the 206 subset of successful artifact responses.
- `head_artifact_requests`: HEAD requests. These are excluded from successful artifact responses and client-bucket credit.
- `range_artifact_requests`: GET requests carrying `Range`, whether the range is valid or rejected.
- `failed_artifact_requests`: canonical artifact requests returning neither 200 nor 206, including missing objects and invalid ranges.
- `artifact_response_bytes`: declared bytes in 200/206 responses. This is bytes offered by the server, not proof of network transfer completion.
- `deduplicated_artifact_clients`: at most one successful full GET per HMAC(IP, release version, UTC day). It is a privacy-preserving client-network bucket and may merge people behind NAT or split one actor across rotating addresses.
- `suppressed_repetitive_requests`: additional successful full GETs in the same HMAC bucket after the daily credit. "Suppressed" means suppressed from the deduplicated demand proxy; delivery remains open.
- `rate_limited_artifact_requests`: requests Lighthouse actually rejects or delays under an explicitly enabled artifact delivery limit. Phase 1 and Phase 2 keep this at zero; no hard artifact limit is enabled without fresh evidence and a separately approved rollout.
- `artifact_cache_hits` / `artifact_cache_misses`: Worker Cache API outcomes for full GETs. Range and HEAD requests bypass this cache and are not silently counted as misses.
- `raw_download_intent_events`: accepted or dropped canonical `download_click` event rows received by Lighthouse for the BUS Core production site.
- `probable_human_download_intents`: accepted production-origin, non-test `download_click` events at an approved BUS Core page/path, capped at one HMAC(IP, UTC day). This is an inference and must always be labelled a proxy.
- `suppressed_repetitive_intents`: otherwise eligible intent events beyond that daily HMAC bucket.
- `successful_download_redirects`: successful 302 responses from `/download/latest`. These are not artifact responses.
- `artifact_downloads`: legacy compatibility counter. Historical values have changed qualification rules over time. New reporting must label it `legacy qualified artifact count` when the new measurement tables are unavailable; it must never be silently presented as raw traffic, people, installs, or completion.

Confirmed product signals remain separate and outrank all proxies. They are limited to acknowledged first launch, locally deduplicated version adoption, startup/manual update checks, successful update staging, reliability, and one-time successful use of major product areas. Workflow outcomes may remain unobserved when telemetry is off or delivery is not acknowledged. Product events contain no persistent installation identifier and cannot be linked into active-day, returning-installation, session, engagement, retention, or cross-day profiles. Qualified route-level update checks are request counts only. Lead records remain separate from analytics and contain only voluntarily submitted form data plus documented point-in-time attribution.

## Privacy and retention

- New artifact and intent truth tables contain daily aggregates only. No raw IP address, HMAC client key, user agent, email, or request identifier is stored in them.
- BUS Core product telemetry retains only event-ID deduplication keys for 30 days and aggregate counters for 400 days. It retains no raw product-event history or persistent installation identifier.
- HMAC inputs use `TELEMETRY_RATE_LIMIT_SECRET`, are scoped by purpose/version/day, and are retained only in the existing short-lived abuse-control table. The secret is never logged or returned.
- Daily artifact and intent aggregates are retained for 400 days, then pruned by the scheduled Worker. The existing short-lived rate buckets remain on their two-day retention policy.
- Raw site-event retention remains 30 days under the existing policy. Lead retention and deletion remain governed by the BUS Core site privacy/SOT documents and are not joined to analytics identity.

## Staged rollout and thresholds

1. **Observe and define:** deploy schema and additive fields, keep artifacts open, and verify the report distinguishes raw traffic, successful responses, HMAC client buckets, intent proxies, product telemetry, and leads.
2. **Reduce avoidable work:** enable immutable caching for versioned 200 responses, proper byte ranges, HEAD metadata, and cache diagnostics. Success means lower R2 work without a rise in failed responses or public-path regressions.
3. **Consider a hard delivery limit only with evidence:** require at least seven days of a sustained abusive pattern such as more than 100 successful full requests from the same HMAC IP/version/day bucket, cache bypass that produces material R2 cost, and no corresponding increase in distinct client buckets or product signals. Any limit needs an explicit change, tests, operator approval, a documented exception path, and a rollback switch. No such evidence exists in the July 18 audit, so Phase 3 is not enabled.

Rollback order is delivery safety first: disable any future hard limit, bypass Worker Cache API if it causes corrupt/incorrect responses, revert range/HEAD handling if interoperability fails, and finally stop additive writes if D1 causes latency. Legacy delivery and compatibility counters remain available during rollback. Database migrations are forward-only and must not be applied until explicitly approved.

## Current evidence and blind spots (2026-07-18 audit)

Proven by read-only production aggregates: July 17 recorded 230 legacy artifact credits and July 18 recorded 191; the July 18 rate table contained 191 distinct HMAC IP/version/day buckets with one attempt each. One retained product event was present. The separate leads D1 contained four total records (three update-list leads and one Managed BUS inquiry), with the newest created July 12; therefore the July 17–18 traffic did not create new stored leads. This does not prove 191 people, installs, completed downloads, or a single automated source.

Plausible but unproven explanations include distributed automation, rotating addresses, mirrors, scanners, and ordinary clients. Turnstile challenge generation is not evidence that those requests reached either form endpoint, and form traffic is not linked to artifact traffic.

Blind spots remain at layers that bypass the Worker, client disconnects after headers/body streaming begins, shared NAT, rotating IPs, privacy relays, cached responses served before Worker execution, and challenge tokens that are rendered but never submitted. Use Cloudflare edge analytics and R2/cache dashboards as independent delivery/cost evidence; do not merge them into demand metrics without naming the layer.
