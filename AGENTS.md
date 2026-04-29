# AGENTS.md - Minecraft Server Panel Agent Scope

This file defines the mandatory operating workflow for agents working in this repository.

## Project Identity
- Project: Minecraft Server Panel
- Runtime: Node.js backend + React frontend
- Domain: Minecraft only
- Non-goal: Hytale compatibility

## Global Source of Truth
Use global Codex files as the primary source every run:
- Skill: `%USERPROFILE%\.codex\skills\minecraft-server-panel\skill.md`
- Skill references: `%USERPROFILE%\.codex\skills\minecraft-server-panel\refrences\*.md`
- Project memories:
  - `%USERPROFILE%\.codex\memories\minecraft-server-panel\PROJECT_MEMORY.md`
  - `%USERPROFILE%\.codex\memories\minecraft-server-panel\PLANS_STATUS.md`
  - `%USERPROFILE%\.codex\memories\minecraft-server-panel\EDIT_LOG.md`

Always prefer these global files over local copies.

## Hard Rules
- Never introduce or keep Hytale-specific logic.
- Never use `universe/` paths for Minecraft server data.
- World data path standard: `<server_root>/world/...`
- Datapacks path standard: `<server_root>/world/datapacks/...`
- Plugins path standard: `<server_root>/plugins/...`

## Boot Sequence (Do This First)
1. Read global memory files:
   - `%USERPROFILE%\.codex\memories\minecraft-server-panel\PROJECT_MEMORY.md`
   - `%USERPROFILE%\.codex\memories\minecraft-server-panel\PLANS_STATUS.md`
   - `%USERPROFILE%\.codex\memories\minecraft-server-panel\EDIT_LOG.md`
2. Read user task.
3. Ask targeted clarifying questions when requirements are ambiguous or risky.
4. Research options (web + local code context) when needed.
5. Present options (`Plan 1`, `Plan 2`, `Plan 3`) with tradeoffs when multiple valid approaches exist.
6. After user chooses, create/update a plan file in `plans/`.
7. Implement, test, and document outcomes.
8. Append a memory entry after each completed edit batch to global memory files.

## Planning Protocol
- Store every plan in `plans/*.md`.
- Use `plans/PLAN_TEMPLATE.md` format.
- Mark plan state as `pending`, `in_progress`, or `completed`.
- When completed, update global `PLANS_STATUS.md`.

## Memory Protocol
After each completed edit batch, append:
- timestamp
- files changed
- behavior change summary
- validation performed
- follow-up risks

Update global files:
- `%USERPROFILE%\.codex\memories\minecraft-server-panel\EDIT_LOG.md` (append-only)
- `%USERPROFILE%\.codex\memories\minecraft-server-panel\PROJECT_MEMORY.md` (current truth)
- `%USERPROFILE%\.codex\memories\minecraft-server-panel\PLANS_STATUS.md` (plan tracking)

## Skill Routing
Primary skill for this repo:
- `%USERPROFILE%\.codex\skills\minecraft-server-panel\skill.md`

Reference docs:
- `%USERPROFILE%\.codex\skills\minecraft-server-panel\refrences\*.md`

## Runbook
Backend:
- `npm --prefix backend run dev`

Frontend:
- `npm --prefix frontend run dev`

Frontend production build:
- `npm --prefix frontend run build`

## Definition of Done
- Requirements implemented
- No Hytale path/logic regression introduced
- Build/syntax checks pass
- Plan updated
- Global memory updated
