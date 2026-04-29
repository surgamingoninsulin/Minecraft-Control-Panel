## Metadata
- Plan name: Re-add Spigot provider as free-only
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Restore Spigot as a plugin browse provider while enforcing free-only plugin visibility and blocking paid plugin installs through provider flow.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Reintroduce Spigot provider in backend only, filter out paid entries in search, and reject paid downloads with upload-jar guidance.
- pros: Minimal, safe, aligned with requested behavior.
- cons: Author display remains limited to author ID unless extra API calls are added.

### Plan 2
- approach: Add Spiget credentials and ownership verification to allow paid entries too.
- pros: Full paid flow.
- cons: Opposite of request and higher complexity/risk.

### Plan 3
- approach: Keep Spigot removed and direct users to manual uploads only.
- pros: Simplest maintenance.
- cons: Loses free Spigot browser convenience.

## Selected Plan
Plan 1

## Implementation Steps
1. Add `SpigotProvider` back into `modProviderService` with free-only filtering.
2. Register `Spigot` in plugin provider list.
3. Enforce paid download block for Spigot resources with clear error message.
4. Run backend syntax check and frontend production build.

## Validation
- backend checks:
  - `node --check backend/src/services/modProviderService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - `modProviderService.getProviderNames({ serverType: 'paper' })` includes `Spigot`
  - `modProviderService.search('Spigot', 'essentials', { serverType: 'paper', page: 1, pageSize: 12 })` returns free-only results and fills 12 cards when available

## Outcome
- completed changes:
  - Spigot provider restored for plugin browsing/install flow.
  - Paid Spigot resources are excluded from search and blocked on download resolution.
- residual risks:
  - Spiget API schema changes could require mapping adjustments.
- follow-up:
  - Optionally resolve author names via additional author API calls if needed for UI polish.
