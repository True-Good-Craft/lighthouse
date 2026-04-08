# Lighthouse Normalization Audit and Execution Plan

Date: 2026-04-08
Scope: `buscore`, `star_map_generator`, `tgc_site`

## Canonical Vocabulary (This Plan Uses These Terms)

Support classes:
- `legacy_hybrid`
- `event_only`
- `event_plus_cf_traffic`
- `not_yet_normalized`

Capability layers:
- Layer 1 - Registry layer
- Layer 2 - Event layer
- Layer 3 - Traffic layer
- Layer 4 - Identity layer
- Layer 5 - Extension layer

Operator language standard:
- Requests should be phrased in layers/support classes (for example: "Add a traffic layer to TGC", "Keep Star Map event_only").
- Avoid vague parity language (for example: "make it like Buscore" or "make all site reports the same").

## Mission Alignment

Normalization target:
- Preserve classic BUS Core operational discipline (contract stability, additive reporting, explicit unsupported handling).
- Do not treat BUS Core legacy pageview ingestion as the fleet standard.
- Fleet standard is tracked-site driven and event-driven.

Canonical architecture rules:
1. `TRACKED_SITES` is the canonical property registry.
2. `POST /metrics/event` is the canonical fleet telemetry path.
3. `POST /metrics/pageview` remains supported only as BUS Core legacy ingestion.
4. `dev_mode` is the canonical cross-site suppression contract.
5. Shared event naming must be standardized by a documented catalog.
6. Shared report/payload fields must have one meaning across views where applicable.
7. Normalization must not manufacture parity.
8. Unsupported metrics/sections must remain `null` or omitted by documented rule.

## Audit Summary (Current Lighthouse Reality)

What is already aligned:
- Tracked-site registry exists in code (`TRACKED_SITES`) and is already the source for site identity, CORS, production host filters, and Cloudflare traffic availability.
- `POST /metrics/event` exists and is already the multi-site telemetry path.
- `POST /metrics/pageview` remains BUS Core scoped (CORS and report support).
- `/report` already returns `null` for unsupported per-site metrics in fleet/site/source-health views.
- `dev_mode` contract is documented in SOT/README and acknowledged in code comments as site-loader enforced.

Primary drift found:
- This file was stale and contradicted shipped behavior (cron, event ingest, and multi-view reporting were missing).
- Shared cross-site event catalog is not yet frozen as a documented contract.
- Shared field semantics exist but were not previously grouped into one explicit normalization rule set.

## Per-Site Normalization Inventory

| label | site_key | production_hosts | allowed_origins | staging_hosts | cloudflare_traffic_enabled | lighthouse_first_party_telemetry_enabled | ingestion path(s) in use | support_class | logically supported sections | known drift / ambiguity |
|---|---|---|---|---|---|---|---|---|---|---|
| BUS Core | `buscore` | `buscore.ca`, `www.buscore.ca` | `https://buscore.ca`, `https://www.buscore.ca` | none | true | true | `/metrics/pageview` + `/metrics/event` | `legacy_hybrid` | Summary, Today, Traffic, Human Traffic / Events, Observability, Identity, Read | Legacy + standardized dual-ingest remains intentional; requires explicit non-parity handling vs event-only sites |
| Star Map Generator | `star_map_generator` | `starmap.truegoodcraft.ca` | `https://starmap.truegoodcraft.ca` | none | false | true | `/metrics/event` | `event_only` | Summary, Today, Human Traffic / Events, Observability, Read | No Cloudflare traffic section support; identity section not yet exposed in site report |
| True Good Craft | `tgc_site` | `truegoodcraft.ca`, `www.truegoodcraft.ca` | `https://truegoodcraft.ca`, `https://www.truegoodcraft.ca` | none | false | true | `/metrics/event` | `event_only` | Summary, Today, Human Traffic / Events, Observability, Read | Event naming catalog not yet frozen; cloudflare section intentionally unsupported |

## Site Capability Matrix (Canonical Layer View)

| Site | support_class | Layer 1 Registry | Layer 2 Event | Layer 3 Traffic | Layer 4 Identity | Layer 5 Extension | Notes |
|---|---|---|---|---|---|---|---|
| BUS Core (`buscore`) | `legacy_hybrid` | Yes | Yes | Yes | Yes | Not active by default | Intentionally richer; do not force false parity onto other sites. |
| Star Map Generator (`star_map_generator`) | `event_only` | Yes | Yes | No | No | Yes | Keep event-only posture unless explicitly requested otherwise. |
| True Good Craft (`tgc_site`) | `event_only` | Yes | Yes | No | No | No (currently) | No active extension layer right now. |

Support-class rule:
- `legacy_hybrid`: site uses standardized events plus legacy pageviews.
- `event_only`: site uses standardized events and no Cloudflare traffic in report.
- `event_plus_cf_traffic`: site uses standardized events and has Cloudflare traffic enabled.
- `not_yet_normalized`: site in registry but lacking normalized telemetry/report readiness.

