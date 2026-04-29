## Metadata
- Plan name: Install failure dependency resolution hardening
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Fix plugin/mod/datapack remote install failures so dependency installs succeed and main install completes.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Patch dependency resolution and installer fallback in current pipeline.
- pros: Small, safe change set; fastest to verify.
- cons: Still depends on provider feed quality.

### Plan 2
- approach: Rework installer around queue/state machine.
- pros: More explicit orchestration.
- cons: Large UI/backend rewrite risk.

### Plan 3
- approach: Disable dependency auto-install and force manual install.
- pros: Simple backend.
- cons: Poor UX and violates user requirement.

## Selected Plan
Plan 1

## Implementation Steps
1. Reproduce failure in backend install flow with provider item and dependencies.
2. Patch search/dependency/registry handling causing dependency miss and silent fail.
3. Run clean install test and verify both dependency + requested plugin are installed with non-zero sizes.

## Validation
- backend checks: `node --check backend/src/services/pluginService.js`, `node --check backend/src/services/dependencyService.js`, `node --check backend/src/services/modProviderService.js`
- frontend checks: N/A for this batch
- runtime checks: Cleaned test plugins dir, installed `pylon-plugin` from `Github Plugins`, verified `Pylon.jar` and `Rebar.jar` exist with non-zero bytes.

## Outcome
- completed changes: Dependency lookup by ID now matches in gist provider search; dependency metadata now carries version fields; registry save path is created before write.
- residual risks: Bad/mismatched gist URLs can still install unexpected artifacts if source metadata is wrong.
- follow-up: Add optional strict checksum/file-name assertions for dependency installs.
