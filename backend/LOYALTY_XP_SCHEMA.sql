-- FLOW Loyalty XP additive schema
-- Created for feature/xp-loyalty-staking.
-- This file is intentionally additive: it does not DROP, rename, or alter legacy slot tables.

create table if not exists public.loyalty_profiles (
  wallet text primary key,
  loyalty_xp bigint not null default 0 check (loyalty_xp >= 0),
  bonus_xp bigint not null default 0 check (bonus_xp >= 0),
  total_xp bigint generated always as (loyalty_xp + bonus_xp) stored,
  current_tier text not null default 'starter',
  highest_tier_rank integer not null default 0 check (highest_tier_rank >= 0),
  active_staking_boost integer not null default 0 check (active_staking_boost >= 0),
  boost_started_at timestamptz,
  boost_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_nft_usage (
  wallet text not null,
  object_id text not null,
  period_started_at timestamptz not null default now(),
  used_spins integer not null default 0 check (used_spins >= 0),
  updated_at timestamptz not null default now(),
  primary key (wallet, object_id)
);

create table if not exists public.nft_loyalty_rarity (
  object_id text primary key,
  rarity text not null check (rarity in ('low','medium','high','legendary')),
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_spins (
  spin_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  wallet text not null,
  object_id text not null,
  rarity text not null,
  roll integer not null check (roll between 1 and 100),
  result_code text not null check (result_code in ('no_win','glass','moon','bag','flow','jackpot')),
  loyalty_xp integer not null default 5 check (loyalty_xp >= 0),
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  total_xp integer generated always as (loyalty_xp + bonus_xp) stored,
  created_at timestamptz not null default now(),
  unique (wallet, request_id)
);

create index if not exists loyalty_spins_wallet_created_idx
  on public.loyalty_spins(wallet, created_at desc);

create table if not exists public.staking_boost_claims (
  claim_digest text primary key,
  wallet text not null,
  pool_id text,
  base_reward_nanos numeric(30,0) not null check (base_reward_nanos >= 0),
  boost_percent integer not null check (boost_percent >= 0),
  bonus_reward_nanos numeric(30,0) not null check (bonus_reward_nanos >= 0),
  bonus_tx_hash text,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loyalty_profiles enable row level security;
alter table public.loyalty_nft_usage enable row level security;
alter table public.nft_loyalty_rarity enable row level security;
alter table public.loyalty_spins enable row level security;
alter table public.staking_boost_claims enable row level security;

revoke all on public.loyalty_profiles from anon, authenticated;
revoke all on public.loyalty_nft_usage from anon, authenticated;
revoke all on public.nft_loyalty_rarity from anon, authenticated;
revoke all on public.loyalty_spins from anon, authenticated;
revoke all on public.staking_boost_claims from anon, authenticated;

create or replace function public.loyalty_profile_snapshot(p_wallet text)
returns table (
  wallet text,
  loyalty_xp bigint,
  bonus_xp bigint,
  total_xp bigint,
  current_tier text,
  highest_tier_rank integer,
  active_staking_boost integer,
  boost_started_at timestamptz,
  boost_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.loyalty_profiles(wallet)
  values (p_wallet)
  on conflict (wallet) do nothing;

  update public.loyalty_profiles
  set active_staking_boost = 0,
      boost_started_at = null,
      boost_expires_at = null,
      updated_at = now()
  where loyalty_profiles.wallet = p_wallet
    and active_staking_boost > 0
    and boost_expires_at is not null
    and boost_expires_at <= now();

  return query
  select p.wallet, p.loyalty_xp, p.bonus_xp, p.total_xp, p.current_tier,
         p.highest_tier_rank, p.active_staking_boost, p.boost_started_at, p.boost_expires_at
  from public.loyalty_profiles p
  where p.wallet = p_wallet;
end;
$$;

revoke all on function public.loyalty_profile_snapshot(text) from public, anon, authenticated;
grant execute on function public.loyalty_profile_snapshot(text) to service_role;

create or replace function public.loyalty_start_spin(
  p_wallet text,
  p_object_id text,
  p_rarity text,
  p_allowance integer,
  p_window_hours integer,
  p_request_id text,
  p_roll integer,
  p_result_code text,
  p_bonus_xp integer
)
returns table (
  spin_id uuid,
  result_code text,
  roll integer,
  spin_loyalty_xp integer,
  spin_bonus_xp integer,
  spin_total_xp integer,
  profile_loyalty_xp bigint,
  profile_bonus_xp bigint,
  profile_total_xp bigint,
  current_tier text,
  active_staking_boost integer,
  boost_expires_at timestamptz,
  tier_unlocked boolean,
  spins_left integer,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_usage public.loyalty_nft_usage%rowtype;
  v_existing public.loyalty_spins%rowtype;
  v_spin public.loyalty_spins%rowtype;
  v_profile public.loyalty_profiles%rowtype;
  v_old_rank integer := 0;
  v_new_rank integer := 0;
  v_new_tier text := 'starter';
  v_boost integer := 0;
  v_duration_days integer := 0;
  v_new_total bigint := 0;
  v_unlocked boolean := false;
begin
  if p_wallet is null or length(trim(p_wallet)) = 0 then raise exception 'WALLET_REQUIRED'; end if;
  if p_object_id is null or length(trim(p_object_id)) = 0 then raise exception 'OBJECT_REQUIRED'; end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if p_allowance <= 0 or p_window_hours <= 0 then raise exception 'INVALID_SPIN_RULE'; end if;
  if p_roll < 1 or p_roll > 100 then raise exception 'INVALID_ROLL'; end if;

  perform pg_advisory_xact_lock(hashtext(lower(p_wallet) || ':' || lower(p_object_id)));

  select * into v_existing
  from public.loyalty_spins s
  where s.wallet = p_wallet and s.request_id = p_request_id
  limit 1;

  if found then
    select * into v_profile from public.loyalty_profiles p where p.wallet = p_wallet;
    select * into v_usage from public.loyalty_nft_usage u
      where u.wallet = p_wallet and u.object_id = p_object_id;

    return query select
      v_existing.spin_id, v_existing.result_code, v_existing.roll,
      v_existing.loyalty_xp, v_existing.bonus_xp, v_existing.total_xp,
      v_profile.loyalty_xp, v_profile.bonus_xp, v_profile.total_xp,
      v_profile.current_tier,
      case when v_profile.boost_expires_at is not null and v_profile.boost_expires_at > v_now
           then v_profile.active_staking_boost else 0 end,
      v_profile.boost_expires_at, false,
      greatest(0, p_allowance - coalesce(v_usage.used_spins, 0)),
      case when v_usage.period_started_at is null then null
           else v_usage.period_started_at + make_interval(hours => p_window_hours) end;
    return;
  end if;

  select * into v_usage
  from public.loyalty_nft_usage u
  where u.wallet = p_wallet and u.object_id = p_object_id
  for update;

  if not found then
    insert into public.loyalty_nft_usage(wallet, object_id, period_started_at, used_spins, updated_at)
    values (p_wallet, p_object_id, v_now, 0, v_now)
    returning * into v_usage;
  elsif v_now >= v_usage.period_started_at + make_interval(hours => p_window_hours) then
    update public.loyalty_nft_usage
    set period_started_at = v_now, used_spins = 0, updated_at = v_now
    where loyalty_nft_usage.wallet = p_wallet and loyalty_nft_usage.object_id = p_object_id
    returning * into v_usage;
  end if;

  if v_usage.used_spins >= p_allowance then raise exception 'NO_SPINS_AVAILABLE'; end if;

  update public.loyalty_nft_usage
  set used_spins = used_spins + 1, updated_at = v_now
  where loyalty_nft_usage.wallet = p_wallet and loyalty_nft_usage.object_id = p_object_id
  returning * into v_usage;

  insert into public.loyalty_spins(
    request_id, wallet, object_id, rarity, roll, result_code, loyalty_xp, bonus_xp
  )
  values (p_request_id, p_wallet, p_object_id, p_rarity, p_roll, p_result_code, 5, p_bonus_xp)
  returning * into v_spin;

  insert into public.loyalty_profiles(wallet) values (p_wallet) on conflict (wallet) do nothing;
  select * into v_profile from public.loyalty_profiles p where p.wallet = p_wallet for update;

  if v_profile.active_staking_boost > 0
     and v_profile.boost_expires_at is not null
     and v_profile.boost_expires_at <= v_now then
    v_profile.active_staking_boost := 0;
    v_profile.boost_started_at := null;
    v_profile.boost_expires_at := null;
  end if;

  v_old_rank := v_profile.highest_tier_rank;
  v_new_total := v_profile.loyalty_xp + 5 + v_profile.bonus_xp + p_bonus_xp;

  if v_new_total >= 25000 then
    v_new_rank := 5; v_new_tier := 'flow_god'; v_boost := 25; v_duration_days := 30;
  elsif v_new_total >= 10000 then
    v_new_rank := 4; v_new_tier := 'legend'; v_boost := 20; v_duration_days := 30;
  elsif v_new_total >= 4000 then
    v_new_rank := 3; v_new_tier := 'whale'; v_boost := 15; v_duration_days := 14;
  elsif v_new_total >= 1500 then
    v_new_rank := 2; v_new_tier := 'holder'; v_boost := 10; v_duration_days := 14;
  elsif v_new_total >= 500 then
    v_new_rank := 1; v_new_tier := 'flower'; v_boost := 5; v_duration_days := 7;
  else
    v_new_rank := 0; v_new_tier := 'starter'; v_boost := 0; v_duration_days := 0;
  end if;

  v_unlocked := v_new_rank > v_old_rank;

  update public.loyalty_profiles
  set loyalty_xp = loyalty_xp + 5,
      bonus_xp = bonus_xp + p_bonus_xp,
      current_tier = v_new_tier,
      highest_tier_rank = greatest(highest_tier_rank, v_new_rank),
      active_staking_boost = case when v_unlocked then v_boost else v_profile.active_staking_boost end,
      boost_started_at = case when v_unlocked and v_boost > 0 then v_now else v_profile.boost_started_at end,
      boost_expires_at = case when v_unlocked and v_boost > 0
                              then v_now + make_interval(days => v_duration_days)
                              else v_profile.boost_expires_at end,
      updated_at = v_now
  where loyalty_profiles.wallet = p_wallet
  returning * into v_profile;

  return query select
    v_spin.spin_id, v_spin.result_code, v_spin.roll,
    v_spin.loyalty_xp, v_spin.bonus_xp, v_spin.total_xp,
    v_profile.loyalty_xp, v_profile.bonus_xp, v_profile.total_xp,
    v_profile.current_tier,
    case when v_profile.boost_expires_at is not null and v_profile.boost_expires_at > v_now
         then v_profile.active_staking_boost else 0 end,
    v_profile.boost_expires_at, v_unlocked,
    greatest(0, p_allowance - v_usage.used_spins),
    v_usage.period_started_at + make_interval(hours => p_window_hours);
end;
$$;

revoke all on function public.loyalty_start_spin(text,text,text,integer,integer,text,integer,text,integer)
from public, anon, authenticated;
grant execute on function public.loyalty_start_spin(text,text,text,integer,integer,text,integer,text,integer)
to service_role;
