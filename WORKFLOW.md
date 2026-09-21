# FLOW Loyalty Slot — Workflow

This file defines how changes should be made to the project.

## Mandatory startup sequence

Before substantial work:

1. Read `PROJECT_MEMORY.md`.
2. Read `SAFETY_AND_ROLLBACK.md`.
3. Read `ARCHITECTURE.md`.
4. Read `CURRENT_STATUS.md`.
5. Read `ROLLBACK_XP_SYSTEM.md` for migration/rollback work.

Do not rely on chat memory alone for critical project decisions.

## Branch policy

Normal development for the XP migration happens on:

`feature/xp-loyalty-staking`

Do not use `main` for experiments or incomplete work.

The legacy safety branch is:

`backup/pre-xp-system-2026-09-21`

Production legacy reference:

`4c445200c2da7f5f9c4c7ec015314c141cd41bab`

## Change workflow

For each meaningful change:

1. Identify the exact subsystem being changed.
2. Check whether the change can affect production, the legacy slot, Supabase data, Sui contracts, or environment configuration.
3. Prefer additive/reversible changes.
4. Apply changes only to the feature branch unless production deployment is explicitly approved.
5. Build/deploy through the existing preview path.
6. Test the behavior in preview.
7. Record important durable decisions in these project files.
8. Only after validation consider merge/deploy.

## UI changes

For XP slot UI changes:

- modify the real project files, not mockups;
- preserve `frontend/public/slot-legacy/`;
- scope CSS so XP-only changes do not leak into the staking page or legacy copy;
- avoid negative margins when possible;
- test desktop and narrow layouts;
- do not reintroduce paid-spin or Auto Spin controls.

## GDevelop slot changes

The exported GDevelop slot is treated as runtime code.

Rules:

- do not change `slot-legacy`;
- new XP behavior belongs in `frontend/public/slot/`;
- backend-provided roll remains authoritative;
- local UI controls must not bypass backend authorization;
- preserve reel animation unless a task explicitly changes it;
- do not restore legacy FLOW win overlays;
- keep completion signaling to React working.

## Backend changes

Backend changes must:

- remain compatible with the preview environment;
- use service-role access for protected Supabase operations;
- validate wallet/NFT ownership server-side;
- preserve request idempotency;
- avoid trusting client-provided reward values;
- avoid silently changing production secrets or environment files.

## Supabase changes

Before destructive DB changes:

1. verify the existing backup/snapshot state;
2. prefer additive tables/functions;
3. test SQL in a transaction when possible;
4. do not combine a persistent schema/function fix with a later `ROLLBACK` in the same transaction if the fix is intended to persist;
5. verify the saved function/schema after applying it;
6. never blindly restore the pre-XP snapshot after legitimate post-snapshot activity.

Any test data cleanup must target only the intended test records.

## Sui / staking changes

The current Move staking contract is protected.

Do not modify or republish it as part of routine XP work.

If a future requirement needs contract-level boost logic:

- design it as a V2 migration;
- create a separate rollback/migration plan;
- obtain explicit approval before publishing.

## Preview workflow

Frontend preview:

- Netlify Deploy Preview for PR #1.

Backend preview:

- Render PR Preview:
  `https://flow-loyalty-backend-pr-1.onrender.com`

Production backend remains separate.

Do not point production frontend to preview backend or preview frontend to an unintended production migration path without deliberate review.

## Testing sequence for NFT spin changes

At minimum validate:

1. wallet connects;
2. eligible NFT is detected;
3. correct rarity/spin allowance is shown;
4. slot must be ready before spin can start;
5. one NFT Free Spin starts one animation;
6. backend result drives the visual outcome;
7. allowance decreases exactly once;
8. XP increases exactly once;
9. refresh preserves XP;
10. duplicate/idempotent request does not add XP again;
11. stale second-device state cannot double-consume a spin;
12. no legacy paid-spin path works;
13. no legacy Auto Spin path works;
14. no legacy FLOW payout overlay appears.

## Rollback discipline

Before any production-impacting migration:

- confirm rollback commit/branch exists;
- confirm legacy slot copy exists;
- confirm database rollback strategy;
- document what changed;
- avoid destructive cleanup until new version is stable.

Emergency rollback normally means restoring/deploying old code first, not immediately overwriting the database.

## Documentation discipline

Update `CURRENT_STATUS.md` after a meaningful milestone.

Update `PROJECT_MEMORY.md` only for durable decisions.

Update `ARCHITECTURE.md` when system structure changes.

Update `SAFETY_AND_ROLLBACK.md` when backup/rollback guarantees change.

## Decision rule

If uncertain whether a change could compromise the working legacy system, choose the reversible preview-only path and verify before proceeding.
