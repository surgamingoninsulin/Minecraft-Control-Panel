# 2026-04-28 Forge/NeoForge Runtime Download and Velocity Compatibility Guard

## Metadata
- Plan name: Stop installer-jar downloads for Forge/NeoForge and fix Velocity plugin compatibility errors
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
1. Ensure Forge/NeoForge server setup downloads the selected server runtime artifact (not installer jars).
2. Prevent incompatible plugin install attempts on Velocity from failing as HTTP 500.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Switch Forge/NeoForge resolver to MCJars runtime artifacts and add Velocity compatibility guards + 400 error mapping.
- pros: Minimal, targeted, aligns with existing downloader/provider architecture.
- cons: Depends on MCJars coverage for those server types.

### Plan 2
- approach: Keep Maven installer flow and post-process installer execution server-side.
- pros: Works with upstream installer ecosystem.
- cons: Higher complexity and contradicts requirement to avoid installer downloads.

### Plan 3
- approach: Frontend-only guard to hide/install-block incompatible providers.
- pros: Fast UI fix.
- cons: Backend APIs could still return 500 and installer issue remains unresolved.

## Selected Plan
Plan 1.

## Implementation Steps
1. Replace Forge/NeoForge downloader URLs from installer jars to MCJars runtime jar endpoints.
2. Restrict Velocity provider list to Velocity-compatible sources.
3. Make Hangar download selection strict for Velocity platforms.
4. Return HTTP 400 (not 500) for known compatibility violations.

## Validation
- backend checks:
  - `node --check backend/src/routes/pluginRoutes.js`
  - `node --check backend/src/services/modProviderService.js`
- frontend checks:
  - not required (no frontend file edits)
- runtime checks:
  - python downloader syntax check: `python -m py_compile backend/scripts/server_downloader.py`

## Outcome
- completed changes:
  - Forge/NeoForge downloader now resolves runtime jars through MCJars, avoiding `*-installer.jar`.
  - Velocity mode provider list excludes Spigot.
  - Hangar velocity flow no longer falls back to Paper/Spigot artifacts.
  - Compatibility failures now return clear HTTP 400 errors.
- residual risks:
  - MCJars availability dictates which Forge/NeoForge versions are downloadable.
- follow-up:
  - Add UI badge/message for “Velocity-only compatible” project filtering if desired.
