# FLOW Loyalty Slot — Current Status

Status date: 2026-09-21

This file is a working snapshot. Update it after meaningful milestones.

## Current development state

Active migration branch:

`feature/xp-loyalty-staking`

Pull request:

GitHub PR #1 — draft / test migration.

Production `main` has intentionally not been used for the XP development work.

Exact frozen pre-XP reference:

`4c445200c2da7f5f9c4c7ec015314c141cd41bab`

Safety branch:

`backup/pre-xp-system-2026-09-21`

Last functional UI/code commit before these memory-document commits:

`130e719c66da42163d482b63821e6267410026da`

## Preview environment

Frontend preview:

`https://deploy-preview-1--flowloyaltyslot.netlify.app`

Backend preview:

`https://flow-loyalty-backend-pr-1.onrender.com`

Production backend remains:

`https://flow-loyalty-backend.onrender.com`

## Completed migration work

### Safety / rollback

Completed:

- pre-XP commit frozen;
- backup branch created;
- Supabase pre-XP operational-table snapshot created;
- rollback documentation created;
- physical legacy slot copied to `frontend/public/slot-legacy/`;
- XP slot remains at `frontend/public/slot/`;
- protected env files and current Move staking contract intentionally left unchanged.

### NFT authorization

Completed:

- explicit rarity table introduced;
- rarity is authoritative for XP Free Spin rules;
- legacy `spins_per_day` is no longer authoritative;
- helper `upsert_loyalty_nft(object_id, rarity)` created;
- current test whitelist entries received explicit rarity values.

Current rarity rules:

- low -> 1 / 48h
- medium -> 1 / 24h
- high -> 3 / 24h
- legendary -> 5 / 24h

### Loyalty / XP backend

Completed:

- `loyalty.mjs`;
- backend-generated result roll;
- 5 guaranteed Loyalty XP;
- Bonus XP mapping;
- Total XP calculation;
- tier progression based on Total XP;
- temporary Staking Reward Boost state;
- request idempotency;
- NFT usage tracking;
- explicit wallet signature for spin authorization.

### Supabase

Completed:

- XP tables;
- XP RPCs;
- RLS for new tables;
- service-role-only execution/access pattern;
- fix for ambiguous `wallet` reference in `loyalty_profile_snapshot`.

Important lesson recorded:

A persistent SQL function fix must not be included in the same transaction that is later rolled back for test cleanup.

### Slot runtime

Completed or implemented for preview:

- backend roll injected into GDevelop result;
- local paid-spin path disabled;
- legacy Auto Spin controls removed from XP scene;
- legacy `SPIN` control removed from XP scene;
- legacy `WIN : $FLOW ...` visual payout overlay suppressed in XP mode;
- `SLOT_READY` handshake introduced;
- NFT Free Spin disabled until slot scene is ready.

Objects intentionally removed in XP mode:

- `SPIN`
- `AUTOSPIN`
- `Autoplay`
- `AutoSpin`

### React XP panel

Implemented:

- Total XP
- Loyalty XP
- Bonus XP
- Tier
- Staking Reward Boost
- NFT Free Spin
- XP Logs
- last-spin XP feedback

Recent UI fixes:

- removed overlap between Free Spin and Logs;
- reorganized XP action stack;
- centered Connect Wallet;
- resized/scoped Unauthorized Wallet box;
- kept XP CSS scoped away from staking/legacy behavior where practical.

## Staking boost implementation

Implemented in backend:

`backend/stakingboost.mjs`

Approach:

- existing Move staking contract unchanged;
- backend verifies real Sui staking reward transaction/event;
- only known staking pools/packages accepted;
- active XP boost applied as a separate supplementary FLOW payout;
- `staking_boost_claims` used for duplicate protection.

This path still needs thorough runtime testing before production.

## Known items still to validate/fix

### 1. UI visual validation

After the most recent CSS changes, visually verify:

- Connect Wallet centering;
- Unauthorized Wallet sizing;
- XP card spacing;
- Free Spin / XP Logs stack;
- desktop and mobile/narrow viewport behavior.

### 2. Slot behavior

Validate end-to-end:

- opening preview starts at Play screen;
- NFT Free Spin cannot be consumed before `SLOT_READY`;
- after Play, Free Spin becomes available;
- no SPIN button remains;
- no Auto Spin control remains;
- one NFT Free Spin produces exactly one reel animation;
- backend result matches displayed reel result;
- no legacy FLOW payout overlay appears;
- XP feedback appears after completion.

### 3. Multi-device refresh UX

Backend protection prevents duplicate consumption, but frontend focus/visibility refresh should also call the new loyalty status refresh so a second device updates its visible Free Spin count promptly.

Current focus/visibility handlers should be reviewed to ensure `fetchFreeSpins()` is included.

### 4. Staking boost runtime

Still validate:

- transaction digest returned correctly from wallet execution;
- claim event parsing against current Sui client response shape;
- supplementary bonus payout;
- duplicate claim behavior;
- insufficient payout-wallet balance behavior;
- failed claim retry behavior.

Known implementation concern to review:

A `failed` row in `staking_boost_claims` may need a safe retry transition instead of attempting a duplicate insert.

### 5. Legacy cleanup

Do not perform broad legacy cleanup yet.

Old handlers/routes may remain unreachable but present for rollback safety.

Cleanup comes only after stable XP production validation.

### 6. Security migration

Separate future task:

- versioned environment files;
- credential rotation;
- legacy `staking_free_spin` RLS state;
- versioned `node_modules`;
- other advisor/security warnings.

Do not mix this into functional XP validation unless explicitly approved.

## Current test principle

Do not merge to production because a build succeeds.

The migration is still in preview validation.

## Next recommended sequence

1. visually validate the latest XP panel;
2. run an NFT Free Spin from ready slot state;
3. verify allowance decrement + persisted XP;
4. verify no legacy controls/overlays;
5. improve second-device status refresh;
6. test staking boost path;
7. fix any runtime findings;
8. perform rollback rehearsal/check;
9. only then consider explicit production approval.

## Documentation set

Durable project context now lives in:

- `PROJECT_MEMORY.md`
- `WORKFLOW.md`
- `SAFETY_AND_ROLLBACK.md`
- `ARCHITECTURE.md`
- `CURRENT_STATUS.md`
- `ROLLBACK_XP_SYSTEM.md`
- `backend/NFT_LOYALTY_AUTHORIZATION.md`

These files should be used as the project memory/workflow source instead of relying only on conversation context.
