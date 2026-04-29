# 2026-04-28 Login Required On Start and 5-Min Timeout

## Metadata
- Plan name: Login required after backend start + 5 minute auto logout
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Ensure the panel always requires login after Node.js backend restart and automatically logs users out after 5 minutes.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Short JWT lifetime (5m) and reject tokens issued before current backend process start.
- pros: Minimal changes, secure restart behavior, no DB/session store needed.
- cons: Session is fixed 5 minutes (not sliding inactivity).

### Plan 2
- approach: Stateful session store with server-side session invalidation and idle timeout tracking.
- pros: True inactivity timeout and fine-grained session control.
- cons: Larger refactor and more moving parts.

### Plan 3
- approach: Frontend-only timer with localStorage cleanup after 5 minutes.
- pros: Very fast implementation.
- cons: Insecure alone; backend would still accept old tokens.

## Selected Plan
Plan 1.

## Implementation Steps
1. Change backend JWT expiry to 5 minutes (configurable by env).
2. Invalidate tokens issued before backend process start.
3. Add frontend token-expiry scheduling to auto-logout at expiration.
4. Run backend syntax check and frontend production build.

## Validation
- backend checks: `node --check backend/src/services/authService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: token expiry + restart invalidation logic verified in code path.

## Outcome
- completed changes:
  - Backend issues short-lived JWTs and rejects pre-restart tokens.
  - Frontend now clears stale token on boot and auto-logs out at JWT expiration.
- residual risks:
  - Current timeout is fixed session length, not sliding inactivity.
- follow-up:
  - Add refresh-token or server-side session heartbeat if true inactivity timeout is needed.
