# FLOW Loyalty Slot — Workflow

Updated: 2026-10-14.

Read PROJECT_MEMORY, SAFETY_AND_ROLLBACK, ARCHITECTURE, CURRENT_STATUS and ROLLBACK_XP_SYSTEM before substantial changes.

The user authorized Loyalty V2 promotion to the operating testnet system. Earlier preview-only restrictions are superseded for this testnet release. This is not authorization for mainnet or Move publication.

1. Start from the XP implementation branch feature/xp-loyalty-staking. Prepare changes on codex/flow-god-maintenance.
2. Preserve backup/pre-xp-system-2026-09-21, frozen legacy assets, original XP RPCs and protected env/Move files.
3. Apply additive FLOW_GOD_MAINTENANCE.sql through Supabase migrations after transactionally testing its functions. It creates a non-public pre-maintenance snapshot.
4. Run backend/tests/flow-god-maintenance.sql with its rollback. Verify saved RPCs, service-role grants and absence of persisted test data.
5. Install lockfile dependencies and build frontend; check backend syntax/startup and HTTP behavior. Test status, signed spin authorization, replay/allowance, UI and staking claims on testnet where wallet access exists.
6. Publish reviewed changes, then promote to main for default hosting deployment. Verify Netlify frontend and Render /health identify the new runtime. A blueprint file alone does not prove the hosting settings were applied.
7. Record exact checks, deployed commit and blockers in CURRENT_STATUS. Never report an unverified wallet payout or deploy as successful.

Legacy modules remain reusable with deliberate FLOW_RUNTIME_MODE=legacy backend activation and deployment of frozen frontend code. Do not expose the legacy economic routes by default. Recovery restores code first; leave additive XP/maintenance data intact.

Default frontend backend URL comes from VITE_BACKEND_URL, with stable Render fallback. Deploy preview uses its isolated URL. Keep frontend/backend on the matching release. Never change secrets as part of routine functional work.

UI: preserve SLOT_READY, backend roll and reel completion; no paid spin, Auto Spin or FLOW winnings overlays. Keep changes scoped and verify narrow layouts. Wallet focus/visibility refresh must include loyalty status.

Sui staking: retain the current deployed package and protected Move source. A future V2 contract publication requires its own explicit request and migration plan.
