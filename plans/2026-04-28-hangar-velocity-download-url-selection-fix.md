# 2026-04-28 Hangar Velocity Download URL Selection Fix

## Metadata
- Plan name: Fix Hangar Velocity download-url 400 for valid proxy plugins
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Resolve `400` from `/api/plugins/download-url` for Velocity when plugin has compatible builds in other returned versions.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Keep strict Velocity compatibility but scan all versions for `VELOCITY`/`WATERFALL` artifacts before failing.
- pros: Minimal safe fix, preserves compatibility guard.
- cons: Depends on provider returning compatible entries.

### Plan 2
- approach: Relax Velocity guard and allow Paper/Spigot fallback.
- pros: Fewer 400 errors.
- cons: Installs incompatible plugins on Velocity.

### Plan 3
- approach: Frontend-only retry/ignore.
- pros: Fast UI-only change.
- cons: Backend bug remains.

## Selected Plan
Plan 1.

## Implementation Steps
1. Update Hangar `getDownloadUrl` Velocity branch to scan all versions.
2. Keep strict allowed platforms (`VELOCITY`, `WATERFALL`).
3. Validate backend syntax.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`
- frontend checks: not required
- runtime checks: code-path verification for Velocity fallback scan.

## Outcome
- completed changes:
  - Velocity path no longer fails early on first selected version.
  - Service now returns compatible URL when available in another version.
- residual risks:
  - If provider truly has no Velocity/Waterfall asset, 400 remains expected.
- follow-up:
  - Optional: include provider version info in error text.
