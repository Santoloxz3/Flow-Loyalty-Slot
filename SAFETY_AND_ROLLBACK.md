# FLOW Loyalty Slot — Safety and Rollback

This file defines non-negotiable recovery and preservation rules.

For detailed historical rollback notes, also read `ROLLBACK_XP_SYSTEM.md`.

## Protected legacy state

Exact pre-XP production code reference:

`4c445200c2da7f5f9c4c7ec015314c141cd41bab`

Safety branch:

`backup/pre-xp-system-2026-09-21`

Current XP development branch:

`feature/xp-loyalty-staking`

## Physical slot separation

The repository now keeps two slot copies:

- XP slot: `frontend/public/slot/`
- legacy slot: `frontend/public/slot-legacy/`

`slot-legacy` was copied from the working legacy version and must be treated as a frozen recovery/reference asset.

Do not modify it during XP development unless the task explicitly concerns the legacy copy.

## Protected files

Do not remove, rename, or modify these as part of routine XP migration work without explicit approval:

- `backend/.env`
- `frontend/.env.production`
- `contracts/flow_staking/.env.staking.generated`
- `contracts/flow_staking/sources/flow_staking.move`

These files are part of the known-working legacy/runtime configuration.

## Database recovery state

Supabase project:

`Slot Game`

Pre-XP snapshot schema:

`backup_pre_xp_20260921`

Copied legacy tables include:

- balances
- transactions
- used_nonces
- nft_spin_whitelist
- nft_free_spin
- high_balance_spin
- staking_free_spin

This is an application-level schema/table snapshot, not a full physical/PITR database backup.

## XP database objects

Current additive XP objects include:

- `public.loyalty_profiles`
- `public.loyalty_nft_usage`
- `public.nft_loyalty_rarity`
- `public.loyalty_spins`
- `public.staking_boost_claims`
- `public.loyalty_profile_snapshot(text)`
- `public.loyalty_start_spin(...)`
- `public.upsert_loyalty_nft(text,text)`

The old code does not require these objects.

## Recommended emergency rollback

If the XP version causes a production issue:

1. restore/deploy the exact pre-XP commit or safety branch;
2. verify frontend/backend legacy behavior;
3. leave XP-only database objects in place initially;
4. investigate before changing database data;
5. only perform DB restoration if there is a specific, verified data-recovery need.

Do not blindly restore the snapshot because it can erase valid activity that happened after 2026-09-21.

## Preview isolation

Current XP testing uses:

- GitHub PR #1;
- Netlify Deploy Preview;
- Render PR Preview.

Render preview URL:

`https://flow-loyalty-backend-pr-1.onrender.com`

Testing should happen there before production merge.

## Contract safety

The deployed staking Move package is not directly reversible like a Git commit.

Therefore:

- never modify/redeploy the existing package casually;
- prefer off-chain/additive integration while validating the XP model;
- any future on-chain V2 requires a separate migration and rollback plan.

## Destructive-change checklist

Before any destructive action:

- confirm exact target;
- confirm a verified rollback point exists;
- confirm production is not being changed unintentionally;
- confirm backup data is sufficient;
- confirm the action is necessary;
- record the action in project documentation.

Examples of destructive actions:

- dropping tables/functions;
- overwriting production data;
- deleting legacy slot files;
- rotating/changing secrets used by the working system;
- changing deployed contract/package behavior;
- merging an untested migration to main.

## Merge gate

Do not merge the XP migration to `main` until the user explicitly approves go-live after preview validation.

A successful build alone is not enough.

The following behavior must be validated first:

- NFT detection;
- spin allowance/cooldown;
- slot readiness;
- backend-authorized spin;
- XP persistence;
- idempotency;
- multi-device protection;
- visual slot behavior;
- staking boost claim behavior;
- rollback path.

## Rollback priority

When something breaks:

1. preserve user data;
2. preserve the working legacy path;
3. restore service;
4. diagnose;
5. clean up only after stability returns.

Do not sacrifice recoverability for code cleanliness during an incident.
