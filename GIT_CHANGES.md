# Git Changes Log

This file tracks applied code changes so future work can continue with full context.

## 2026-04-26

### Server Runtime + Stability
- Fixed async route handling in backend server routes:
  - `POST /api/server/start` now `await`s `serverService.start()`.
  - `POST /api/server/restart` now `await`s `serverService.restart()`.
- This prevents unhandled promise rejections that could crash the backend process.

### Server Lifecycle Behavior
- Updated server lifecycle management in `backend/src/services/serverService.js`:
  - Added PID tracking initialization (`this.pid`).
  - Added `stopRequested` flag to distinguish intentional stop vs unexpected exit.
  - Added explicit `stopping` status emission on stop.
  - Improved close-event logging:
    - intentional: `Server stopped with code ...`
    - unexpected: `Server exited unexpectedly with code ...`

### Console Persistence
- Added persisted console history support:
  - New log file: `data/server-console.log`
  - Load previous log history on service startup.
  - Append live log lines to disk as they arrive.
- Goal: avoid "console cleared" effect after backend restarts.

### Frontend Socket/Console Fixes
- Updated `frontend/src/services/socket.js`:
  - Prevents duplicate socket creation by reusing existing socket instance.
  - Uses `connect_error` handler for clearer connection diagnostics.
- Updated `frontend/src/pages/ConsolePage.jsx`:
  - Safer console history hydration that avoids replacing newer live logs with shorter history payloads.

### Verification Notes
- Frontend production build succeeded (`vite build`).
- Backend changed modules load successfully.
- Backend start command reported `EADDRINUSE` on port `3000` during check, indicating an existing running backend instance.

