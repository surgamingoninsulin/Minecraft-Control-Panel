# 2026-04-27-remove-provider-save-button-full-autosave

## Metadata
- Plan name: Remove Provider Save Button (Full Auto-Save)
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Remove manual "Save Provider Sources" button and make provider source changes persist automatically.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Remove Save button; keep add/remove auto-save; add auto-save on provider name edit (on blur).
- pros: no manual save needed; fewer API calls than per-keystroke.
- cons: rename persists on focus loss instead of every keypress.

### Plan 2
- approach: Remove Save button; auto-save on every keypress.
- pros: immediate persistence.
- cons: excessive API calls.

### Plan 3
- approach: Keep Save button.
- pros: explicit control.
- cons: contradicts request.

## Selected Plan
Plan 1

## Implementation Steps
1. Removed Save Provider Sources button from header.
2. Kept add/remove auto-save behavior.
3. Added provider name auto-save on input blur.
4. Added duplicate/empty name validation before auto-save.
5. Validated frontend build.

## Validation
- backend checks: n/a
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: provider sources section is now fully auto-save for add/remove/rename flows; no manual save button remains.
- residual risks: rename is committed on blur; unsaved if user never leaves field.
- follow-up: optional Enter-key commit handling for rename input.
