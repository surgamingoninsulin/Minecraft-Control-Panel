# 2026-04-27-spigot-paid-free-fill-page-size

## Metadata
- Plan name: Spigot Paid/Free Filter Full Page Fill
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Ensure Spigot provider filtered results (`paid` or `free`) fill the configured 12-card page whenever enough matching resources exist.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Update Spiget provider search to paginate source API pages and collect filtered matches until target page is filled.
- pros: correct filtered pagination behavior and stable UX.
- cons: more API calls for sparse filters.

### Plan 2
- approach: Increase one-shot fetch size and keep local filtering.
- pros: small patch.
- cons: still fails when matches are sparse beyond fetch window.

### Plan 3
- approach: Frontend retries with additional pages.
- pros: no backend provider changes.
- cons: duplicates backend logic and increases client complexity.

## Selected Plan
Plan 1

## Implementation Steps
1. Replace one-shot Spiget fetch in provider search with paged loop (`size=50`, increment `page`).
2. Apply search + price filter while scanning.
3. Stop scanning once `(offset + pageSize)` filtered matches are collected or source exhausts.
4. Validate backend syntax and runtime filtered counts.

## Validation
- backend checks:
  - `node --check backend/src/services/modProviderService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - `modProviderService.search('Spigot', '', { serverType: 'paper', page: 1, pageSize: 12, priceFilter: 'paid' })`
  - `modProviderService.search('Spigot', '', { serverType: 'paper', page: 1, pageSize: 12, priceFilter: 'free' })`

## Outcome
- completed changes:
  - Spigot provider now fills filtered pages to target page size when enough matching data exists.
- residual risks:
  - Sparse filters may require multiple upstream API page fetches.
- follow-up:
  - add optional fetch-cycle telemetry if API performance tuning is needed.
