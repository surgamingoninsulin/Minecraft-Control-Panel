# 2026-04-27-players-remove-and-settings-lockdown

## Metadata
- Plan name: Players Removal + Settings Lockdown for Runtime Safety
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Add player removal from Players UI and data sources (ops/whitelist/usercache), and lock sensitive runtime settings so server jar/path/type and plugin directory are not editable in Settings UI while showing fixed server directories for datapacks/mods/plugins.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add backend player delete endpoint + frontend remove action; lock sensitive settings in UI and backend update policy; add read-only directories section and remove jar dropdown/refresh controls.
- pros: Complete behavior + UX alignment; prevents accidental runtime breakage.
- cons: Touches both frontend and backend flows.

### Plan 2
- approach: UI-only remove/lock changes without backend enforcement.
- pros: Fastest.
- cons: API bypass remains possible.

### Plan 3
- approach: backend-only strictness first, UI later.
- pros: Strong backend safety quickly.
- cons: UX mismatch until follow-up.

## Selected Plan
Plan 1

## Implementation Steps
1. Added backend player removal method and route (`DELETE /api/players/:uuid`).
2. Added frontend player remove action in left list with confirmation and refresh handling.
3. Locked panel settings fields (serverPath/serverType/jarFile/pluginInstallDir) in UI and removed jar dropdown/refresh UI.
4. Added read-only server directories section for datapacks/mods/plugins.
5. Enforced protected field lock in backend settings update for standard panel saves while allowing setup/reset flows.
6. Ran backend syntax checks and frontend build.

## Validation
- backend checks: `node --check backend/src/services/playerService.js`, `node --check backend/src/routes/playerRoutes.js`, `node --check backend/src/services/settingsService.js`, `node --check backend/src/services/authService.js`, `node --check backend/src/routes/serverRoutes.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual runtime smoke test not executed in this batch

## Outcome
- completed changes: player removal flow added; settings page locked for server path/type/jar/plugin dir; fixed read-only directories shown (`world/datapacks`, `mods`, `plugins`); jar dropdown and refresh jar list removed.
- residual risks: if setup/reset logic changes later and bypasses `allowProtectedUpdates`, protected fields may remain immutable unexpectedly.
- follow-up: optional runtime smoke test in UI for removing a player and saving settings after server reset flow.
