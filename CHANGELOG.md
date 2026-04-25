# Changelog

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
