# buscore-lighthouse

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

Lighthouse currently does six things:

1. Serves the BUS Core manifest from R2.
2. Increments fixed daily aggregate counters in D1.
3. Accepts first-party site-emitted pageview events on `POST /metrics/pageview`.
4. Accepts standardized multi-site events on `POST /metrics/event`.
5. Exposes protected, on-demand aggregate reporting.
6. Pulls one daily Buscore traffic snapshot from the Cloudflare GraphQL Analytics API into D1 on a scheduled cron.

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
| True Good Craft (`tgc_site`) | `event_only` | Yes | Yes | No | No | No (currently) | No active extension layer right now. |

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
| GET | `/manifest/core/stable.json` | Return manifest JSON from R2 (no counting) |
| GET | `/update/check` | Return manifest JSON and increment `update_checks` unless request IP matches `IGNORED_IP` |
| GET | `/download/latest` | Increment `downloads` unless request IP matches `IGNORED_IP`, then `302` redirect to latest release URL from manifest |
| GET | `/releases/:filename` | Serve release artifact from R2 key `releases/:filename` (no counting) |
| POST | `/metrics/pageview` | Accept first-party JS-fired pageview JSON, always return `204`, and persist/aggregate best-effort in D1 |
| POST | `/metrics/event` | Accept standardized multi-site event JSON, always return `204`, and persist/aggregate best-effort in D1 |
| GET | `/report` | Return protected aggregate report; supports legacy bare mode plus `view=fleet`, `view=site`, and `view=source_health` |

Notes:
- `/manifest/core/stable.json` and `/releases/:filename` never increment counters.
- `/update/check` does not require `X-BUS-Update-Source: core` for counting.
- If `IGNORED_IP` is configured and matches `CF-Connecting-IP`, counting is suppressed while normal responses are still returned.
- `POST /metrics/pageview` is unauthenticated by design, parses raw request text then JSON, and still returns `204` for malformed, invalid, or rate-limited submissions.
- Valid accepted payloads follow the deployed BUS Core site emitter contract: `type = "pageview"`; required fields `client_ts`, `path`, `url`, `referrer`, `utm` object, `device`, `viewport`, `lang`, and `tz`; optional omitted fields `src`, `utm.{source,medium,campaign,content}`, `anon_user_id`, `session_id`, and `is_new_user`.
- Empty-string values for `referrer`, `lang`, and `tz` are accepted and preserved as empty strings in raw storage.
- `POST /metrics/pageview` and its `OPTIONS` preflight only grant browser CORS access to `https://buscore.ca` and `https://www.buscore.ca`; Lighthouse does not use wildcard allow-origin on that route.
- The deployed site emitter contract is accepted as-is: page-load-only, beacon-first, `fetch(..., { keepalive: true })` fallback, no retries, and no session logic.
- `POST /metrics/event` is site-aware through the tracked-site registry in `src/index.ts`: each site entry defines `site_key`, `production_hosts`, `allowed_origins`, `staging_hosts`, and `production_only_default`.

## Report Response

Bare `GET /report` preserves the legacy operator contract and returns:

```json
{
  "today": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "yesterday": { "update_checks": 0, "downloads": 0, "errors": 0 },
  "last_7_days": { "update_checks": 0, "downloads": 0, "errors": 0 },
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
    "month_to_date": { "update_checks": 0, "downloads": 0, "errors": 0 }
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
- Existing top-level fields `today`, `yesterday`, `last_7_days`, `month_to_date`, and `trends` remain intact and semantically unchanged.
- Existing top-level `traffic` remains the Cloudflare-derived traffic summary and is not renamed or reinterpreted by pageview ingestion.
- Additive top-level `human_traffic` is JS-fired first-party pageview telemetry, not verified-human analytics. `legacy_pageview` is a semantic alias for the same object (BUS Core `legacy_pageview` layer).
- Additive top-level `intent_counters` groups the same `today`, `yesterday`, `last_7_days`, and `month_to_date` counter windows under a single semantic label for the Lighthouse intent-counter layer (`update_checks`, `downloads`, `errors`). The individual top-level fields remain for backward compatibility.
- Bare `/report`, `view=fleet`, and `view=site` each perform one best-effort refresh capture for the previous completed UTC day before assembly.
- `view=source_health` intentionally skips the refresh path and reads only currently persisted data.
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

No new bindings or secrets are introduced by pageview ingestion.

## Scheduling

Lighthouse is on-demand only.
- Daily cron trigger captures one previous completed UTC day Buscore traffic snapshot from the Cloudflare GraphQL Analytics API.
- The same scheduled execution also prunes raw pageview events older than about 30 UTC days and stale rate-limit buckets older than about 2 days.
- No outbound Discord posting.

Traffic capture notes:
- The cron always queries the previous completed UTC day. It never queries the current UTC day and never stores rolling-window snapshots.
- Each scheduled run executes one GraphQL query only.
- Successful captures upsert one final row per UTC day, so reruns converge to one row for that day.
- If the Cloudflare pull fails or returns GraphQL errors, Lighthouse skips the row for that day rather than writing synthetic zeroes.
- If the query returns no daily row for the selected day/hostname, Lighthouse treats the run as failed and skips the row.
- Lighthouse validates that the response includes a numeric daily request `count` field; if missing/undefined/non-numeric, the run is treated as failed and the row is skipped.
- Authenticated `/report` also performs one best-effort refresh capture for the previous completed UTC day before report assembly, using the same per-day capture logic.

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as dev dependency)
- A Cloudflare account

### 2. Install dependencies

```bash
npm install
```

### 3. Create the D1 database

```bash
npx wrangler d1 create buscore-lighthouse
```

Copy the `database_id` from the output and replace `YOUR_D1_DATABASE_ID` in `wrangler.toml`.

### 4. Apply migrations

```bash
# local (for wrangler dev)
npx wrangler d1 migrations apply buscore-lighthouse --local

# remote (production)
npx wrangler d1 migrations apply buscore-lighthouse --remote
```

### 5. Set secrets

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put CF_API_TOKEN
```

Add `CF_ZONE_TAG` to your Worker environment configuration before deploying scheduled traffic capture.

### 6. Configure `wrangler.toml`

Ensure existing bindings are configured for your environment (`DB` and `MANIFEST_R2`).
Also configure `CF_ZONE_TAG` and ensure the scheduled traffic pull is authorized with `CF_API_TOKEN`.

### 7. Deploy

```bash
npm run deploy
```

### Local development

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck
```
