# 2026-04-27-spigot-paid-owned-first-sort

## Metadata
- Plan name: Spigot Paid Filter Owned-First Sorting
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
When filtering to paid Spigot resources, show already owned resources before buyable paid resources.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Backend route-level sort after entitlement enrichment (`isOwned` desc) for `provider=spigot` + `priceFilter=paid`.
- pros: deterministic ordering for all clients, minimal change.
- cons: sorting occurs within returned page items.

### Plan 2
- approach: Frontend-only sort in Plugins page.
- pros: quick UI patch.
- cons: not enforced server-side.

### Plan 3
- approach: Provider-level sort before pagination in Spiget provider.
- pros: better global paging semantics.
- cons: requires user entitlement context in provider layer.

## Selected Plan
Plan 1

## Implementation Steps
1. Update plugin search route to sort enriched paid Spigot items by `isOwned` descending.
2. Validate backend syntax.

## Validation
- backend checks:
  - `node --check backend/src/routes/pluginRoutes.js`
- frontend checks:
  - not required (backend-only change)
- runtime checks:
  - manual smoke test not executed in this batch

## Outcome
- completed changes:
  - Paid Spigot filtered search now returns owned resources first in each response page.
- residual risks:
  - Ordering is within page results; provider paging may still place some owned resources on later pages.
- follow-up:
  - move ownership-aware sorting earlier in provider search flow if cross-page prioritization is required.
