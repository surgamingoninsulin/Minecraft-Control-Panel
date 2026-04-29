# 2026-04-27-smithed-provider-and-paid-filter-foundation

## Metadata
- Plan name: Add Smithed Datapack Provider + Paid/Free Filter Foundation
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Add Smithed as a new datapack provider and introduce provider-level groundwork for paid/free filtering and provider credentials UX updates (including Spiget credentials fields).

## Constraints
- Minecraft-only behavior
- No Hytale path logic
- Keep datapack install target behavior unchanged (`<server_root>/world/datapacks`)

## Options
### Plan 1
- approach: Implement full backend + frontend support for Smithed datapack search/download, add generic `priceFilter` support for provider search, and add Spiget credential fields in Provider APIs with explicit ownership-check limitations.
- pros: ships requested functionality and future-ready structure now.
- cons: Spigot paid ownership verification still not technically possible via official API.

### Plan 2
- approach: Implement Smithed provider only.
- pros: minimal change, fastest.
- cons: misses user-requested paid/free filter and credentials additions.

### Plan 3
- approach: Add UI-only credentials/filter controls without backend provider updates.
- pros: lowest backend risk.
- cons: misleading UX until backend catches up.

## Selected Plan
Plan 1

## Implementation Steps
1. Add `SmithedProvider` in backend provider service and include it in datapack provider list.
2. Add generic `priceFilter` option in plugin search route/API and provider service filtering.
3. Add Spiget credential fields to settings defaults/merge and Provider APIs settings UI.
4. Add paid/free/all filter control in Plugins browse tab and wire request parameter.
5. Run backend syntax checks and frontend build.

## Validation
- backend checks:
  - `node --check backend/src/services/modProviderService.js`
  - `node --check backend/src/services/settingsService.js`
  - `node --check backend/src/routes/pluginRoutes.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - `modProviderService.getProviderNames({ resourceType: 'datapack' })` includes `Smithed`
  - `modProviderService.search('Smithed', 'classic', { resourceType: 'datapack', serverVersion: '1.21.5' })`
  - `modProviderService.getDownloadUrl('Smithed', <packId>, null, { resourceType: 'datapack', serverVersion: '1.21.5' })`

## Outcome
- completed changes:
  - Added a working `Smithed` datapack provider to backend search/download flow.
  - Added `priceFilter` (`all`/`free`/`paid`) support from frontend API calls through backend provider search.
  - Added Spiget credential fields in Provider APIs settings and settings persistence shape.
  - Added paid/free filter control in Plugins browse tab.
- residual risks:
  - Spiget public API does not provide paid ownership verification for a logged-in buyer account.
  - `priceFilter` pagination accuracy depends on upstream provider pagination behavior.
- follow-up:
  - Add provider capability badges (e.g., ownership-check supported vs not supported) in UI.
