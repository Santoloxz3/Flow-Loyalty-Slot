# FLOW Loyalty Slot — Architecture

This document describes the current system structure and the separation between legacy and XP migration components.

## Repository

GitHub repository:

`Santoloxz3/Flow-Loyalty-Slot`

Primary branches:

- production/default: `main`
- XP development: `feature/xp-loyalty-staking`
- pre-XP safety: `backup/pre-xp-system-2026-09-21`

## Frontend

Main React application:

`frontend/src/App.jsx`

Main styling:

`frontend/src/App.css`

Build/deploy configuration:

`netlify.toml`

### Slot runtime separation

New NFT/XP slot:

`frontend/public/slot/`

Frozen legacy slot:

`frontend/public/slot-legacy/`

The React app currently embeds:

`/slot/index.html`

The legacy copy is retained for recovery/reference and is not the active XP iframe.

### React responsibilities

React handles:

- wallet connection;
- NFT Free Spin button;
- loyalty profile display;
- Total XP / Loyalty XP / Bonus XP;
- tier;
- active Staking Reward Boost;
- XP logs;
- communication with the GDevelop iframe;
- staking UI;
- staking boost claim request after on-chain claim/unstake.

### GDevelop iframe responsibilities

The XP GDevelop runtime handles:

- reel animation;
- symbol presentation;
- final visual outcome corresponding to backend roll;
- completion signal back to React.

It does not decide economic rewards.

The XP runtime:

- listens for `FREE_SPIN_AVAILABLE_NFT`;
- receives a backend-generated roll;
- signals readiness through `SLOT_READY`;
- must not allow legacy paid spin or Auto Spin;
- must not display legacy FLOW payout overlays.

## Backend

Backend entry:

`backend/index.mjs`

Current production backend:

`https://flow-loyalty-backend.onrender.com`

Current XP PR preview backend:

`https://flow-loyalty-backend-pr-1.onrender.com`

### Legacy backend modules

Existing legacy functionality includes modules such as:

- `balance.mjs`
- `withdraw.mjs`
- `freespin.mjs`
- `highbalancespin.mjs`
- `stakingfreespin.mjs`

These remain present during migration for rollback safety.

### XP loyalty backend

`backend/loyalty.mjs`

Responsibilities:

- wallet signature verification;
- Sui NFT ownership lookup;
- whitelist check;
- rarity check;
- availability/cooldown;
- cryptographic/random result generation;
- idempotent spin start;
- XP assignment;
- tier calculation;
- boost activation.

Important endpoint patterns:

- `GET /loyalty/status?wallet=...`
- `POST /loyalty/spin`

### Staking boost backend

`backend/stakingboost.mjs`

Responsibilities:

- verify legitimate Sui staking claim/unstake transaction;
- extract base reward;
- verify supported pool/package identity;
- read active loyalty boost;
- calculate supplementary bonus;
- prevent duplicate bonus processing;
- send bonus FLOW from the configured backend payout wallet.

The existing Move contract remains unchanged.

## Sui

The project uses Sui for:

- wallet identity;
- NFT ownership;
- staking;
- FLOW token interactions.

### Current protected staking pools

Known current staking pool object IDs:

Flexible:

`0xb914f28e385b0d193c13e9cb9d6621466a209fd98376098aff97bc799b0bd234`

Loyal:

`0x0aac4a32e17c57b45b83f1aa4c4ea8014e3601d63258c4e40ec7257e7c8a20f4`

Whale:

`0xd2a17cf5c2554e8d16d19c6a0f3720fbc13663aefedcb528422c1b9dc675d40d`

The backend derives/checks staking package identity from these pool objects.

## Supabase

Project:

`Slot Game`

### Legacy operational tables

- `balances`
- `transactions`
- `used_nonces`
- `nft_spin_whitelist`
- `nft_free_spin`
- `high_balance_spin`
- `staking_free_spin`

### XP tables

`loyalty_profiles`

Stores per-wallet:

- Loyalty XP
- Bonus XP
- generated Total XP
- current tier
- highest tier rank
- active boost
- boost timestamps

`loyalty_nft_usage`

Tracks NFT spin window/usage per wallet + NFT Object ID.

`nft_loyalty_rarity`

Maps NFT Object ID to:

- low
- medium
- high
- legendary

`loyalty_spins`

Audit/idempotency record for each XP spin.

`staking_boost_claims`

Prevents duplicate staking bonus processing and records payout state.

### RPC/helpers

`loyalty_profile_snapshot(text)`

Returns/initializes current loyalty profile and clears expired temporary boost state.

`loyalty_start_spin(...)`

Atomically handles spin idempotency, allowance consumption, XP, tier, and boost progression.

`upsert_loyalty_nft(text,text)`

Preferred helper to register/update an authorized NFT using Object ID + rarity.

## NFT authorization model

An NFT is XP-spin eligible when:

1. wallet owns the NFT on Sui;
2. Object ID is in `nft_spin_whitelist`;
3. same Object ID has an explicit rarity in `nft_loyalty_rarity`.

The new backend derives spin allowance from rarity, not from the old `spins_per_day` value.

## Data flow: NFT Free Spin

1. React fetches `/loyalty/status`.
2. Backend verifies owned eligible NFTs.
3. User presses NFT Free Spin only when slot reports ready.
4. React creates request ID and signs authorization message.
5. React calls `POST /loyalty/spin`.
6. Backend verifies signature/ownership/allowance.
7. Backend selects result roll.
8. Backend atomically consumes allowance and grants XP.
9. React sends backend roll to GDevelop iframe.
10. GDevelop animates reels to the corresponding result.
11. GDevelop signals completion.
12. React displays XP/tier/boost feedback and refreshes status.

## Data flow: Staking Reward Boost

1. User performs normal on-chain staking claim or unstake.
2. Existing Move contract calculates/pays normal reward.
3. React sends the resulting transaction digest to backend.
4. Backend verifies transaction/event/pool/package.
5. Backend reads current active loyalty boost.
6. Backend calculates bonus percentage on the verified base reward.
7. Backend records claim idempotently.
8. Backend sends separate bonus FLOW if applicable.

## Deployment topology

### Production

Frontend:

Netlify production from `main`.

Backend:

Render production service.

### XP testing

Frontend:

Netlify Deploy Preview for PR #1.

Backend:

Render PR Preview for PR #1.

Database:

same Supabase project, using additive XP objects.

Because preview and production can share Supabase, database changes must be designed conservatively.

## Environment/secrets

Environment files currently exist in the repository/runtime and are considered sensitive legacy configuration.

Do not expose or reproduce their secret values in documentation.

Protected paths are listed in `SAFETY_AND_ROLLBACK.md`.

## Architecture principle

Economic state is backend/database authoritative.

The iframe is a visual game engine, not a trusted financial engine.
