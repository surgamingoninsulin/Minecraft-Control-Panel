## Metadata
- Plan name: 2026-04-29-player-identity-and-provider-filename-integrity
- Date: 2026-04-29
- Status: completed
- Requested by: user

## Goal
- Confirm whether `public/dist` is used.
- Keep provider-downloaded plugin filenames unchanged.
- Fix player whitelist/OP flows to use real Mojang UUID + exact username casing.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Minimal hotfix in frontend only.
- pros: quick
- cons: does not fix backend identity/name correctness

### Plan 2
- approach: Backend identity normalization + Mojang lookup + frontend filename pass-through.
- pros: robust and aligned with requested behavior
- cons: depends on Mojang API availability when adding by name

### Plan 3
- approach: Rewrite player storage flow around server commands.
- pros: most authoritative
- cons: high complexity and larger regression surface

## Selected Plan
- Plan 2

## Implementation Steps
1. Inspect usage of build output paths and player/plugin flows.
2. Patch player identity resolution (UUID normalization and Mojang profile lookup).
3. Preserve provider filenames end-to-end and validate build/syntax.

## Validation
- backend checks: `node --check backend/src/services/playerService.js`, `node --check backend/src/services/pluginService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: n/a (not run)

## Outcome
- completed changes:
  - Added Mojang-backed player identity resolution and UUID normalization in player service.
  - Updated OP/whitelist mutation logic to consistently match UUIDs and update canonical name casing.
  - Removed filename rewriting in provider install payload and preserved filenames in backend writes.
  - Confirmed app serves `frontend/dist` from backend when present; no `public/dist` usage found.
- residual risks:
  - Mojang API outages can block add-by-name resolution.
- follow-up:
  - Optional: add fallback/manual mode toggle if offline-mode servers need non-Mojang identity flow.