## Canonical Normalized Per-Site Report Contract

Every normalized per-site report should aim to expose these logical sections where supported:
- Summary
- Today
- Traffic
- Human Traffic / Events
- Observability
- Identity
- Read

Rules:
- Unsupported sections must be `null` or omitted by documented rule.
- No site should improvise different meanings for those sections.
- Fleet report must expose comparable site summaries without pretending unsupported metrics exist.

Current practical mapping in Lighthouse:
- Summary: `view=site.summary` and `view=fleet.sites[*]` summary fields.
- Today: represented in legacy report blocks and as implied window endpoint in `view=site` window metadata.
- Traffic: `traffic` object in site/fleet where `cloudflare_traffic_enabled = true`, otherwise `null` metrics with explicit flag.
- Human Traffic / Events: `events` block (standardized events) and BUS Core legacy `human_traffic` section.
- Observability: `health` block in `view=site`, plus `view=source_health`.
- Identity: currently supported in legacy BUS Core identity block; not yet normalized as a per-site section for all sites.
- Read: all report views are read-only outputs; no write semantics are exposed by report routes.

## Shared Field Meaning Freeze

Shared field names must keep one meaning across report views where applicable:
- `accepted_signal_7d`: accepted telemetry signals in current UTC day + previous six days, using supported sources for the site.
- `accepted_events_7d`: accepted standardized events only (never includes legacy pageviews).
- `has_recent_signal`: boolean equivalent of `accepted_signal_7d > 0` over supported sources.
- `last_received_at`: latest accepted `received_at` included for that site in the view.
- `cloudflare_traffic_enabled`: capability/availability flag from tracked-site config; not a traffic count.

Rules:
- If a field is only valid in one view/section, document that explicitly.
- Do not let field meanings drift by site or report view.

## No-Fiction Normalization Rules

- Do not fake unsupported metrics.
- Do not backfill unsupported metrics from unrelated sources for cosmetic parity.
- Do not treat Cloudflare traffic, first-party events, and legacy pageviews as equivalent layers.
- Keep `null` values honest.

## Shared Event Name Standardization (Execution Target)

Current state:
- Runtime accepts any non-empty `event_name` for `/metrics/event`.
- Star Map production currently emits named events (for example `page_view`, `preview_generated`, `high_res_requested`, `download_completed`, `payment_click`, plus error variants).

Next-pass requirement:
- Publish and freeze one shared fleet event-name catalog for cross-site comparable events.
- Keep site-specific events allowed, but mark them as site-scoped and non-comparable.

## Practical Live Verification (This Pass)

Completed:
- BUS Core live HTML references shared loader (`/assets/js/site-analytics.js`).
- BUS Core live loader includes `/metrics/pageview`, `dev_mode` cookie check, and Cloudflare beacon gating.
- True Good Craft live HTML includes `assets/js/telemetry.js` and Cloudflare beacon script.
- True Good Craft live telemetry script uses `/metrics/event` with beacon flow.
- Star Map live script includes `LIGHTHOUSE_SITE_KEY = 'star_map_generator'`, `dev_mode` suppression check, and `/metrics/event` emission.
- Star Map script contains concrete `trackEvent(...)` names used in production script.

Not completed in this pass:
- Browser-interaction capture to verify every emitted event name path under real user interactions.
- End-to-end confirmation that every host conditionally suppresses both Cloudflare and Lighthouse telemetry under `dev_mode` for all interaction paths.

## Drift List

1. `plan.md` was materially stale against shipped behavior and has been replaced.
2. Shared cross-site event-name catalog is not yet frozen as an explicit Lighthouse contract.
3. Identity reporting is currently richer for BUS Core legacy pageviews than event-only sites; this is acceptable only if documented as unsupported elsewhere.

## Recommended Implementation Sequence (Next Pass)

1. Freeze shared event taxonomy
	- Publish canonical shared event names and mapping rules in SOT/README.
	- Mark site-specific non-comparable events explicitly.

2. Normalize report contract exposure
	- Add explicit per-site section availability metadata in `view=site` (or adjacent doc contract) without synthetic values.
	- Keep unsupported sections `null`/omitted by rule.

3. Normalize field dictionary enforcement
	- Add tests for shared-field semantics across `view=fleet`, `view=site`, and `view=source_health`.
	- Guard against regressions in meaning of `accepted_signal_7d`, `accepted_events_7d`, `has_recent_signal`, `last_received_at`.

4. Site rollout discipline
	- For each tracked site, verify production loader emits standardized shared events where applicable.
	- Keep BUS Core legacy `/metrics/pageview` support documented as legacy-only.

5. Verification closeout
	- Run live host verification checklist for each release touching telemetry contracts.
	- Record observed evidence snippets for loader and suppression behavior.
