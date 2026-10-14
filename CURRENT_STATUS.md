# FLOW Loyalty Slot — Current Status

Updated: 2026-10-14.

## Release
FLOW GOD maintenance V2 implemented from XP head 9113588b418a9bad78e0ee125785c28c2183e1e8. User authorized default testnet promotion and explicitly retained the +5/+10/+15/+20/+25% scale.

## Completed and verified
- Supabase migration flow_god_maintenance_v2 applied to Slot Game (auytoiajrweoiaocyvgh).
- Separately named V2 RPCs, service-role-only SECURITY INVOKER execution, wallet-wide serialization and persistent Lifetime XP.
- Tests passed both before migration in a rolled-back transaction and after migration against saved RPCs: unlock at 25,000, no historical/unlock-spin maintenance, 720-hour cycle, wallet/request replay across NFTs, renewal/reset, missed-cycle Legend/+20% fallback, partial XP retention, reactivation, long-absence behavior, permanent Legend tier, existing FLOW GOD initialization and client RPC access denied.
- Zero persisted maintenance-test profiles; original application profile count unchanged.
- New private backup_pre_flow_god_20261014 snapshot; backup_pre_xp_20260921 verified present.
- Frontend build passed with npm ci lockfile dependencies; initial tracked node_modules were stale.
- Backend syntax and startup passed. Local /health identifies loyalty-v2/testnet/30 days/1,000 XP. Default POST /withdraw returns 404 and unsigned POST /loyalty/spin returns 401.
- Frontend slot/staking maintenance UI and stable backend configuration added. Local staking UI renders and loads live Sui testnet pool statistics without wallet connection.
- Render existing production service verified: main, backend root, automatic deploy on commit. Preview service follows feature/xp-loyalty-staking.
- Protected env files, Move source and slot-legacy match the previous XP head. Rollback branches/documents retained.

## Deployment verification
Release code is prepared for default main deployment. Remote deploy status must be recorded after push/promotion; a successful local build is not proof of remote deployment.

## Remaining practical limits
Real connected-wallet NFT spin and supplementary staking payout require wallet execution and have not been claimed as verified in this session. Existing claim replay and failed-payout safeguards are retained.
Dependency audit reports existing findings (frontend 21, backend 6). Broad dependency/security remediation remains a separate task. Supabase advisors report the previously known staking_free_spin RLS issue and delete_old_nonces mutable search_path; V2 service-role tables deliberately have RLS with no client policies. No new V2 RPC security finding was reported.

## Recovery
Frozen legacy: 4c445200c2da7f5f9c4c7ec015314c141cd41bab, backup/pre-xp-system-2026-09-21, frontend/public/slot-legacy/. Prior XP: 9113588b418a9bad78e0ee125785c28c2183e1e8. Restore code first and preserve database changes; do not overwrite later activity with snapshots. See SAFETY_AND_ROLLBACK and ROLLBACK_XP_SYSTEM.
