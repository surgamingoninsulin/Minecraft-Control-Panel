# 2026-04-27-player-remove-404-fix

## Metadata
- Plan name: Player Remove 404 Compatibility Fix
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Fix player removal failures returning 404 by making removal robust for unsafe identifier/path cases.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add body-based remove endpoint (`POST /players/remove`) and switch frontend remove flow to use it, with legacy DELETE fallback.
- pros: robust against path-segment issues and backward compatible.
- cons: adds one extra endpoint.

### Plan 2
- approach: Keep DELETE endpoint and only encode identifiers in frontend URL.
- pros: smaller change.
- cons: still fragile for edge-case identifiers and old clients.

### Plan 3
- approach: UI-only retry logic without backend changes.
- pros: quickest patch.
- cons: does not fix underlying API limitation.

## Selected Plan
Plan 1

## Implementation Steps
1. Added backend `POST /players/remove` route using existing removal service.
2. Added frontend API method for body-based remove endpoint.
3. Updated Players remove action to call new endpoint first and fallback to DELETE.
4. Ran backend syntax + frontend build checks.

## Validation
- backend checks: `node --check backend/src/routes/playerRoutes.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual runtime smoke test not executed in this batch

## Outcome
- completed changes: remove flow now uses body-based endpoint and falls back to legacy delete route for compatibility.
- residual risks: backend process restart is required if currently running old route map in memory.
- follow-up: verify remove flow against problematic player entry in live UI.
