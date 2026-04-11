# Lighthouse Policy Alignment Plan (Phase 2 Baseline)

Date: 2026-04-10
Scope: Lighthouse repo only
Status: Approved plan implemented in this change set

## Mission Constraints

- Preserve BUS Core as a grandfathered `legacy_hybrid` exception.
- Do not change BUS Core runtime behavior, report contract shape, support class, or telemetry richness.
- Do not force parity across sites.
- Keep `event_only` sites useful via event breakdowns and attribution while traffic/identity remain unsupported (`null`).

## What Lighthouse Mirrors From TGC Analytics Policy

Only implementation-relevant policy truth owned by Lighthouse:
- Support classes and capability layers
- Shared event taxonomy for cross-site comparable actions
- `dev_mode` suppression contract (site-loader enforced)
- `production_only` filtering semantics for report scope
- Null honesty: unsupported sections remain `null` or omitted by rule
- Property declarations relevant to tracked sites and report behavior

## What Lighthouse Does Not Mirror

- Full corporate policy prose not implemented by Lighthouse
- Non-Lighthouse implementation details for downstream repos/services
- Cross-repo implementation plans

## Current Contract Baseline (Keep Stable)

- BUS Core (`buscore`): `legacy_hybrid`, richer traffic and identity surfaces retained
- Star Map (`star_map_generator`): `event_only`
- TGC Site (`tgc_site`): `event_only`
- `event_only` expected useful output includes:
  - `by_event_name`
  - `top_paths`
  - `top_sources`
  - `top_campaigns`
  - `top_contents`
  - `top_referrers`
- `event_only` unsupported surfaces remain explicit:
  - traffic metrics are `null`
  - identity is `null`

## Execution Order (Completed)

1. README alignment
   - Site-view JSON example reflects shipped useful `event_only` output.
   - Includes `events.top_paths` and `events.top_contents`.
   - Keeps traffic/identity visibly unsupported by design.

2. SOT alignment
   - Added concise mirror-scope note referencing policy source.
   - Added explicit BUS Core grandfathered wording near `production_only` defaults and support class semantics.

3. plan.md refresh
   - Replaced stale assumptions with this durable baseline plan.

## Runtime and Test Posture

- Runtime changes: none required unless a concrete contract gap is discovered.
- BUS Core behavior changes: forbidden in this scope.
- Tests: only minimal lock updates if needed; no broad expansion.

## Downstream Handoff (Informational Only)

- Smith and site repos should consume this Lighthouse contract as-is.
- No Lighthouse plan item requires cross-repo code changes in this repo.
