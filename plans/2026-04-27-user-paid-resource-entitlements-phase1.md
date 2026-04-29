# 2026-04-27-user-paid-resource-entitlements-phase1

## Metadata
- Plan name: User Paid Resource Entitlements (Phase 1)
- Date: 2026-04-27
- Status: completed
- Requested by: user

## Goal
Implement a practical first phase for tracking user paid resource ownership and enforcing install guardrails for paid resources.

## Constraints
- Minecraft-only behavior
- No Hytale path logic

## Options
### Plan 1
- approach: Add backend entitlement storage/service, expose claim/list APIs, enrich plugin search results with ownership state, add paid install guard, and add browse UI ownership badges/actions.
- pros: complete end-to-end ownership tracking foundation in current architecture.
- cons: manual claim trust model can be abused without external verification provider APIs.

### Plan 2
- approach: Backend-only entitlement guard with no UI.
- pros: lower UI scope.
- cons: poor usability, users can’t understand/resolve blocked installs.

### Plan 3
- approach: UI-only badges with no install guard.
- pros: quick visual update.
- cons: no real enforcement.

## Selected Plan
Plan 1

## Implementation Steps
1. Add entitlement persistence service in backend (`data/resource_entitlements.json`).
2. Add plugin entitlement endpoints (`list`, `claim`) and enrich search results with ownership fields.
3. Add install guard in `POST /plugins/install-remote` for paid resources requiring ownership entitlement.
4. Add UI support for claim flow and ownership badges in Plugins browse cards.
5. Validate backend syntax and frontend build.

## Validation
- backend checks:
  - `node --check backend/src/services/entitlementService.js`
  - `node --check backend/src/routes/pluginRoutes.js`
  - `node --check backend/src/services/pluginService.js`
- frontend checks:
  - `npm --prefix frontend run build`
- runtime checks:
  - manual smoke test not executed in this batch

## Outcome
- completed changes:
  - User-scoped entitlements implemented with ownership states (`unknown`, `claimed`, `manual`, `verified`).
  - Plugins search now includes `ownershipStatus`, `isOwned`, and entitlement metadata.
  - Paid install attempts are blocked unless entitlement status allows install.
  - Paid resource cards now show owned/not-owned badges and provide `Claim Owned` flow.
- residual risks:
  - Phase 1 uses manual claim flow and does not cryptographically verify marketplace ownership.
- follow-up:
  - add provider-native ownership sync where official APIs exist (e.g., BuiltByBit).
