# 2026-04-27-lock-community-gist-url-and-diagnose-500

## Metadata
- Plan name: Lock Community Gist URLs + Diagnose Test Gist 500
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Make community provider gist URLs immutable once added, and identify why provided test gist returns 500.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: UI read-only gist URL for existing providers + backend enforcement preserving existing gistUrl on update; diagnose gist payload validity.
- pros: robust lock and clear root-cause diagnosis.
- cons: gist URL changes require remove+re-add flow.

### Plan 2
- approach: UI-only lock.
- pros: minimal changes.
- cons: API payload could still modify gist URL.

### Plan 3
- approach: backend-only lock.
- pros: strict.
- cons: confusing UI still appears editable.

## Selected Plan
Plan 1

## Implementation Steps
1. Made existing community provider gist URL input read-only in Provider Sources UI.
2. Enforced backend lock to preserve existing gistUrl for existing provider IDs/names during settings update.
3. Ran backend syntax + frontend build checks.
4. Diagnosed test gist payload issue causing 500.

## Validation
- backend checks: `node --check backend/src/services/settingsService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual provider UI smoke test not executed in this batch

## Outcome
- completed changes: gist URL can no longer be edited after provider creation (UI + backend).
- residual risks: changing gist URL now requires removing and re-adding provider.
- follow-up: optional explicit backend error message for invalid JSON gist payloads.
