# 2026-04-28 Forge Libraries Bundle Extraction Fix

## Metadata
- Plan name: Fix Forge missing required libraries at startup
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Ensure Forge startup has required `libraries/...` files available after download.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Extract full wrapped Forge bundle to server directory and keep runnable jar in configured jar filename.
- pros: Preserves required `libraries/` tree and bootstrap compatibility.
- cons: Requires post-download extraction logic.

### Plan 2
- approach: Download only inner runnable jar.
- pros: small artifact.
- cons: misses required libraries (current failure).

### Plan 3
- approach: switch to installer execution.
- pros: official flow.
- cons: conflicts with no-installer requirement.

## Selected Plan
Plan 1.

## Implementation Steps
1. Update downloader unwrap function to extract all files from wrapped bundle.
2. Keep configured output jar path updated with inner runnable `server.jar`.
3. Repair current local server folder by re-extracting forge bundle.

## Validation
- backend checks:
  - `python -m py_compile backend/scripts/server_downloader.py`
- runtime checks:
  - `Server/libraries/...` required sample files present.
  - `forge-1.21.11.jar` remains runnable shim jar with manifest/main class.

## Outcome
- completed changes:
  - Future forge downloads now unpack full bundle + libraries.
  - Current server folder repaired with required libraries.
- residual risks:
  - If upstream archive layout changes significantly, extraction heuristics may need update.
- follow-up:
  - Re-run install flow once to verify end-to-end in UI.
