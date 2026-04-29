# 2026-04-27-about-button-footer-alignment

## Metadata
- Plan name: About Button Footer-Band Alignment
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Place the sidebar About button below the horizontal divider (footer top line) and align its vertical center with footer text height.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Reposition sidebar lower section into footer band using absolute positioning and keep About centered in that band.
- pros: Matches requested visual alignment with minimal code changes.
- cons: Relies on footer band height coupling.

### Plan 2
- approach: Move About button into Footer component.
- pros: strict structural alignment with footer content.
- cons: larger component refactor.

### Plan 3
- approach: Increase spacer/margins in sidebar flow.
- pros: minimal CSS edits.
- cons: fragile across viewport heights and content lengths.

## Selected Plan
Plan 1

## Implementation Steps
1. Set sidebar container to `position: relative`.
2. Let sidebar nav fill available height.
3. Reposition `.sidebar-lower-section` absolutely into footer band (`bottom: -90px`) with top border and centered alignment.
4. Validate frontend build.

## Validation
- backend checks: n/a
- frontend checks: `npm --prefix frontend run build`
- runtime checks: visual verification pending user check

## Outcome
- completed changes: About button now sits below the horizontal divider and is centered in the left footer band area.
- residual risks: footer height changes may require small `bottom` offset tuning.
- follow-up: optional fine-tune `bottom` by a few pixels after user visual confirmation.
