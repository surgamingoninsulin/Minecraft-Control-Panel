## Metadata
- Plan name: Remove Spigot/Spiget provider and paid plugin flow
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Remove all Spigot/Spiget provider code and remove paid-resource filtering/entitlement behavior so plugin browse/install is free-only.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Remove backend provider, routes, settings fields, frontend filters/actions, then validate with syntax/build checks.
- pros: Complete cleanup with consistent UI/API behavior.
- cons: Breaking change for any workflow depending on paid entitlement metadata.

### Plan 2
- approach: Keep backend paid internals but hide paid UI controls.
- pros: Smaller patch.
- cons: Leaves dead/unused behavior and confusing API surface.

### Plan 3
- approach: Feature-flag paid/spigot behavior off by default.
- pros: Reversible.
- cons: More complexity and still ships unused code paths.

## Selected Plan
Plan 1

## Implementation Steps
1. Remove Spigot/Spiget provider classes/registration/settings and price filter handling from backend provider/search path.
2. Remove entitlement service/routes/install guard and paid sorting/enrichment from plugin routes.
3. Remove paid filter and entitlement UI/API calls in frontend plugins/settings pages.
4. Validate backend syntax and frontend production build.

## Validation
- backend checks:
  - `node --check backend/src/services/modProviderService.js`
  - `node --check backend/src/routes/pluginRoutes.js`
  - `node --check backend/src/services/settingsService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - `rg -n "\bisPaid\b|priceFilter|entitlement|spiget" backend/src frontend/src -S` returns no matches

## Outcome
- completed changes:
  - Removed Spigot/Spiget provider and all paid ownership/entitlement/filter code paths from backend and frontend.
  - Plugin browse/install now operates as free-only flow.
- residual risks:
  - Existing external tooling expecting removed entitlement endpoints will fail until updated.
- follow-up:
  - If needed later, reintroduce paid support behind a feature flag with explicit provider API contracts.
