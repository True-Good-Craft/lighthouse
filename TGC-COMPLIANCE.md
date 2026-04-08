# TGC Compliance

## 1. Canonical standard
- Canonical governance standard: `tgc-ops/governance/tgc-repository-standard.md`

## 2. Repo identity
- Repo name: lighthouse
- Repo class: operational/supporting service repo
- Canonical branch: main
- Local authority docs:
  - SOT.md
  - README.md
  - CHANGELOG.md

## 3. Compliance status
- Status: PARTIAL
- Source audit report: `tgc-ops/indexes/daily-estate-compliance-report.md`
- Source audit UTC: 2026-04-08T20:53:59.7472678Z
- Last projected by: Codex Local Automation
- Projection date UTC: 2026-04-08T21:48:13.1419913Z

## 4. Baseline checks
- README: YES
- Canonical SoT / authority doc: YES
- Boundary clarity: YES
- Deployment authority declared: YES
- Version/release authority declared: PARTIAL
- Dependency declaration present: YES
- Continuity start present: YES
- Registered in tgc-ops: YES

## 5. Current gaps
- Version/release authority declaration is light.

## 6. Required remediation
- Reconcile the canonical ops row with current local docs, then refresh `TGC-COMPLIANCE.md` to the updated canonical state.

## 7. Justified exceptions
- N/A

## 8. Authority note
- Local implementation truth remains in local repository authority docs.
- `tgc-ops` standard is canonical for estate governance.
- This file is the only repo-local governance snapshot `tgc-ops` may update by default.
