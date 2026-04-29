# 2026-04-29 Multi Upload Datapacks and Confirm Plugins

## Metadata
- Plan name: Enable multi-file datapack uploads and keep multi-jar plugin uploads
- Date: 2026-04-29
- Status: completed
- Requested by: user

## Goal
Allow uploading multiple `.zip` datapacks in one action, and ensure Mods/Plugins supports multiple `.jar` files.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add multi-part multi-file datapack API and frontend multi-select input.
- pros: smooth UX, efficient batch upload.
- cons: small API change.

### Plan 2
- approach: Keep single-file API and loop client calls.
- pros: no backend change.
- cons: more round-trips and slower UX.

### Plan 3
- approach: Generic file API path upload.
- pros: fewer domain APIs.
- cons: weaker domain safety and worse UX.

## Selected Plan
Plan 1.

## Implementation Steps
1. Extend world upload route to accept both single and multi-file form keys.
2. Add frontend `worldAPI.uploadDatapacks(...)` helper.
3. Switch datapack file input to `multiple` and send all selected files.
4. Validate backend syntax and frontend build.

## Validation
- backend checks:
  - `node --check backend/src/routes/worldRoutes.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - datapack upload endpoint returns uploaded filename list.

## Outcome
- completed changes:
  - Datapacks now support multi-select and multi-upload in one action.
  - Mods/Plugins multi-jar upload remains supported (already existing behavior).
- residual risks:
  - Very large batch uploads may take longer and appear as one operation in UI.
- follow-up:
  - Optional per-file progress/status UI for datapack batch uploads.
