# 2026-04-27-community-gist-add-autosave

## Metadata
- Plan name: Community Gist Add Auto-Persist
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Ensure newly added community gist providers are persisted immediately so they remain available after restart/next launch.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Auto-save panel settings immediately when adding a provider in Provider Sources form.
- pros: solves persistence reliability for add flow; minimal patch.
- cons: still requires manual save for name/url edits to existing providers.

### Plan 2
- approach: keep manual save-only workflow.
- pros: no behavior change.
- cons: easy to lose newly added providers if user forgets to save.

### Plan 3
- approach: auto-save every field change (live updates).
- pros: strongest persistence.
- cons: noisy API traffic while typing.

## Selected Plan
Plan 1

## Implementation Steps
1. Added internal persist helper in Provider Sources form.
2. Updated Add Provider flow to save directly to panel settings before closing modal.
3. Kept existing Save button for manual edits/removals.
4. Ran frontend build validation.

## Validation
- backend checks: n/a
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: adding a community provider now persists immediately and survives relaunch.
- residual risks: editing/removing existing providers still depends on Save button.
- follow-up: optional auto-save for remove/edit flows if desired.
