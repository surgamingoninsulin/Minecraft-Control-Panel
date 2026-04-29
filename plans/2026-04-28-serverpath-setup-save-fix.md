# 2026-04-28-serverpath-setup-save-fix.md

## Metadata
- Plan name: Server Path Setup Save Fix
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Fix server path persistence so file listing and other server-root operations stop failing with `Server path is not configured`.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add setup-only backend settings endpoint that allows protected field updates and wire setup flow to use it
- pros: precise fix, preserves normal settings protection
- cons: adds one extra endpoint

### Plan 2
- approach: Remove protected-key restrictions globally in `/settings/panel`
- pros: simpler API
- cons: weakens safety model and can regress protected settings

### Plan 3
- approach: Keep backend unchanged and attempt frontend workarounds
- pros: no backend API change
- cons: unreliable; serverPath remains blocked by backend

## Selected Plan
Plan 1

## Implementation Steps
1. Added `POST /api/settings/panel/setup` route using `allowProtectedUpdates: true`.
2. Switched setup/reset submit flow to call setup-specific save API.
3. Normalized `serverPath` as trimmed string in settings normalization.
4. Ran backend syntax checks and frontend build.

## Validation
- backend checks: `node --check backend/src/routes/settingsRoutes.js`; `node --check backend/src/services/settingsService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: not run

## Outcome
- completed changes:
  - Setup flow can persist protected fields (`serverPath`, `jarFile`, etc.) again.
  - Normal panel settings save remains protected.
- residual risks:
  - Existing sessions with empty `serverPath` must re-run setup save once.
- follow-up:
  - Optional: add a frontend redirect hint when file API returns `ESERVERPATH`.
