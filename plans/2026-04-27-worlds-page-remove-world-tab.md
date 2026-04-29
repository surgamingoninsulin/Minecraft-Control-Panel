# 2026-04-27-worlds-page-remove-world-tab

## Metadata
- Plan name: Worlds Page Remove World Tab
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Remove the world configuration section from the Worlds page menu so the page only exposes datapack views.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Remove `World` tab button and its content panel from `UniversesPage`, keep world overview and datapack tabs.
- pros: minimal risk and matches request directly.
- cons: world config editing is no longer available from this page.

### Plan 2
- approach: Keep `World` tab but hide config editor and files list.
- pros: fewer structural changes.
- cons: still leaves a mostly empty world section.

### Plan 3
- approach: Move world config to Settings and keep Worlds datapack-only.
- pros: preserves config editing in another place.
- cons: larger cross-page change not requested.

## Selected Plan
Plan 1

## Implementation Steps
1. Remove `World` tab selector from Worlds page tab row.
2. Remove world config/files panel rendering and related local state/handlers/imports.
3. Keep `Installed` and `Browse` datapack tabs and world overview card.
4. Run frontend build.

## Validation
- backend checks: not needed (frontend-only change)
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual smoke test not executed in this batch

## Outcome
- completed changes: Worlds menu now only shows `Installed` and `Browse`.
- residual risks: users can no longer edit world config from this page.
- follow-up: if needed, add world-config editing to a dedicated Settings section.
