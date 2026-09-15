# $FLOW Staking Contract

Local Sui Move package for a guarded `$FLOW` staking vault, wired from the frontend through Vite environment IDs.

## Source Model

This is an adapted internal draft based on the safer parts of a generic Sui staking-pool pattern:

- https://github.com/Top-coin/sui-move-staking-protocol
- https://github.com/nayakly/Sui-Staking
- https://docs.openzeppelin.com/contracts-sui

Do not deploy this directly to mainnet. Use testnet first, then audit.

## Design

- Generic `StakingPool<T>` so it can be instantiated as `$FLOW` stake / `$FLOW` reward.
- User receives a `StakePosition` object when staking.
- Admin receives a `PoolAdminCap` scoped to exactly one pool.
- Rewards are distributed with `acc_reward_per_share` and `reward_per_second`.
- Unstake is blocked until `unlock_time`.

## Safety Changes From The Reference Pattern

- Admin actions verify `PoolAdminCap.pool_id == pool.id`.
- Claim and unstake verify `StakePosition.pool_id == pool.id`.
- Reward casts check `u128 <= u64::MAX`.
- Zero reward claims abort instead of emitting empty reward transfers.
- Slot balance remains separate from staked funds.

## Testnet Wiring Notes

Use the published `$FLOW` coin type already used by the frontend:

```text
0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW
```

Expected calls after publish:

1. Publish this package and save the package ID.
2. Create one or more pools with `create_pool<FLOW>(reward_per_second, lock_duration, clock)`.
3. Transfer the returned `PoolAdminCap` to the project/admin wallet in the same programmable transaction.
4. Fund each pool with `fund_rewards<FLOW>(admin_cap, pool, reward_coin)`.
5. Add the IDs to the frontend environment:

```text
VITE_FLOW_STAKING_PACKAGE_ID=<published package id>
VITE_FLOW_STAKING_POOL_ID=<default pool id>
VITE_FLOW_STAKING_POOL_FLEXIBLE_ID=<optional flexible pool id>
VITE_FLOW_STAKING_POOL_LOYAL_ID=<optional loyal pool id>
VITE_FLOW_STAKING_POOL_WHALE_ID=<optional whale pool id>
```

The helper script can publish the package, create the three default pools and transfer the upgrade/admin caps to the project wallet:

```bash
cd contracts/flow_staking
ADMIN_ADDRESS=0xe8ec5bf9587b55547f0f58bcb3c7341e90dff8d1a10abbfe2b4728e52a7813e8 \
  bash scripts/publish_and_create_pools.sh
```

By default the script creates pools with reward rate `0` so staking can be enabled without accidentally draining rewards. Set `FLEXIBLE_RPS`, `LOYAL_RPS` and `WHALE_RPS` when the reward budget is final, or update the rates later with the admin cap.

After publish, the admin wallet can set rates and fund rewards without exposing its private key:

```bash
cd contracts/flow_staking
FLEXIBLE_RPS=1000000 LOYAL_RPS=2000000 WHALE_RPS=3000000 \
  bash scripts/set_reward_rates_from_admin.sh

FLOW_COIN_ID=<admin FLOW coin object id> \
FLEXIBLE_REWARD_AMOUNT=10000000000000 \
LOYAL_REWARD_AMOUNT=20000000000000 \
WHALE_REWARD_AMOUNT=30000000000000 \
  bash scripts/fund_rewards_from_admin.sh
```

All FLOW amounts and rates use base units. `1 FLOW = 1_000_000_000` base units.

Frontend user calls:

- `stake<FLOW>(pool, stake_coin, clock)`
- `claim_rewards<FLOW>(pool, position, clock)`
- `unstake<FLOW>(pool, position, clock)`

## Before Connecting The Frontend

- Add/extend unit tests for create, stake, claim, locked unstake failure, valid unstake, pause, wrong admin cap and wrong position pool.
- Verify token decimals and reward rate math for the actual `$FLOW` economics.
- Decide final lock plans: Flexible, Loyal, Whale.
- Publish only on testnet first and store package/pool/admin object IDs outside the frontend source.
