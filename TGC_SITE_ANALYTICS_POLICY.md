# True Good Craft Website Analytics Policy

## Status

This is the product-specific declaration for `site_key=tgc_site`. It follows the company-wide aggregate-only and no-persistent-identifier defaults. It does not change BUS Core, Star Map, or service-intake data policy. Worker 1.29.0 deployed this bounded lane; 1.29.1 adds ingestion-level viewport and event-value conformance without a schema migration.

## Purpose and levels

- Page level: consented page execution, current acquisition, selected commercial intent, form outcomes, and sanitized reliability.
- Host level: Cloudflare traffic is a separate broad source that may include bots and must not be described as human engagement.
- Internal: protected Lighthouse and Agent Smith aggregate reporting.
- User level: no analytics identity or profile. Information intentionally submitted through an intake remains a separate business relationship path.

The purpose is to answer: which pages were viewed, where attention came from, which offers drew interest, whether intake submission worked, and whether the site produced a sanitized client error.

## No identity

The TGC emitter creates no visitor ID, session ID, first/returning flag, first-touch profile, fingerprint, or other continuity token. Lighthouse discards `anon_user_id`, `session_id`, and `is_new_user` for TGC even if a superseded producer sends them. Operator reports, Airtable summaries, logs, and exports must not expose visitor/session/rate identifiers.

Essential-only choice, Global Privacy Control, and Do Not Track keep optional analytics disabled. GPC and DNT override an older stored analytics choice on every page load. The site removes superseded browser identity keys on load.

## Allowed event data

- production origin and path, with query and fragment removed
- origin-and-path-only referrer
- current `src` and bounded UTM attribution
- allowlisted semantic event name and an event-specific sanitized enum/category where that event needs a value; otherwise `null`
- coarse device, `small`/`medium`/`large` viewport bucket, language, timezone, and edge country
- form identifier and start, submit-attempt, success, failure, or fallback outcome
- sanitized error category
- test-mode marker

The exact allowlist is `page_view`, `outbound_click`, `contact_click`, `email_click`, `buscore_outbound_click`, `services_interest`, `infrastructure_cta_click`, `infrastructure_package_interest`, `ops_care_interest`, `audit_cta_click`, `form_start`, `form_submit_attempt`, `form_submit_success`, `form_submit_failure`, `form_submit_fallback`, and `js_error`. Events outside the shared fleet taxonomy are the active, bounded TGC Layer-5 extension; this classification does not add a traffic or identity layer.

Producers should send viewport as `small`, `medium`, or `large`. During the rolling producer update, Lighthouse also accepts exact lowercase `WIDTHxHEIGHT`, immediately normalizes it by width (`small` below 768, `medium` from 768 through 1199, `large` from 1200 upward), and stores only the bucket. Lighthouse normalizes form identifiers to `infrastructure`, `audit`, `contact`, `general`, or `other`. `js_error` values are limited to `script_error`, `unhandled_rejection`, `resource_error`, `network_error`, `form_error`, `unknown`, or `other`. `outbound_click` values are limited to `buscore`, `github`, `contact`, `email`, `partner`, or `other`. Unrecognized non-empty values in those three valued families become `other`; absent/blank values and values for all remaining accepted TGC event names are stored as `null`.

## Prohibited data

- visitor/session identity, new/returning state, stored first-touch attribution, or behavioral profiles
- field-level form or validation events, form values, names, emails, phone numbers, messages, typed content, or keystrokes
- scroll, engaged-time, section-view, or first-party web-vital events
- passwords, credentials, intake payloads, or business records
- raw IP retention, stored user-agent hashes, request IDs in raw TGC events, or exact geolocation
- fingerprinting, session replay, cross-site advertising IDs, account linking, or enrichment
- full URL query strings/fragments, arbitrary event names, or arbitrary context keys

## Retention

- raw accepted/dropped TGC site events: 90 days
- minute-scoped keyed abuse-control identifiers: 2 days
- longer-lived analytics: aggregate summaries only

## Reporting and downstream use

Lighthouse is the source of truth. `GET /report?view=ceo` is the decision contract used for Smith's plain-English daily, weekly, and monthly output. `GET /report?view=tgc` remains a protected diagnostic/rollback surface; old identity and engagement fields may describe historical rows but are not supplied by the v2 producer. Airtable may later receive curated aggregate KPI/campaign/content/experiment rows and must not be a raw-event sink.

## Safety

Collection is consented, fail-soft, production-origin restricted, rate-limited, and server-allowlisted. Analytics failure must never block navigation, forms, intake delivery, or mailto fallback.
