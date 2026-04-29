# 2026-04-27-strict-numeric-server-fields-and-gb-ram-input

## Metadata
- Plan name: Strict Numeric Server Inputs + GB-only Panel RAM Inputs
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Enforce digits-only entry for selected Server Configuration numeric fields, and change Panel Configuration RAM fields to GB numeric values without `G` suffix in input.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: UI sanitization for selected numeric fields + backend memory normalization to numeric GB strings + start command appends `G` automatically.
- pros: consistent UX and safe command generation.
- cons: legacy values containing suffixes get normalized.

### Plan 2
- approach: UI-only changes.
- pros: small patch.
- cons: backend still stores mixed `2G`/`2` formats.

### Plan 3
- approach: backend-only normalization.
- pros: strict storage.
- cons: UI still confusing.

## Selected Plan
Plan 1

## Implementation Steps
1. Enforced digit-only input sanitizing for server numeric settings fields (max players, server port, view distance, simulation distance, spawn protection).
2. Converted panel RAM inputs to GB numeric-only fields and updated labels/help text.
3. Updated panel command preview to append `G` based on numeric GB values.
4. Updated backend settings normalization/buildStartCommand to store numeric GB values and generate `-Xms/-Xmx` with `G` suffix.
5. Ran backend syntax check and frontend build.

## Validation
- backend checks: `node --check backend/src/services/settingsService.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual UI smoke test not executed in this batch

## Outcome
- completed changes: requested numeric-only behavior is enforced in settings forms, and panel RAM now uses GB numbers without typing `G`.
- residual risks: empty numeric fields can still be temporarily blank while editing until saved/normalized.
- follow-up: optional per-field inline validation hints when blank.
