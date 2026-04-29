# 2026-04-28-universe-to-world-rename-with-compat-alias.md

## Metadata
- Plan name: Universe-to-World Rename with Compatibility Alias
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Replace legacy `universe`/`universes` naming in backend/frontend code and file names with Minecraft `world`/`worlds` naming, while preserving temporary API compatibility for existing `/api/universes/*` clients.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Full rename to `world` naming plus backend alias for `/api/universes/*`
- pros: Clean naming now with low break risk
- cons: Temporary duplicate route mount to remove later

### Plan 2
- approach: Full rename and immediate removal of `/api/universes/*`
- pros: Cleanest API surface immediately
- cons: Breaks existing callers instantly

### Plan 3
- approach: Rename internals/UI only; keep `universes` API names
- pros: Least API change
- cons: Preserves legacy naming debt in API contract

## Selected Plan
Plan 1

## Implementation Steps
1. Renamed backend/frontend files and symbols from `universe*` to `world*`.
2. Switched primary API path to `/api/worlds/*` and kept `/api/universes/*` alias.
3. Updated frontend routes/API client/component imports and world-facing labels.
4. Ran backend syntax checks and frontend build.
5. Updated plan status and global memory files.

## Validation
- backend checks: `node --check backend/src/server.js`, `node --check backend/src/routes/worldRoutes.js`, `node --check backend/src/services/worldService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: not run

## Outcome
- completed changes:
  - File renames to world naming in backend/frontend pages/routes/services
  - Backend primary route moved to `/api/worlds` with compatibility alias `/api/universes`
  - Frontend worlds page and API client now use `worldAPI` and `/worlds`
  - About page copy updated from "Minecraft universes" to "Minecraft worlds"
- residual risks:
  - External bookmarks/integrations pointing to frontend `/universes` path no longer match unless redirected elsewhere.
- follow-up:
  - Remove `/api/universes` alias after clients fully migrate.
