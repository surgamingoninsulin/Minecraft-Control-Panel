# 2026-04-27-gist-website-template-support

## Metadata
- Plan name: Gist websiteUrl Template Support
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Allow community gist provider `websiteUrl` to interpolate template variables, including `%{name}` in addition to `${name}` and `{{name}}`.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Extend shared template interpolation to support `%{key}` and apply interpolation to `websiteUrl` in GitHub gist provider mapping.
- pros: minimal patch, backward compatible, directly fixes user example.
- cons: none significant.

### Plan 2
- approach: Keep interpolation limited to download URL and require static website URLs.
- pros: no code change.
- cons: does not satisfy request.

### Plan 3
- approach: Add dedicated website interpolation helper separate from shared template function.
- pros: explicit per-field behavior.
- cons: unnecessary duplication.

## Selected Plan
Plan 1

## Implementation Steps
1. Added `%{key}` support in template interpolator.
2. Interpolated `websiteUrl` with item variables in gist provider mapper.
3. Ran backend syntax check.

## Validation
- backend checks: `node --check backend/src/services/modProviderService.js`
- frontend checks: n/a
- runtime checks: manual provider smoke test not executed in this batch

## Outcome
- completed changes: gist `websiteUrl` now supports `${...}`, `{{...}}`, and `%{...}` placeholders using item values.
- residual risks: unresolved placeholders remain literal when matching variable is missing.
- follow-up: quick UI smoke test in Mods/Plugins browse for custom provider entries.
