# 2026-04-27-hide-community-provider-entry-merge-into-github

## Metadata
- Plan name: Hide Community Provider Entries and Merge into Github
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Do not expose community gist providers as separate provider entries in dropdowns; keep only built-in `Github` provider while using merged community content.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Restrict provider names returned by `getProviderNames` to built-ins only for plugin mode; keep merged catalog behavior in built-in Github provider.
- pros: matches requested UX with minimal safe change.
- cons: direct custom-provider selection by name is no longer available.

### Plan 2
- approach: Keep custom entries but rename/group them under Github in frontend.
- pros: preserves per-provider identity.
- cons: more UI complexity and still shows multiple entries.

### Plan 3
- approach: Remove custom provider registry entirely.
- pros: strict model.
- cons: larger refactor risk.

## Selected Plan
Plan 1

## Implementation Steps
1. Updated backend `getProviderNames` plugin mode output to built-in providers only.
2. Kept merged catalog behavior in built-in Github provider.
3. Ran backend syntax check.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`
- frontend checks: n/a
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: community gist providers no longer create separate provider entries in plugin provider dropdown.
- residual risks: any workflow depending on selecting custom provider by name will no longer be available in UI.
- follow-up: optional frontend tooltip text clarifying that community gists are merged into Github.
