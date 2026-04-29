## Metadata
- Plan name: Fix Smithed datapack pagination and author overflow
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Fix Smithed datapack browse so users can paginate properly, and prevent long author values from overflowing datapack cards.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add true Smithed page-based backend pagination + Worlds browse page controls + CSS text clamping.
- pros: Resolves backend and UI causes together.
- cons: Adds extra Smithed user lookup requests for author display names.

### Plan 2
- approach: UI-only pagination with local slicing.
- pros: quick patch.
- cons: still wrong when provider paging is unavailable/incorrect.

### Plan 3
- approach: truncate owner IDs only in UI.
- pros: smallest change.
- cons: does not solve missing pagination.

## Selected Plan
Plan 1

## Implementation Steps
1. Update Smithed provider to use API `page` + `limit` and compute `hasMore` from count.
2. Resolve Smithed owner IDs to display names via `/users/:id` with cache.
3. Add datapack browse pagination controls (Previous/Next) in Worlds page.
4. Clamp author/provider text overflow in datapack card meta row CSS.

## Validation
- backend checks:
  - `node --check backend/src/services/modProviderService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - `modProviderService.search('Smithed', '', { resourceType: 'datapack', page: 1, pageSize: 12 })`
  - `modProviderService.search('Smithed', '', { resourceType: 'datapack', page: 2, pageSize: 12 })`
  - Verified first items differ between page 1 and page 2
  - Verified author values resolve to display names (example: `CreeperMagnet_`)

## Outcome
- completed changes:
  - Smithed datapacks now support usable pagination in backend + Worlds UI.
  - Long author/provider values no longer overflow outside cards.
- residual risks:
  - Smithed user endpoint failures fall back to owner ID strings.
- follow-up:
  - Optional: add direct page jump UI if users want faster deep navigation.
