# 2026-04-28-backend-working-directory-anchor.md

## Metadata
- Plan name: Backend Working Directory Anchor
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Ensure the backend always runs with `<project>/backend` as working directory so paths like `backend/Server` and backend `data/` are not resolved into old parent folders.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add backend bootstrap that `chdir`s to backend root before loading server, and update npm scripts to use bootstrap.
- pros: launch-location independent and robust.
- cons: one additional entry file.

### Plan 2
- approach: depend only on launcher scripts (`cd` to expected folder).
- pros: minimal code changes.
- cons: fragile when backend launched another way.

### Plan 3
- approach: convert all `path.resolve(...)` usage to absolute file-based roots.
- pros: very explicit.
- cons: larger invasive refactor.

## Selected Plan
Plan 1

## Implementation Steps
1. Added `backend/src/index.js` bootstrap to set `process.chdir(<project>/backend)`.
2. Updated backend npm scripts to run `src/index.js`.
3. Hardened `start.vbs` by setting `shell.CurrentDirectory` to script folder.
4. Ran syntax/build checks.

## Validation
- backend checks: `node --check backend/src/index.js`, `node --check backend/src/server.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: not run

## Outcome
- completed changes:
  - Backend working directory now always anchored to project backend root.
  - Startup script context now explicitly anchored to script directory.
- residual risks:
  - Existing saved `serverPath` can still point to old location if previously configured; user may need to update once in setup/settings.
- follow-up:
  - Optional migration helper to auto-detect stale `serverPath` outside project tree.
