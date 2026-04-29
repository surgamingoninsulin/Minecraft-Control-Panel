# 2026-04-28 Modded First-run Baseline Files and Netty No-native

## Metadata
- Plan name: Fix first-run missing server.properties/eula noise and native Netty debug stack traces
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Make Forge/NeoForge/Fabric first launch cleaner by pre-creating required baseline files and reducing platform-native Netty debug noise.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add server startup preflight for modded types to create baseline `server.properties`/`eula.txt` and add `-Dio.netty.transport.noNative=true`.
- pros: No installer/UI changes, robust for manual and auto setups.
- cons: Applies only when launched via panel.

### Plan 2
- approach: Add this only in installer flow.
- pros: isolated to auto-install path.
- cons: misses manual setup path and existing installs.

### Plan 3
- approach: Ignore as harmless first-run noise.
- pros: no code.
- cons: poor UX and repeated confusion.

## Selected Plan
Plan 1.

## Implementation Steps
1. Add startup preflight helper in server service for modded server types.
2. Ensure baseline `server.properties` and `eula.txt` exist before spawn.
3. Add `-Dio.netty.transport.noNative=true` JVM arg for modded starts.
4. Run backend syntax check.

## Validation
- backend checks:
  - `node --check backend/src/services/serverService.js`
- frontend checks:
  - not required
- runtime checks:
  - code-path verification for preflight creation and JVM flag injection.

## Outcome
- completed changes:
  - First-run missing `server.properties`/`eula.txt` warnings prevented for Forge/NeoForge/Fabric starts via panel.
  - Native Netty transport probing disabled for modded starts to reduce platform-specific debug stack spam.
- residual risks:
  - External/manual starts outside panel still depend on external scripts/config.
- follow-up:
  - Optional: expose a panel setting to control `eula=true` auto-write behavior.
