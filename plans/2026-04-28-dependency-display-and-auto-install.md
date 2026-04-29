# 2026-04-28-dependency-display-and-auto-install.md

## Metadata
- Plan name: Dependency Display and Auto-Install
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Add dependency metadata support to plugins/mods/datapacks entries, display dependencies in UI cards, and auto-install dependencies during install (including Modrinth inferred required dependencies when gist entries omit dependencies).

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Selected Plan
Implement end-to-end dependency flow in provider parsing, install services, and frontend metadata/display.

## Implementation Steps
1. Added backend dependency resolver service.
2. Wired plugin/datapack install services to auto-install dependencies.
3. Added cycle/duplicate guards for dependency installs.
4. Extended GitHub gist item mapping to include `dependencies`.
5. Added dependency display in plugin/datapack cards and passed dependency/context metadata at install time.

## Validation
- backend checks: `node --check backend/src/services/dependencyService.js`, `node --check backend/src/services/pluginService.js`, `node --check backend/src/services/worldService.js`, `node --check backend/src/services/modProviderService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: not run

## Outcome
- completed changes:
  - Dependencies can be declared in gist entries and are shown in UI.
  - Dependencies install automatically when available.
  - If dependencies are missing in gist and source URL is Modrinth CDN, required dependencies are inferred from Modrinth version metadata and installed for requested server version/loader when possible.
- residual risks:
  - Non-Modrinth external URLs cannot be inferred reliably for dependency graphs.
- follow-up:
  - Optional explicit dependency status UI (installed/missing/failed) per card.
