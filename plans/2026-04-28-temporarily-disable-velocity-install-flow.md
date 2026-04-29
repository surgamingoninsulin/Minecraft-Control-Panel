# 2026-04-28 Temporarily Disable Velocity Install Flow

## Metadata
- Plan name: Temporarily disable Velocity install/browse flow without deleting code
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Disable Velocity install/browse behavior now, while keeping code in place (commented/guarded) for future re-enable.

## Constraints
- Minecraft-only behavior
- No Hytale path logic
- Do not delete existing Velocity backend logic

## Options
### Plan 1
- approach: Comment out Velocity from frontend server/plugin type lists and add backend route guard returns.
- pros: Fast, reversible, explicit temporary state.
- cons: Velocity users cannot browse/install plugins now.

### Plan 2
- approach: Keep frontend visible but hard-block only install step.
- pros: preserves partial UX.
- cons: still confusing and error-prone.

### Plan 3
- approach: Remove Velocity code entirely.
- pros: clean immediate behavior.
- cons: violates request and harder future restore.

## Selected Plan
Plan 1.

## Implementation Steps
1. Comment out Velocity option from setup server type list.
2. Comment out Velocity from frontend plugin-mode classification.
3. Comment out Velocity in backend provider-mode classification hints.
4. Add explicit backend temporary-disabled guard for Velocity plugin routes.
5. Run backend checks and frontend build.

## Validation
- backend checks:
  - `node --check backend/src/routes/pluginRoutes.js`
  - `node --check backend/src/services/modProviderService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - code-path verification of Velocity guards and empty provider response.

## Outcome
- completed changes:
  - Velocity plugin browse/install now disabled by design.
  - All relevant code retained and marked with `TEMP DISABLED` comments.
- residual risks:
  - Existing Velocity serverType settings may show plugin browse unavailable until re-enabled.
- follow-up:
  - Re-enable by uncommenting Velocity entries and removing temporary backend guard checks.
