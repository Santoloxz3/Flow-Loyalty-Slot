# FLOW Loyalty Slot — Safety and Rollback

Updated: 2026-10-14. Testnet promotion is explicitly authorized by the user. Earlier preview-only merge gate is superseded for this release; mainnet and Move publication remain outside scope.

## Preserved recovery state
Legacy code: 4c445200c2da7f5f9c4c7ec015314c141cd41bab.
Safety branch: backup/pre-xp-system-2026-09-21.
Previous XP code: 9113588b418a9bad78e0ee125785c28c2183e1e8.
Frozen slot: frontend/public/slot-legacy/.
Original backend modules and LOYALTY_XP_SCHEMA.sql/RPCs remain present.

Protected files (no edits): backend/.env, frontend/.env.production, contracts/flow_staking/.env.staking.generated, contracts/flow_staking/sources/flow_staking.move. No package republish or secret rotation.

Supabase Slot Game retains backup_pre_xp_20260921. New backup_pre_flow_god_20261014 stores the first pre-maintenance loyalty_profiles snapshot and original RPC definitions; reapplication does not overwrite it. These are application snapshots, not full PITR backups. Public/anon/authenticated have no access to the new backup schema/tables.

## Release and rollback
V2 adds fields and separately named RPCs; no legacy tables or functions are removed. Before promotion, run rollback-based SQL integration tests, build, backend checks and deployment health checks. Record limitations, including wallet execution not available to the agent.

Emergency rollback: redeploy the frozen legacy commit/branch for frontend and backend. Alternatively the retained backend routes can be explicitly enabled with FLOW_RUNTIME_MODE=legacy. Restore the frozen frontend when restoring the full legacy experience. The default runtime keeps legacy routes inactive.

To restore the previous XP implementation, redeploy 9113588b418a9bad78e0ee125785c28c2183e1e8, which uses original RPCs. It ignores maintenance columns. Preserve new data for diagnosis; do not blindly copy old profile snapshots over later XP. Its temporary-boost behavior differs from V2 and should be assessed before reopening claims.

Never delete slot-legacy, backup branches, rollback documents or either backup schema. Restore application code before considering database restoration. Any data restore requires an exact target and a verified recovery need.

Failed staking payouts remain fail-closed for manual review. No retry or data cleanup may enable duplicate supplementary payments. The legacy deployed Move contract remains unchanged and cannot be reverted as a Git commit.
