# 2026-04-28 Idle-only Logout or Server Offline Logout

## Metadata
- Plan name: Logout only on inactivity or server offline
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Make logout happen only after 5 minutes of no active use, or when server is not running.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Frontend inactivity timer + server status polling; backend token no short expiry.
- pros: Matches requested behavior closely.
- cons: Requires browser activity tracking.

### Plan 2
- approach: Keep short JWT expiry and add token refresh endpoint.
- pros: More formal auth lifecycle.
- cons: More backend/API complexity.

### Plan 3
- approach: Server-side session store with heartbeat.
- pros: Strong central control.
- cons: Largest refactor.

## Selected Plan
Plan 1.

## Implementation Steps
1. Remove 5-minute hard token expiry in backend.
2. Keep restart invalidation guard.
3. Add 5-minute inactivity logout in frontend based on user activity events.
4. Add server-status polling and logout when status is not `online`.
5. Validate backend syntax and frontend build.

## Validation
- backend checks: `node --check backend/src/services/authService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: inactivity timer and server-offline logout implemented in auth context.

## Outcome
- completed changes:
  - Session no longer expires every 5 minutes while actively using.
  - Auto logout occurs after inactivity timeout or non-running server status.
- residual risks:
  - Server-status check is polling based (default 15s).
- follow-up:
  - Optionally switch to socket-driven instant logout on status event.
