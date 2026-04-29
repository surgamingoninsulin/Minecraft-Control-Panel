# 2026-04-28-provider-placeholders-and-loading-spinner.md

## Metadata
- Plan name: Provider Placeholders and Loading Spinner Standardization
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Use provider-specific colored placeholder images when plugin/datapack logos are missing, and use the shared loading spinner image for loading actions.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add provider placeholder mapping in plugin/world pages and replace loading icons with static spinner asset where actions are loading.
- pros: minimal scope, immediate UX consistency.
- cons: does not auto-refactor every loading state across entire app.

### Plan 2
- approach: create global image utility and refactor all pages/components.
- pros: centralized behavior.
- cons: larger refactor and more risk.

### Plan 3
- approach: backend-provided fallback logos only.
- pros: less frontend logic.
- cons: no control for local installed items without provider metadata.

## Selected Plan
Plan 1

## Implementation Steps
1. Added provider-specific placeholder logic in Plugins page.
2. Added Smithed placeholder logic in Worlds page.
3. Replaced loading action icons in Plugins/Worlds with `/static/images/loading-spinner.svg`.
4. Added missing `neoforge.svg` asset path (copied from forge placeholder).
5. Ran frontend build validation.

## Validation
- backend checks: N/A
- frontend checks: `npm --prefix frontend run build`
- runtime checks: not run

## Outcome
- completed changes:
  - Spigot/Hangar/Forge/NeoForge/Fabric/Smithed placeholders are now used for missing logos in relevant browse/install cards.
  - Worlds datapack cards use Smithed placeholder for missing Smithed logos.
  - Loading button states in Plugins/Worlds now use shared loading spinner SVG asset.
  - Added `frontend/public/static/images/neoforge.svg` file.
- residual risks:
  - Non-mapped providers still fall back to generic icon behavior.
- follow-up:
  - Optional: standardize spinner usage across all remaining pages/components.
