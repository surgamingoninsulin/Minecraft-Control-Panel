# 2026-04-27-dashboard-console-jump-and-lifecycle-reset

## Metadata
- Plan name: Dashboard Start/Restart Console Jump + Lifecycle-Aware Console Reset
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
When Start/Restart is pressed from Dashboard, navigate to Console automatically. In Console, clear stale command input and reset old output around stop/start lifecycle markers using known log lines.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Route to `/console` after successful start/restart; in Console, watch incoming log lines for `Server stopped with code 0` and `Starting org.bukkit.craftbukkit.Main`, then clear command input and rotate logs for a fresh session.
- pros: matches requested behavior and known lifecycle signals.
- cons: may hide older logs once new start marker appears.

### Plan 2
- approach: route jump only + clear command text on submit/navigation; keep all logs.
- pros: minimal behavior change.
- cons: does not satisfy lifecycle-marker requirement.

### Plan 3
- approach: backend-side log segmentation and separate session IDs.
- pros: robust long-term architecture.
- cons: larger refactor not needed for this immediate fix.

## Selected Plan
Plan 1

## Implementation Steps
1. Updated Dashboard controls to navigate to Console after start/restart succeeds.
2. Added lifecycle-marker handling in Console page for stop/start lines.
3. Cleared stale command input and reset old output when a fresh start marker arrives after stop.
4. Ran frontend build validation.

## Validation
- backend checks: n/a
- frontend checks: `npm --prefix frontend run build`
- runtime checks: manual runtime smoke test not executed in this batch

## Outcome
- completed changes: start/restart now jumps to Console; Console clears command input on lifecycle transitions; old output rotates on stop->start marker sequence.
- residual risks: if server software changes exact marker text, lifecycle reset behavior may need regex update.
- follow-up: smoke test start/stop/restart flow in UI to confirm expected marker behavior.
