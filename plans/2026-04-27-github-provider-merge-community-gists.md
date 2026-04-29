# 2026-04-27-github-provider-merge-community-gists

## Metadata
- Plan name: Merge Community Gists into Built-in Github Provider
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Ensure built-in `Github` provider includes content from enabled community Github gist providers in addition to the baked-in gist source.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Extend built-in Github catalog loader to aggregate community gist sources while keeping custom providers available as standalone entries.
- pros: matches requested behavior with minimal surface changes.
- cons: possible duplicate entries if same plugin appears in multiple gists.

### Plan 2
- approach: Replace standalone community providers entirely and only show Github.
- pros: simple UX.
- cons: breaks existing provider separation expectations.

### Plan 3
- approach: No merge; require users to select each community provider separately.
- pros: no code change.
- cons: does not satisfy request.

## Selected Plan
Plan 1

## Implementation Steps
1. Added source resolution for built-in Github to include enabled community Github gist URLs.
2. Aggregated all gist rows into one catalog with ID dedupe.
3. Namespaced IDs from non-primary gist sources to avoid collisions with baked-in entries.
4. Ran backend syntax check.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`
- frontend checks: n/a
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: built-in Github provider now merges community gist content while preserving original baked-in source.
- residual risks: duplicate logical plugins across sources may still appear if IDs differ.
- follow-up: optionally add dedupe by normalized name+author in future.
