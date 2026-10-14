# FLOW Loyalty Slot — Project Memory

Updated: 2026-10-14. User authorized promotion of Loyalty V2 to the default operating system on Sui testnet. Mainnet is outside this change.

## Product and XP
NFT ownership -> backend-authorized free spin -> Lifetime XP -> tier -> staking reward boost. No paid slot spins, slot FLOW winnings, Auto Spin or slot withdrawal in the default runtime.
Lifetime XP = Loyalty XP + Bonus XP. Each authorized spin grants 5 Loyalty XP. Bonus mapping remains no_win 0, glass 5, moon 15, bag 35, flow 55, jackpot 195. Backend RNG and signed NFT ownership checks remain authoritative.

## Tiers and maintenance
| Tier | Lifetime XP | Boost |
|---|---:|---:|
| Starter | 0 | 0% |
| Flower | 500 | 5% |
| Holder | 1,500 | 10% |
| Whale | 4,000 | 15% |
| Legend | 10,000 | 20% |
| FLOW GOD | 25,000 | 25% |

User explicitly chose the existing boost scale on 2026-10-14. Boosts never stack and apply to verified staking rewards. NFT capital caps and new base APR rates were not requested in this change.

Tiers through Legend are permanent. Their existing one-time temporary boosts retain durations 7/14/14/30 days. FLOW GOD starts a 30-day (720-hour) cycle on first unlock. Maintenance XP starts at zero: historical XP and the spin crossing 25,000 do not count. Later spins add their full XP to both Lifetime and Maintenance XP atomically.

At the deadline, >=1,000 Maintenance XP renews from that deadline for 30 days and resets the counter, discarding surplus. Reaching the threshold early secures renewal without moving the deadline. A missed deadline makes FLOW GOD inactive: highest tier remains FLOW GOD, effective tier becomes Legend with +20% fallback until reactivation. Partial Maintenance XP is retained while inactive. Reaching 1,000 while inactive starts a fresh 30-day FLOW GOD cycle and resets the counter. Lifetime XP is never reset.

A long absence cannot renew multiple cycles using the same XP. Expiry is reconciled on status, spin and boost claim; a scheduler is unnecessary for benefit enforcement. Existing wallets already at 25,000 XP receive a fresh cycle when first accessed by V2, without historical Maintenance XP.

## NFT and authority
Rarities: low 1/48h, medium 1/24h, high 3/24h, legendary 5/24h. Eligibility requires on-chain ownership, nft_spin_whitelist and explicit nft_loyalty_rarity. Legacy spins_per_day is not authoritative.
Wallet-wide database locks serialize V2 spins, replay checks, profile snapshots and maintenance transitions. Backend service-role RPC only. Frontend and GDevelop never determine economic rewards. SLOT_READY gates spin consumption, backend roll drives reels, completion signals React. Focus/visibility refresh updates loyalty state.

## Recovery and contracts
Frozen legacy commit: 4c445200c2da7f5f9c4c7ec015314c141cd41bab.
Safety branch: backup/pre-xp-system-2026-09-21.
Legacy slot: frontend/public/slot-legacy/ (frozen). Legacy backend modules and original XP SQL/RPC remain for deliberate rollback. FLOW_RUNTIME_MODE=legacy explicitly enables legacy backend routes; default is loyalty-v2.
Protected .env files and deployed Move staking contract remain unchanged. Off-chain staking supplementation remains separate from on-chain base rewards; failed payouts require review and claim replay remains blocked.

Read WORKFLOW, SAFETY_AND_ROLLBACK, ARCHITECTURE and CURRENT_STATUS before changes. Preserve data, backups and rollback branches. Never restore old snapshots over legitimate later activity.
