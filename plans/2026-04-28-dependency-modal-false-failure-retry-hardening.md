# 2026-04-28 Dependency Modal False Failure Retry Hardening

## Metadata
- Plan name: Harden dependency modal to avoid instant false red failures
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Prevent immediate red “Install failed (continuing)” when dependency actually installs/already exists.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add pre-check and retry-based verification by modId, display name, and filename before marking failure.
- pros: Robust against short backend write timing and metadata variance.
- cons: Slightly more API calls.

### Plan 2
- approach: Delay all rows with fixed sleep before status update.
- pros: simple.
- cons: slower UX, still not deterministic.

### Plan 3
- approach: backend transaction/result contract for dependency rows.
- pros: authoritative.
- cons: larger refactor.

## Selected Plan
Plan 1.

## Implementation Steps
1. Expand dependency verification helper with retries and filename matching.
2. Add “already installed” pre-check before dependency install attempt.
3. On install exception, retry verify before showing failed.
4. Validate frontend build.

## Validation
- frontend checks:
  - `npm --prefix frontend run build`
- backend checks:
  - not required
- runtime checks:
  - modal status path now prefers installed/already-installed states before failure.

## Outcome
- completed changes:
  - Dependency modal now avoids instant false red status when dependency lands successfully.
- residual risks:
  - Rare race conditions still possible with extreme IO lag.
- follow-up:
  - Optional: backend explicit dependency row result API.
