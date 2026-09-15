module flow_staking::flow_staking {
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const PRECISION: u128 = 1_000_000_000_000;
    const U64_MAX: u128 = 18_446_744_073_709_551_615;

    const E_ZERO_AMOUNT: u64 = 0;
    const E_POOL_PAUSED: u64 = 1;
    const E_NOT_OWNER: u64 = 2;
    const E_LOCK_ACTIVE: u64 = 3;
    const E_INSUFFICIENT_REWARDS: u64 = 4;
    const E_WRONG_POOL: u64 = 5;
    const E_REWARD_OVERFLOW: u64 = 6;
    const E_NOT_ADMIN_FOR_POOL: u64 = 7;

    public struct StakingPool<phantom T> has key {
        id: UID,
        stake_balance: Balance<T>,
        reward_balance: Balance<T>,
        total_staked: u64,
        reward_per_second: u64,
        acc_reward_per_share: u128,
        last_reward_time: u64,
        lock_duration: u64,
        paused: bool,
    }

    public struct StakePosition has key, store {
        id: UID,
        pool_id: ID,
        owner: address,
        amount: u64,
        reward_debt: u128,
        stake_time: u64,
        unlock_time: u64,
    }

    public struct PoolAdminCap has key, store {
        id: UID,
        pool_id: ID,
    }

    public struct PoolCreated has copy, drop {
        pool_id: ID,
        reward_per_second: u64,
        lock_duration: u64,
    }

    public struct Staked has copy, drop {
        pool_id: ID,
        user: address,
        amount: u64,
        unlock_time: u64,
    }

    public struct Unstaked has copy, drop {
        pool_id: ID,
        user: address,
        principal: u64,
        reward: u64,
    }

    public struct RewardClaimed has copy, drop {
        pool_id: ID,
        user: address,
        amount: u64,
    }

    public struct RewardsFunded has copy, drop {
        pool_id: ID,
        amount: u64,
    }

    public struct PoolPaused has copy, drop {
        pool_id: ID,
        paused: bool,
    }

    public fun create_pool<T>(
        reward_per_second: u64,
        lock_duration: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): PoolAdminCap {
        let pool = StakingPool<T> {
            id: object::new(ctx),
            stake_balance: balance::zero<T>(),
            reward_balance: balance::zero<T>(),
            total_staked: 0,
            reward_per_second,
            acc_reward_per_share: 0,
            last_reward_time: clock::timestamp_ms(clock) / 1000,
            lock_duration,
            paused: false,
        };
        let pool_id = object::id(&pool);

        event::emit(PoolCreated {
            pool_id,
            reward_per_second,
            lock_duration,
        });

        transfer::share_object(pool);
        PoolAdminCap { id: object::new(ctx), pool_id }
    }

    public fun stake<T>(
        pool: &mut StakingPool<T>,
        stake_coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ): StakePosition {
        assert!(!pool.paused, E_POOL_PAUSED);

        let amount = coin::value(&stake_coin);
        assert!(amount > 0, E_ZERO_AMOUNT);

        update_pool(pool, clock);

        let now = clock::timestamp_ms(clock) / 1000;
        let pool_id = object::id(pool);
        let position = StakePosition {
            id: object::new(ctx),
            pool_id,
            owner: tx_context::sender(ctx),
            amount,
            reward_debt: ((amount as u128) * pool.acc_reward_per_share) / PRECISION,
            stake_time: now,
            unlock_time: now + pool.lock_duration,
        };

        balance::join(&mut pool.stake_balance, coin::into_balance(stake_coin));
        pool.total_staked = pool.total_staked + amount;

        event::emit(Staked {
            pool_id,
            user: tx_context::sender(ctx),
            amount,
            unlock_time: now + pool.lock_duration,
        });

        position
    }

    public fun claim_rewards<T>(
        pool: &mut StakingPool<T>,
        position: &mut StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<T> {
        assert_position(pool, position, ctx);
        update_pool(pool, clock);

        let pending = pending_after_update(pool, position);
        assert!(pending > 0, E_INSUFFICIENT_REWARDS);
        assert!(balance::value(&pool.reward_balance) >= pending, E_INSUFFICIENT_REWARDS);

        position.reward_debt = ((position.amount as u128) * pool.acc_reward_per_share) / PRECISION;
        let reward = coin::from_balance(balance::split(&mut pool.reward_balance, pending), ctx);

        event::emit(RewardClaimed {
            pool_id: object::id(pool),
            user: tx_context::sender(ctx),
            amount: pending,
        });

        reward
    }

    public fun unstake<T>(
        pool: &mut StakingPool<T>,
        position: StakePosition,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (Coin<T>, Coin<T>) {
        let StakePosition {
            id,
            pool_id,
            owner,
            amount,
            reward_debt,
            stake_time: _,
            unlock_time,
        } = position;

        assert!(owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(pool_id == object::id(pool), E_WRONG_POOL);
        assert!(clock::timestamp_ms(clock) / 1000 >= unlock_time, E_LOCK_ACTIVE);

        update_pool(pool, clock);

        let pending_u128 = (((amount as u128) * pool.acc_reward_per_share) / PRECISION) - reward_debt;
        assert!(pending_u128 <= U64_MAX, E_REWARD_OVERFLOW);
        let reward_amount = (pending_u128 as u64);
        assert!(balance::value(&pool.reward_balance) >= reward_amount, E_INSUFFICIENT_REWARDS);

        pool.total_staked = pool.total_staked - amount;

        let principal = coin::from_balance(balance::split(&mut pool.stake_balance, amount), ctx);
        let reward = if (reward_amount > 0) {
            coin::from_balance(balance::split(&mut pool.reward_balance, reward_amount), ctx)
        } else {
            coin::zero<T>(ctx)
        };

        event::emit(Unstaked {
            pool_id: object::id(pool),
            user: tx_context::sender(ctx),
            principal: amount,
            reward: reward_amount,
        });

        object::delete(id);
        (principal, reward)
    }

    public fun fund_rewards<T>(
        admin: &PoolAdminCap,
        pool: &mut StakingPool<T>,
        rewards: Coin<T>,
    ) {
        assert_admin(pool, admin);
        let amount = coin::value(&rewards);
        assert!(amount > 0, E_ZERO_AMOUNT);

        balance::join(&mut pool.reward_balance, coin::into_balance(rewards));

        event::emit(RewardsFunded {
            pool_id: object::id(pool),
            amount,
        });
    }

    public fun set_reward_rate<T>(
        admin: &PoolAdminCap,
        pool: &mut StakingPool<T>,
        reward_per_second: u64,
        clock: &Clock,
    ) {
        assert_admin(pool, admin);
        update_pool(pool, clock);
        pool.reward_per_second = reward_per_second;
    }

    public fun set_paused<T>(admin: &PoolAdminCap, pool: &mut StakingPool<T>, paused: bool) {
        assert_admin(pool, admin);
        pool.paused = paused;

        event::emit(PoolPaused {
            pool_id: object::id(pool),
            paused,
        });
    }

    public fun pending_rewards<T>(
        pool: &StakingPool<T>,
        position: &StakePosition,
        clock: &Clock,
    ): u64 {
        assert!(position.pool_id == object::id(pool), E_WRONG_POOL);

        let now = clock::timestamp_ms(clock) / 1000;
        let mut acc_reward = pool.acc_reward_per_share;

        if (now > pool.last_reward_time && pool.total_staked > 0) {
            let elapsed = now - pool.last_reward_time;
            let reward = (elapsed as u128) * (pool.reward_per_second as u128);
            acc_reward = acc_reward + ((reward * PRECISION) / (pool.total_staked as u128));
        };

        let accumulated = ((position.amount as u128) * acc_reward) / PRECISION;
        let pending = if (accumulated > position.reward_debt) {
            accumulated - position.reward_debt
        } else {
            0
        };

        assert!(pending <= U64_MAX, E_REWARD_OVERFLOW);
        (pending as u64)
    }

    public fun pool_info<T>(pool: &StakingPool<T>): (ID, u64, u64, u64, u64, bool) {
        (
            object::id(pool),
            pool.total_staked,
            balance::value(&pool.reward_balance),
            pool.reward_per_second,
            pool.lock_duration,
            pool.paused,
        )
    }

    public fun position_info(position: &StakePosition): (ID, address, u64, u64, u64) {
        (
            position.pool_id,
            position.owner,
            position.amount,
            position.stake_time,
            position.unlock_time,
        )
    }

    fun assert_admin<T>(pool: &StakingPool<T>, admin: &PoolAdminCap) {
        assert!(admin.pool_id == object::id(pool), E_NOT_ADMIN_FOR_POOL);
    }

    fun assert_position<T>(pool: &StakingPool<T>, position: &StakePosition, ctx: &TxContext) {
        assert!(position.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(position.pool_id == object::id(pool), E_WRONG_POOL);
    }

    fun pending_after_update<T>(pool: &StakingPool<T>, position: &StakePosition): u64 {
        let accumulated = ((position.amount as u128) * pool.acc_reward_per_share) / PRECISION;
        let pending = if (accumulated > position.reward_debt) {
            accumulated - position.reward_debt
        } else {
            0
        };

        assert!(pending <= U64_MAX, E_REWARD_OVERFLOW);
        (pending as u64)
    }

    fun update_pool<T>(pool: &mut StakingPool<T>, clock: &Clock) {
        let now = clock::timestamp_ms(clock) / 1000;

        if (now <= pool.last_reward_time) {
            return
        };

        if (pool.total_staked == 0) {
            pool.last_reward_time = now;
            return
        };

        let elapsed = now - pool.last_reward_time;
        let reward = (elapsed as u128) * (pool.reward_per_second as u128);
        pool.acc_reward_per_share = pool.acc_reward_per_share + ((reward * PRECISION) / (pool.total_staked as u128));
        pool.last_reward_time = now;
    }
}
