# FLOW Loyalty XP — rollback / recovery

## Frozen pre-change state

- Repository: Santoloxz3/Flow-Loyalty-Slot
- Exact pre-XP commit: `4c445200c2da7f5f9c4c7ec015314c141cd41bab`
- Safety branch: `backup/pre-xp-system-2026-09-21`
- Development branch: `feature/xp-loyalty-staking`
- Supabase project: `Slot Game`
- Supabase snapshot schema: `backup_pre_xp_20260921`

The existing files below were deliberately NOT edited by this implementation:

- `backend/.env`
- `frontend/.env.production`
- `contracts/flow_staking/.env.staking.generated`
- `contracts/flow_staking/sources/flow_staking.move`

The currently deployed Sui staking package is not modified.

## Fast rollback (recommended)

The XP implementation is additive. Existing legacy tables were not dropped, renamed or structurally changed.

To return the application code to the exact old behavior, deploy the commit:

`4c445200c2da7f5f9c4c7ec015314c141cd41bab`

or deploy:

`backup/pre-xp-system-2026-09-21`

No database restore is normally required because the old code uses the original legacy tables and ignores the new XP tables.

## Database snapshot

Before XP work, the following legacy tables were copied into `backup_pre_xp_20260921`:

- balances
- transactions
- used_nonces
- nft_spin_whitelist
- nft_free_spin
- high_balance_spin
- staking_free_spin

Do NOT blindly restore these tables after the project has been live, because doing so would erase legitimate activity that happened after the snapshot.

Use the snapshot only for forensic comparison or a deliberate point-in-time restoration.

## Optional removal of XP-only database objects

Only after the old code is active again, the following XP-only objects can be removed if a full cleanup is explicitly desired:

- public.loyalty_profiles
- public.loyalty_nft_usage
- public.nft_loyalty_rarity
- public.loyalty_spins
- public.staking_boost_claims
- public.loyalty_profile_snapshot(text)
- public.loyalty_start_spin(...)

Leaving these objects in the database is harmless to the old application and is safer than dropping them during an emergency rollback.

## Netlify

The repository contains `netlify.toml`. If Netlify is connected to GitHub, redeploying the frozen commit/safety branch restores the frontend assets, including the previous GDevelop slot code.

## Rule

Never delete the safety branch or the Supabase backup schema until the XP version has been stable in production and a newer verified backup exists.
