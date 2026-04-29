# 2026-04-27-community-gist-remove-autosave

## Metadata
- Plan name: Community Gist Remove Auto-Persist
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
When a community gist provider is removed, persist immediately so removed entries disappear from merged Github provider results without restarting Node.js.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Auto-save on remove action in Provider Sources form using existing settings persistence.
- pros: immediate behavior, minimal patch.
- cons: one extra API call per remove action.

### Plan 2
- approach: Keep manual Save workflow.
- pros: fewer API calls.
- cons: removed entries can appear until user saves.

### Plan 3
- approach: Add backend cache invalidation endpoint and call it on remove.
- pros: explicit cache control.
- cons: unnecessary complexity; not needed with source-keyed cache.

## Selected Plan
Plan 1

## Implementation Steps
1. Made remove provider handler async.
2. Persisted updated provider sources immediately on remove.
3. Updated local state/message after successful save.
4. Validated frontend build.

## Validation
- backend checks: n/a
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: removing a community provider now persists immediately and no longer requires manual Save click.
- residual risks: none significant for remove flow.
- follow-up: optional auto-save for provider name edits if desired.
