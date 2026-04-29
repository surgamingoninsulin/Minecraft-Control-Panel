# 2026-04-27-github-search-500-community-fault-tolerance

## Metadata
- Plan name: Github Search 500 Guard for Broken Community Gists
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Prevent Github provider search from failing with HTTP 500 when one merged community gist is invalid/unreachable.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Make merged gist loading fault-tolerant by skipping failed sources and continuing with valid ones; only error when no source can be loaded at all.
- pros: directly resolves user-visible 500 for partial failures.
- cons: bad source is silently excluded from results (logged server-side).

### Plan 2
- approach: keep fail-fast behavior.
- pros: strict data quality signal.
- cons: one bad gist breaks all Github search.

### Plan 3
- approach: disable community merge entirely.
- pros: avoids merge-related failures.
- cons: removes requested merge behavior.

## Selected Plan
Plan 1

## Implementation Steps
1. Wrapped per-source gist load in try/catch in Github provider catalog build.
2. Logged failing sources and continued processing other sources.
3. Kept hard failure only when zero valid sources produce items.
4. Ran backend syntax check.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`
- frontend checks: n/a
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: broken community gist no longer causes full Github provider search 500 when other gist sources are valid.
- residual risks: if all sources fail, search still correctly errors.
- follow-up: optional UI badge/warning for skipped gist sources.
