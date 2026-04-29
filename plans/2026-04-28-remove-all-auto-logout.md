# 2026-04-28 Remove All Auto Logout

## Metadata
- Plan name: Remove automatic logout behavior
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Disable all automatic logout and keep only manual logout behavior.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Remove frontend idle/server-status logout and backend restart token invalidation.
- pros: Fully matches request, minimal changes.
- cons: Sessions persist until manual logout.

### Plan 2
- approach: Keep restart invalidation only.
- pros: Adds restart safety.
- cons: Still automatic logout in some cases.

### Plan 3
- approach: Keep idle timer but increase timeout.
- pros: Security timeout retained.
- cons: Still unwanted auto logout behavior.

## Selected Plan
Plan 1.

## Implementation Steps
1. Remove frontend auto-logout effects and related config constants.
2. Remove backend startup-time token invalidation check.
3. Validate backend syntax and frontend build.

## Validation
- backend checks: `node --check backend/src/services/authService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual code verification of removed auto-logout paths.

## Outcome
- completed changes:
  - No inactivity-based logout.
  - No server-status-based logout.
  - No restart-based forced token invalidation.
- residual risks:
  - Sessions remain valid until manual logout.
- follow-up:
  - Reintroduce optional policy toggles later only if requested.
