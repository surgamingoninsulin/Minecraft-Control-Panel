# 2026-04-28-provider-aio-gist-install-routing-and-neoforge-fixes.md

## Metadata
- Plan name: Provider AIO Gist, Install Routing, and NeoForge Fixes
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Fix provider image behavior, split built-in GitHub providers by resource type using AIO gist sections, enforce server-type install directories, and correct NeoForge version resolution behavior.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Minimal targeted backend/frontend updates in provider, installer, and install-path logic.
- pros: Fast and low-risk.
- cons: Leaves broader provider UI refactors for later.

### Plan 2
- approach: Large provider-system redesign with new schema and migrations.
- pros: maximal consistency.
- cons: high risk and long implementation.

### Plan 3
- approach: Frontend-only masking/workarounds.
- pros: quickest UI fixes.
- cons: core backend behavior bugs remain.

## Selected Plan
Plan 1

## Implementation Steps
1. Updated install-path selection to follow server type (`mods` for forge/neoforge/fabric, `plugins` for plugin server types).
2. Updated settings normalization to keep `pluginInstallDir` aligned to server type.
3. Fixed NeoForge version selection logic in downloader script to map from MC versions (and fail clearly if mapping absent).
4. Updated GitHub provider to support AIO gist top-level sections (`plugins`, `datapacks`, `mods`).
5. Added built-in unremovable providers: `Github Plugins`, `Github Datapacks`, `Github Mods` with server-type/resource filtering.
6. Improved frontend provider fallback behavior for Spigot alias keys and removed forced white logo background.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`, `node --check backend/src/services/pluginService.js`, `node --check backend/src/services/settingsService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: `python -m py_compile backend/scripts/server_downloader.py`

## Outcome
- completed changes:
  - Install directory routing now respects server type.
  - NeoForge downloader no longer silently falls to latest unrelated branch when MC version mapping fails.
  - GitHub provider now reads sectioned AIO gist payload and exposes 3 built-in GitHub providers by resource mode.
  - Spigot placeholder matching improved for alias provider names; GitHub transparent logos no longer forced onto white background.
- residual risks:
  - If gist content is not migrated to the new `plugins`/`datapacks`/`mods` top-level shape, non-plugin GitHub providers may return no entries.
- follow-up:
  - migrate active gist payloads to the AIO sectioned format and verify each section has correct entries/version tags.
