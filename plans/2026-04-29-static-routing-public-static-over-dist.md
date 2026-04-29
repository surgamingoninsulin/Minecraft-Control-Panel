## Metadata
- Plan name: 2026-04-29-static-routing-public-static-over-dist
- Date: 2026-04-29
- Status: completed
- Requested by: user

## Goal
- Route static assets to `frontend/public/static`.
- Minimize reliance on `frontend/dist` for static files.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Keep existing dist-only serving.
- pros: no change
- cons: does not satisfy request

### Plan 2
- approach: Serve `/static` from `frontend/public/static`, keep `dist` for built app shell.
- pros: aligns with request while preserving production app runtime
- cons: `dist` still required for compiled SPA

### Plan 3
- approach: Remove dist serving entirely.
- pros: no dist dependency
- cons: production frontend cannot run without compiled assets

## Selected Plan
- Plan 2

## Implementation Steps
1. Add explicit `/static` route from `frontend/public/static` in backend.
2. Keep `frontend/dist` only for built SPA hosting fallback.
3. Validate backend syntax.

## Validation
- backend checks: `node --check backend/src/server.js`
- frontend checks: n/a
- runtime checks: n/a

## Outcome
- completed changes:
  - Added `/static` serving from `frontend/public/static`.
  - Preserved dist-based SPA serving for production compatibility.
- residual risks:
  - Removing `frontend/dist` still breaks non-Vite production serving.
- follow-up:
  - If desired, switch to dedicated frontend hosting and remove backend SPA serving entirely.
