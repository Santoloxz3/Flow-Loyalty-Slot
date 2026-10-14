# FLOW Loyalty Slot — Architecture

Updated: 2026-10-14.

## Operating system
Loyalty V2 is the intended default runtime on Sui testnet. Mainnet and the deployed legacy Move contract are unchanged. Main deploys through Netlify and the existing Render backend. Actual deployment verification is recorded separately in CURRENT_STATUS.

Frontend: frontend/src/App.jsx and App.css. Active iframe: /slot/index.html. Frozen recovery assets: frontend/public/slot-legacy/. Both slot and staking pages expose FLOW GOD active/inactive status, Maintenance XP, requirement and cycle deadline, with Lifetime XP and highest tier preserved.

Backend: backend/index.mjs. Default exposes /loyalty/status, /loyalty/spin, /staking-boost and /staking-boost/claim. /health identifies loyalty-v2, testnet and maintenance parameters. PORT is supplied by hosting. Legacy modules remain separate; their routes register only for FLOW_RUNTIME_MODE=legacy.

## Database
Apply backend/LOYALTY_XP_SCHEMA.sql for a fresh baseline, then backend/FLOW_GOD_MAINTENANCE.sql. Existing deployment needs only the latter. Original XP RPCs are retained; V2 callers use loyalty_profile_snapshot_v2 and loyalty_start_spin_v2, with shared loyalty_reconcile_flow_god. V2 functions are SECURITY INVOKER and executable only by service_role. RLS and client table restrictions remain.

loyalty_profiles retains total_xp as generated Lifetime XP. Added fields: flow_god_unlocked_at, flow_god_active, maintenance_xp, maintenance_started_at, maintenance_expires_at. highest_tier_rank preserves the achievement; current_tier and active_staking_boost represent effective benefits. Inactive FLOW GOD uses Legend/+20% with no fallback expiry. Active FLOW GOD uses +25% until the maintenance deadline. Maintenance counts only subsequent spins.

Every V2 profile reconciliation/spin takes the same wallet advisory transaction lock; spins retain NFT usage locks and unique wallet/request_id replay protection. XP, NFT consumption and maintenance transitions commit atomically. Expired status is reconciled before new XP, so late XP cannot qualify the expired active cycle. A qualifying expired cycle advances once and clears XP; an already expired successor becomes inactive.

## Flows
NFT spin: wallet signature -> on-chain NFT ownership -> authoritative rarity/availability -> server RNG -> atomic V2 RPC -> profile refresh -> visual reel outcome -> completion feedback.
Staking: existing Move claim/unstake -> verified sender, event, pool and package -> V2 effective boost snapshot -> idempotent separate payout. Existing failure/replay protection remains intact.

## Hosting and recovery
netlify.toml supplies the stable backend URL for default builds; PR #1 deploy preview uses its existing Render preview URL. render.yaml documents main, backend build/start, health and non-secret runtime configuration. Protected env files are not edited.
Legacy code recovery uses the frozen commit/safety branch and assets. Supabase backups: backup_pre_xp_20260921 and backup_pre_flow_god_20261014. The new snapshot stores pre-maintenance profiles and original RPC definitions without public access. Old tables/functions and backup schemas are not dropped.
