# 2026-04-27-settings-version-lock

## Metadata
- Plan name: Lock Server Version in Panel Settings
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Make server version non-editable in Settings > Panel Configuration and enforce the same lock in backend panel settings updates.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Lock field in UI and backend protected keys.
- pros: consistent with other locked runtime fields.
- cons: setup/reset flows must use explicit override when changing version.

### Plan 2
- approach: UI-only read-only field.
- pros: minimal risk.
- cons: API/manual updates can still change value.

### Plan 3
- approach: backend-only lock.
- pros: strict enforcement.
- cons: confusing UI still appears editable.

## Selected Plan
Plan 1

## Implementation Steps
1. Made `Server Version` read-only in `PanelSettingsForm`.
2. Added `serverVersion` to protected settings keys in `settingsService.update`.
3. Ran backend syntax and frontend build checks.

## Validation
- backend checks: `node --check backend/src/services/settingsService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual runtime smoke test not executed in this batch

## Outcome
- completed changes: server version no longer editable in settings UI and now protected by backend update policy.
- residual risks: setup/reset entry points that need to change version must continue to use protected-update override paths.
- follow-up: optional runtime check through full setup/reset flow.
