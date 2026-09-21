# FLOW Loyalty Slot — Project Memory

This file contains durable project decisions that must survive long chats, context changes, handoffs, and future agents.

## How to use this file

Before making a substantial change to FLOW Loyalty Slot, read:

1. `PROJECT_MEMORY.md`
2. `WORKFLOW.md`
3. `SAFETY_AND_ROLLBACK.md`
4. `ARCHITECTURE.md`
5. `CURRENT_STATUS.md`

If chat context conflicts with these files, stop and verify the intended state before changing production-critical code.

## Product direction

FLOW Loyalty Slot is moving from a FLOW wagering/payout slot to an NFT loyalty system.

The target model is:

NFT ownership -> Free Spins -> XP -> Loyalty Tier -> temporary Staking Reward Boost.

The slot must NOT:

- require FLOW payment to spin;
- offer paid spins;
- credit FLOW winnings from slot outcomes;
- provide slot-winnings withdrawal.

The slot should be started only through an eligible NFT Free Spin authorized by the backend.

## XP rules

Every completed authorized NFT spin grants:

- 5 Loyalty XP guaranteed;
- optional Bonus XP based on the backend result.

Current XP mapping:

| Result | Loyalty XP | Bonus XP | Total XP |
|---|---:|---:|---:|
| No Win | 5 | 0 | 5 |
| Glass | 5 | 5 | 10 |
| Moon | 5 | 15 | 20 |
| Bag | 5 | 35 | 40 |
| FLOW | 5 | 55 | 60 |
| Jackpot / Jolly | 5 | 195 | 200 |

**Total XP = Loyalty XP + Bonus XP.**

Both Loyalty Tier progression and Staking Reward Boost progression use **Total XP**, including Bonus XP.

## Loyalty tiers

| Tier | Total XP threshold | Staking Reward Boost | Duration |
|---|---:|---:|---:|
| STARTER | 0 | 0% | — |
| FLOWER | 500 | +5% | 7 days |
| HOLDER | 1,500 | +10% | 14 days |
| WHALE | 4,000 | +15% | 14 days |
| LEGEND | 10,000 | +20% | 30 days |
| FLOW GOD | 25,000 | +25% | 30 days |

Rules:

- wording is **Staking Reward Boost**, not APY Bonus;
- boosts do not stack;
- a higher boost replaces a lower active boost;
- the Loyalty Tier remains after its temporary boost expires;
- each tier boost activates only once;
- if one spin crosses multiple thresholds, activate only the highest newly crossed tier.

## NFT rarity and Free Spin rules

The new system uses explicit NFT rarity.

| Rarity | Free Spins | Window |
|---|---:|---:|
| low | 1 | 48 hours |
| medium | 1 | 24 hours |
| high | 3 | 24 hours |
| legendary | 5 | 24 hours |

Eligibility requires:

1. NFT Object ID in `public.nft_spin_whitelist`;
2. explicit rarity in `public.nft_loyalty_rarity`.

The old `spins_per_day` field is legacy compatibility data and is not authoritative for the XP system.

Preferred NFT administration helper:

```sql
select public.upsert_loyalty_nft('0xOBJECT_ID', 'medium');
```

## Backend authority

The backend is authoritative for:

- NFT ownership verification;
- spin eligibility;
- spin consumption;
- RNG/result selection;
- XP;
- tier;
- staking boost state;
- idempotency.

The frontend/GDevelop frame must never be trusted to determine rewards.

## Multi-device rule

A Free Spin must not be usable twice from two devices.

Backend consumption is atomic and idempotent.

A stale second device may temporarily display an old count, but the backend must still reject duplicate/over-limit consumption.

Frontend should refresh loyalty status on relevant focus/visibility events where practical.

## Slot UX

The XP slot must:

- start only after the game is ready;
- use the backend-provided roll;
- preserve the visual reel animation;
- not expose legacy paid-spin controls;
- not expose legacy Auto Spin;
- not show legacy `WIN : $FLOW ...` reward overlays;
- show XP/reward information in the React loyalty panel instead.

The frame currently uses a `SLOT_READY` handshake before an NFT Free Spin can be consumed.

## Legacy preservation

The legacy experience is important and must remain recoverable.

There are two levels of protection:

- Git rollback point / backup branch;
- physical legacy slot copy.

Physical paths:

- new XP slot: `frontend/public/slot/`
- frozen legacy slot: `frontend/public/slot-legacy/`

Treat `slot-legacy` as read-only unless an explicit legacy maintenance task is requested.

## Staking

The existing deployed staking Move contract is intentionally unchanged.

Current XP boost implementation is off-chain supplementation after verification of legitimate on-chain staking reward events.

A fully trustless on-chain XP boost would require a deliberate V2 contract/package migration and separate approval.

## Production discipline

Do not merge or deploy the XP migration to production until:

- preview frontend passes;
- preview backend passes;
- NFT spin flow passes;
- XP persistence passes;
- multi-device/idempotency behavior passes;
- staking boost behavior is validated;
- rollback path is verified.

Production changes require explicit approval.

## Security cleanup is separate

Known cleanup items exist, including versioned environment files and legacy database security concerns.

Do not mix broad credential/security cleanup into the functional XP migration unless explicitly requested, because changing them can break the known-working legacy system.

## Core principle

When safety and convenience conflict, preserve the working legacy state and create a reversible test path first.
