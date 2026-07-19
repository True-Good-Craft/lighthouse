# True Good Craft Website Analytics Policy

## Status

This is the product-specific declaration for `site_key=tgc_site`. It records the user-approved commercial analytics exception to the company-wide aggregate-only and no-persistent-identifier defaults. It does not change BUS Core, Star Map, or service-intake data policy.

## Levels and purposes

- Page level: consented browser execution, acquisition, content interest, navigation, engagement, funnel outcomes, performance, and sanitized reliability.
- Host level: Cloudflare traffic as a separate broad traffic source that may include bots and must not be described as human engagement.
- Internal: protected Lighthouse and Agent Smith aggregate reporting.
- User level: no analytics-only collection. Information intentionally submitted through an intake remains a separate business relationship path.

The purpose is to improve TGC content, acquisition, commercial offers, inquiry flow, and site reliability. Each allowed event must answer one of those questions.

## Explicit identifier exception

After explicit analytics consent, the TGC site creates:

- `anon_user_id`: a random first-party value retained in the browser for at most 395 days.
- `session_id`: a random first-party value renewed after 30 minutes of inactivity.

Aggregate-only measurement is insufficient for new-versus-returning analysis, sessions per visitor, multi-page journeys, attribution continuity, and service-funnel progression. These identifiers are used only for those TGC website questions.

They are not derived from IP address, user agent, account data, form data, device characteristics, or another property. They are not linked to intake identity, BUS Core, Star Map, advertising networks, or external profiles. They are not exposed in operator reports, Airtable summaries, logs, or exports.

Essential-only choice, Global Privacy Control, and Do Not Track keep optional analytics disabled. Withdrawing consent deletes the browser-side analytics identity.

## Allowed event data

- production origin and path, with query and fragment removed
- origin-and-path-only referrer
- `src` and bounded UTM attribution
- allowlisted semantic event name and bounded event value
- random visitor/session IDs and new/returning state
- coarse device, viewport, language, timezone, and edge country
- scroll/engaged-time/section milestones
- form identifier, field identifier, validation state, and submit outcome
- bounded page-load, FCP, LCP, CLS, and sanitized error category
- test-mode marker

## Prohibited data

- form values, names, emails, phone numbers, messages, typed content, or keystrokes
- passwords, credentials, intake payloads, or business records
- raw IP retention, stored user-agent hashes, request IDs in raw TGC events, or exact geolocation
- fingerprinting, session replay, cross-site advertising IDs, account linking, or enrichment
- full URL query strings/fragments, arbitrary event names, or arbitrary context keys
- visitor/session/rate identifiers in operator reports or Airtable

## Retention

- raw accepted/dropped TGC site events: 90 days
- minute-scoped keyed abuse-control identifiers: 2 days
- browser visitor ID: at most 395 days
- browser session ID: 30 minutes of inactivity
- longer-lived analytics: aggregate summaries only, without visitor/session/rate identifiers

## Reporting and downstream use

Lighthouse is the source of truth. `GET /report?view=tgc` is the protected aggregate contract and Agent Smith `/tgc` is the on-demand presentation surface. Airtable may later receive curated daily/weekly KPI, campaign, content, and experiment rows. Airtable must not be a raw-event sink.

## Safety

Collection is consented, fail-soft, production-origin restricted, rate-limited, and server-allowlisted. Analytics failure must never block navigation, forms, intake delivery, or mailto fallback.
