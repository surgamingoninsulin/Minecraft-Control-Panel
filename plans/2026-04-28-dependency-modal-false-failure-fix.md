# 2026-04-28 Dependency Modal False Failure Fix

## Metadata
- Plan name: Fix dependency modal showing false red failure when dependency actually installs
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Ensure dependency install modal status reflects real install outcome and avoids false red failures.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: After dependency install error, verify installed list; if dependency exists, mark as installed instead of failed.
- pros: Minimal frontend-only fix with immediate UX improvement.
- cons: Requires one extra API call (`plugins/list`) in failure path.

### Plan 2
- approach: Backend returns detailed per-dependency status contract.
- pros: More authoritative status model.
- cons: larger API change.

### Plan 3
- approach: Remove red failure state entirely.
- pros: simpler UI.
- cons: hides genuine failures.

## Selected Plan
Plan 1.

## Implementation Steps
1. Update install helper to return payload.
2. Add dependency verification helper using `pluginAPI.list()`.
3. In dependency catch path, mark as installed when verification confirms presence.
4. Run frontend build validation.

## Validation
- frontend checks:
  - `npm --prefix frontend run build`
- backend checks:
  - not required
- runtime checks:
  - code-path verification for fallback “Installed (already present)” modal status.

## Outcome
- completed changes:
  - Dependency modal now avoids false red fail when dependency is actually present after install attempt.
- residual risks:
  - Verification matches by `modId` or display/file name, which depends on provider metadata quality.
- follow-up:
  - Optional: return explicit dependency result map from backend install endpoint.
