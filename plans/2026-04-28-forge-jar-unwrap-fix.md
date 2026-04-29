# 2026-04-28 Forge Jar Unwrap Fix

## Metadata
- Plan name: Fix Forge invalid/corrupt jarfile startup
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Prevent `Invalid or corrupt jarfile forge-*.jar` by ensuring downloaded Forge artifact is a runnable server jar.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Keep current download sources and auto-unwrap zip-wrapped server jar artifacts after download.
- pros: Minimal change, works with current provider format.
- cons: Adds post-processing step.

### Plan 2
- approach: Switch back to installer jars and run installer pipeline.
- pros: Forge-native setup path.
- cons: Contradicts project request to avoid installer downloads.

### Plan 3
- approach: Manual user intervention each install.
- pros: zero code.
- cons: poor UX and repeat failures.

## Selected Plan
Plan 1.

## Implementation Steps
1. Add downloader post-step to detect jar without manifest and extract inner `server.jar` from zip payload.
2. Validate script syntax.
3. Repair currently downloaded Forge jar in workspace server directory.

## Validation
- backend checks:
  - `python -m py_compile backend/scripts/server_downloader.py`
- runtime checks:
  - Existing `forge-1.21.11.jar` repaired and now includes `META-INF/MANIFEST.MF` + `Main-Class`.

## Outcome
- completed changes:
  - New installs auto-fix wrapped forge artifacts.
  - Current broken Forge jar fixed in place.
- residual risks:
  - If upstream artifact format changes, unwrap heuristics may need adjustment.
- follow-up:
  - Re-run auto-install for Forge versions to regenerate fully clean server folders when needed.
