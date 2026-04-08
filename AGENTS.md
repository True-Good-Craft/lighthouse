# Agent Governance — Mandatory

**Read this file before performing any modification work.**

This document establishes binding repository rules. It applies to:
- Human contributors
- Coding agents and AI assistants
- Automated tools making changes

Violation of these rules constitutes policy failure.

---

## 1. Authority Order

Authority sources in descending order:

1. **SOT.md** — Canonical authority for intended system behavior.
2. **CHANGELOG.md** — Authoritative for recorded shipped changes.
3. **Code** — Must implement behavior defined in SOT.

**Rules:**
- Code must not intentionally drift from SOT.
- If code and SOT disagree, the mismatch must be explicitly flagged.
- Agents must not silently "fix" behavior by guessing intent.
- When conflict exists, stop and report—do not proceed based on assumption.

---

## 2. Mandatory Change Bundle

For any non-trivial change, the following **must** be updated together in the same change set:

- **Code**
- **SOT.md**
- **CHANGELOG.md**
- **Version** (in `package.json`)

This is a requirement, not a suggestion.

Failure to update all four components is a policy violation.

---

## 3. Version Bump Requirements

A version bump is **required** for any shipped change involving:

- Endpoint additions, removals, or renames
- API contract changes
- Auth behavior changes
- Config or environment variable changes
- Storage schema or semantics changes
- Behavior changes visible to users or operators
- Operator-visible workflow changes
- Documentation-defined behavior changes

**Exemptions:**
- Pure typo fixes in documentation
- Formatting-only doc cleanups (whitespace, markdown syntax)
- Exempt changes must not alter behavior or documented operational meaning

---

## 4. SOT Update Requirements

**SOT.md must be updated** whenever a change affects:

- Routes or endpoints
- Auth behavior
- Config or environment requirements
- Storage semantics
- State model
- Report payloads or response contracts
- Background jobs or scheduled behavior
- Operational constraints
- Explicit non-goals or forbidden behaviors

**Policy:**
- Shipping code without matching SOT is a policy violation.
- SOT must reflect operational reality after deployment.

---

## 5. CHANGELOG Entry Requirements

**CHANGELOG.md must be updated** for every meaningful change, including:

- New features
- Removed behavior
- Changed behavior
- Auth changes
- Endpoint changes
- Config or environment changes
- Compatibility changes
- Deprecations

**Policy:**
- Silent behavior changes are forbidden.
- Every shipped change must be discoverable via CHANGELOG.

---

## 6. No-Guessing / No-Invention Rule

**Strict constraints:**

- If something is not specified in SOT, do not assume.
- If requested work exceeds the current SOT, stop and flag it.
- Agents must not fabricate:
  - Unsupported endpoints
  - Analytics features
  - Storage semantics
  - Infrastructure components

**Required distinction:**

Agents must clearly distinguish between:
- **Conformance fix** — Code brought in line with existing SOT
- **Approved behavior change** — SOT and code updated together per policy
- **Proposed future design** — Requires explicit approval before implementation

---

## 7. Simplicity / Drift-Control Rule

**Prefer:**
- Minimal conformance changes over architecture expansion
- Deletion over additive complexity when cleaning drift
- Removal of stale docs when behavior is removed

**Forbidden:**
- Leaving docs describing behavior that no longer exists in code
- Leaving code implementing behavior absent from SOT (unless explicitly flagged for follow-up)

**Principle:**
- Documentation and code must converge toward truth, not drift apart.

---

## 8. Required Output from Agents

Any agent performing modification work must report:

- **Files changed** — List all modified files
- **Behavior changed** — Yes/No
- **SOT.md updated** — Yes/No
- **CHANGELOG.md updated** — Yes/No
- **Version bump** — Old → New
- **Unresolved drift** — Any conflicts or mismatches found
- **Blocked items** — Work requiring explicit human approval

Agents must not complete work if any mandatory component is skipped.

---

## 9. Violation Examples

The following are explicit policy violations:

1. **Code changed but SOT.md not updated**
   - Example: Endpoint response format changed, SOT still documents old format.

2. **New endpoint added but version not bumped**
   - Example: `GET /health` added, version remains `1.0.0`.

3. **Auth behavior changed without CHANGELOG entry**
   - Example: Token validation logic modified, no changelog record.

4. **Docs describe behavior that code no longer has**
   - Example: SOT documents cron job behavior, but scheduled code removed.

5. **API response shape changed without contract/SOT update**
   - Example: `/report` now returns `trends` object, SOT and API contract not updated.

6. **Version bump without CHANGELOG entry**
   - Example: Version goes from `1.0.0` to `1.1.0`, CHANGELOG unchanged.

7. **Silent behavior change**
   - Example: Error handling logic modified, no docs or changelog mention.

---

## 10. Future Enforcement

These rules may later be enforced via:
- CI checks validating synchronized updates
- Pre-commit hooks checking change bundle completeness
- Repository automation rejecting incomplete change sets

No such automation currently exists. Compliance is currently manual and mandatory.

---

## 11. Service Independence Rule

Lighthouse must remain an independently runnable standalone service.

Repository policy:
- Changes must not introduce hard runtime dependencies on BUS Core or other TGC services.
- Integrations with BUS Core, Price Guard, Discord, email, cron, or any external system must remain optional, additive, and non-blocking.
- If a proposed change requires another service to be available for Lighthouse core operation, stop and escalate for redesign.

---

## 12. Change Control Rule

For any non-trivial behavioral change:
- Update `SOT.md`.
- Update `CHANGELOG.md`.
- Update operator-facing docs when behavior or operations are affected.

Hard constraints:
- Future-direction docs must never describe unshipped behavior as present reality.
- No change may introduce cross-service hard dependency without an explicit SOT change.

---

## 13. Cross-Site Dev Analytics Suppression Rule

Repository-wide integration rule for Lighthouse-tracked public sites:

- Do not invent site-specific developer/operator analytics suppression cookie names.
- Reuse `dev_mode` as the canonical suppression cookie name.
- Treat `dev_mode` as presence-based; value is not semantically relevant.
- Keep developer/operator suppression separate from user privacy opt-out controls (for example `localStorage.noAnalytics === "1"`).
- During telemetry integration review, verify shared site loaders check `dev_mode` before Cloudflare Web Analytics injection and before Lighthouse pageview/event emission.
- For multi-domain site families, keep the cookie name stable (`dev_mode`) and scope by highest-valid shared domain instead of renaming the cookie.

---

## Summary

**Before making changes:**
1. Read SOT.md and CHANGELOG.md
2. Understand current documented behavior

**When making changes:**
1. Update code
2. Update SOT.md
3. Update CHANGELOG.md
4. Bump version in `package.json`
5. Report all changes explicitly

**Golden rule:**
- Do not ship behavior without documentation.
- Do not document behavior that does not exist.
- When in doubt, stop and ask.
