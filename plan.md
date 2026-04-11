# Lighthouse Policy Alignment Plan (Durable Baseline)

Date: 2026-04-10
Scope: Lighthouse repo only
Status: Active baseline for future Lighthouse policy-conformance work

## Mission Constraints

- Preserve BUS Core as the grandfathered `legacy_hybrid` exception.
- Do not change BUS Core runtime behavior, report contract shape, support class, or telemetry richness unless explicitly approved and documented.
- Do not force parity across sites.
- Keep `event_only` sites useful via event breakdowns and attribution while traffic/identity remain unsupported (`null`).

## Governing Upstream Reference

Lighthouse mirrors only implementation-relevant policy truth from `TGC Analytics Policie.md`.
Lighthouse does not duplicate or redefine full company policy prose outside Lighthouse-owned behavior.

## What Lighthouse Mirrors

- Shared taxonomy for comparable events:
  - `page_view`
  - `outbound_click`
  - `contact_click`
  - `service_interest`
- Property declarations relevant to Lighthouse-owned reporting semantics:
  - `buscore` = `legacy_hybrid`
  - `star_map_generator` = `event_only`
  - `tgc_site` = `event_only`
- Support classes, capability layers, and report-view family language used by Lighthouse.
- Filter semantics and section-availability behavior in Lighthouse report outputs.
- Strict `null` vs `0` vs `[]` semantics.

## What Lighthouse Does Not Mirror

- Downstream consumer implementation obligations outside Lighthouse.
- Cross-repo rollout plans, architecture redesign, or parity mandates.
- Any attempt to flatten BUS Core richer surfaces into `event_only` parity.

## BUS Core Grandfathering Guardrails

- Keep BUS Core support class `legacy_hybrid`.
- Keep BUS Core richer report surfaces (traffic and identity where supported).
- Keep BUS Core `production_only_default = false` unless explicitly approved via SOT + changelog + versioned release.
- No BUS Core telemetry reductions in Lighthouse conformance passes.

## Event-Only Usefulness Expectations

For `event_only` properties, Lighthouse should continue to provide useful event-layer sections when data exists:
- `by_event_name`
- `top_paths`
- `top_sources`
- `top_campaigns`
- `top_contents`
- `top_referrers`

Traffic/request/visit and identity fields remain unsupported by design for `event_only` properties and must remain `null`.

## Null, Empty, Unsupported Semantics

- `null` means unsupported by design.
- `0` means supported metric with no activity.
- `[]` means supported breakdown with no rows in current scope/filter.

Under production filtering, empty breakdown arrays are valid and must not be described as unavailable.

## Operational Checklist For Future Passes

1. Validate policy-anchor references point to `TGC Analytics Policie.md`.
2. Validate BUS Core grandfathering language remains explicit.
3. Validate `view=site` docs/examples still show useful `event_only` breakdown outputs.
4. Validate null/empty/filter semantics wording remains explicit and consistent.
5. If runtime behavior changes are required, update code + SOT + CHANGELOG + package version together.
