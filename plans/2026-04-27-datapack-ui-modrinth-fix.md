# 2026-04-27-datapack-ui-modrinth-fix

## Metadata
- Plan name: Datapack Installed/Uninstall UX + Modrinth Download Parity
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Fix datapack management UX so installed datapacks can be uninstalled, and ensure Modrinth datapack downloads follow the same provider download resolution pattern used for CurseForge.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add full uninstall datapack API + UI action; fix Modrinth provider download resolver bug in backend; align browse card install-state behavior with plugin page.
- pros: Complete user-visible fix, consistent UX, robust provider behavior.
- cons: Touches both frontend and backend.

### Plan 2
- approach: Only relabel installed button to Uninstall without wiring backend delete.
- pros: Small change.
- cons: Misleading button, incomplete functionality.

### Plan 3
- approach: Keep UI unchanged and patch only Modrinth backend resolver.
- pros: Lowest risk backend-only fix.
- cons: Does not satisfy uninstall UX request.

## Selected Plan
Plan 1

## Implementation Steps
1. Patch `ModrinthProvider.getDownloadUrl` to accept options and respect datapack extension preference.
2. Add datapack uninstall endpoint/service in universe backend and expose it via frontend API.
3. Update datapack cards in Worlds page: installed cards show active `Uninstall`; browse cards show `Installed` state when already present.
4. Run backend syntax checks and frontend production build.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`, `node --check backend/src/services/universeService.js`, `node --check backend/src/routes/universeRoutes.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual runtime smoke test not executed in this batch

## Outcome
- completed changes: uninstall flow added, installed-card button updated, browse install-state parity added, Modrinth datapack download resolver corrected.
- residual risks: installed detection in browse tab uses modId/displayName matching and may miss edge-case manual installs with unrelated names.
- follow-up: optionally add backend/world refresh smoke test and broaden installed matching if users report duplicates.
