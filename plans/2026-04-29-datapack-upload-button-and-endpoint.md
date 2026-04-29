# 2026-04-29 Datapack Upload Button and Endpoint

## Metadata
- Plan name: Add local datapack upload in Worlds > Installed
- Date: 2026-04-29
- Status: completed
- Requested by: user

## Goal
Provide a direct upload button for local datapack `.zip` files in datapack section.

## Constraints
- Minecraft-only behavior
- No Hytale path logic
- Datapack path must remain `<server_root>/world/datapacks`

## Options
### Plan 1
- approach: Add dedicated world datapack upload API and wire upload button in WorldsPage.
- pros: clean UX, explicit datapack handling.
- cons: small backend/frontend additions.

### Plan 2
- approach: Reuse generic file upload API and ask user path manually.
- pros: fewer backend changes.
- cons: poor UX and path safety risk.

### Plan 3
- approach: No upload, remote-only installs.
- pros: no code.
- cons: does not meet requirement.

## Selected Plan
Plan 1.

## Implementation Steps
1. Add `POST /api/worlds/:name/datapacks/upload` with multer in world routes.
2. Add `worldService.uploadDatapack(...)` writing to `<server_root>/world/datapacks`.
3. Add `worldAPI.uploadDatapack(...)` multipart helper.
4. Add Upload Datapack button/input flow in Worlds Installed tab.
5. Validate backend syntax and frontend build.

## Validation
- backend checks:
  - `node --check backend/src/routes/worldRoutes.js`
  - `node --check backend/src/services/worldService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - upload flow writes datapack and refreshes installed list.

## Outcome
- completed changes:
  - Datapack upload button now exists in Worlds Installed section.
  - `.zip` upload is validated and installed safely.
- residual risks:
  - Non-zip datapack formats are rejected by design.
- follow-up:
  - Optional drag-and-drop upload support for datapacks.
