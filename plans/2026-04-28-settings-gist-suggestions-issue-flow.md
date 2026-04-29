## Metadata
- Plan name: Settings gist suggestion issue flow
- Date: 2026-04-28
- Status: completed
- Requested by: user

## Goal
Add a new Settings category for suggestions that creates GitHub issues using a token and parses only the JSON code block payload.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add a dedicated backend suggestion service + endpoint and a frontend settings tab form.
- pros: Fast, clear ownership, minimal risk to existing settings flows.
- cons: Depends on valid GitHub token/repo env vars.

### Plan 2
- approach: Reuse existing provider settings save routes for suggestion text transport.
- pros: fewer endpoints.
- cons: mixes concerns and complicates settings persistence.

### Plan 3
- approach: Client-only redirect to prefilled GitHub issue URL.
- pros: no backend token handling.
- cons: cannot enforce JSON parsing/validation and no server-side normalization.

## Selected Plan
Plan 1

## Implementation Steps
1. Add backend service to parse fenced JSON and create GitHub issues.
2. Add settings route endpoint for suggestion submission.
3. Add frontend settings tab + form to submit suggestion payload.
4. Add GitHub issue template and env example keys.

## Validation
- backend checks: `node --check backend/src/services/suggestionService.js`, `node --check backend/src/routes/settingsRoutes.js`
- frontend checks: `npm --prefix frontend run build`
- runtime checks: endpoint wiring and compile path verified; live GitHub API call requires real token.

## Outcome
- completed changes: Added settings suggestions category, issue creation endpoint, fenced JSON parser, issue template, and env keys.
- residual risks: live issue creation fails when token/repo scopes are incorrect.
- follow-up: add optional admin-only permission gate for suggestion submissions.
