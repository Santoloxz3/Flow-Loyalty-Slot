-- Apply after LOYALTY_XP_SCHEMA.sql. Additive, service-role-only testnet V2.
-- Preserve the first pre-maintenance snapshot on repeat application.
create schema if not exists backup_pre_flow_god_20261014;
revoke all on schema backup_pre_flow_god_20261014 from public,anon,authenticated;
create table if not exists backup_pre_flow_god_20261014.loyalty_profiles as
  select * from public.loyalty_profiles;
create table if not exists backup_pre_flow_god_20261014.rpc_definitions as
  select p.proname, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('loyalty_profile_snapshot','loyalty_start_spin');
revoke all on all tables in schema backup_pre_flow_god_20261014 from public,anon,authenticated;
alter table public.loyalty_profiles
  add column if not exists flow_god_unlocked_at timestamptz,
  add column if not exists flow_god_active boolean not null default false,
  add column if not exists maintenance_xp bigint not null default 0 check (maintenance_xp >= 0),
  add column if not exists maintenance_started_at timestamptz,
  add column if not exists maintenance_expires_at timestamptz;

-- Serialized with spin writes. Expiry is reconciled on every status/claim/spin.
create or replace function public.loyalty_reconcile_flow_god(p_wallet text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  p public.loyalty_profiles%rowtype;
  t timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(p_wallet), 0));
  t := clock_timestamp();
  insert into public.loyalty_profiles(wallet) values(p_wallet)
    on conflict on constraint loyalty_profiles_pkey do nothing;
  select * into p from public.loyalty_profiles where wallet=p_wallet for update;
  if p.total_xp >= 25000 and p.flow_god_unlocked_at is null then
    -- Existing FLOW GOD wallets start a fresh cycle; historical XP never counts.
    p.flow_god_unlocked_at := t;
    p.flow_god_active := true;
    p.maintenance_xp := 0;
    p.maintenance_started_at := t;
    p.maintenance_expires_at := t + interval '720 hours';
  end if;
  if p.flow_god_active and t >= p.maintenance_expires_at then
    if p.maintenance_xp >= 1000 then
      p.maintenance_started_at := p.maintenance_expires_at;
      p.maintenance_expires_at := p.maintenance_expires_at + interval '720 hours';
      p.maintenance_xp := 0;
      -- A long absence cannot renew multiple cycles with the same XP.
      if t >= p.maintenance_expires_at then p.flow_god_active := false; end if;
    else
      p.flow_god_active := false;
    end if;
  end if;
  if p.flow_god_unlocked_at is not null then
    update public.loyalty_profiles set
      flow_god_unlocked_at=p.flow_god_unlocked_at,
      flow_god_active=p.flow_god_active,
      maintenance_xp=p.maintenance_xp,
      maintenance_started_at=p.maintenance_started_at,
      maintenance_expires_at=p.maintenance_expires_at,
      highest_tier_rank=greatest(highest_tier_rank,5),
      current_tier=case when p.flow_god_active then 'flow_god' else 'legend' end,
      active_staking_boost=case when p.flow_god_active then 25 else 20 end,
      boost_started_at=p.maintenance_started_at,
      boost_expires_at=case when p.flow_god_active then p.maintenance_expires_at else null end,
      updated_at=t where wallet=p_wallet;
  elsif p.boost_expires_at <= t then
    update public.loyalty_profiles set active_staking_boost=0,
      boost_started_at=null,boost_expires_at=null,updated_at=t where wallet=p_wallet;
  end if;
end;
$$;
revoke all on function public.loyalty_reconcile_flow_god(text) from public,anon,authenticated;
grant execute on function public.loyalty_reconcile_flow_god(text) to service_role;

create or replace function public.loyalty_profile_snapshot_v2(p_wallet text)
returns setof public.loyalty_profiles language plpgsql security invoker set search_path = '' as $$
begin
  perform public.loyalty_reconcile_flow_god(p_wallet);
  return query select * from public.loyalty_profiles where wallet=p_wallet;
end;
$$;
revoke all on function public.loyalty_profile_snapshot_v2(text) from public,anon,authenticated;
grant execute on function public.loyalty_profile_snapshot_v2(text) to service_role;

create or replace function public.loyalty_start_spin_v2(
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
security invoker
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
  v_already_flow_god boolean := false;
begin
  if p_wallet is null or length(trim(p_wallet)) = 0 then raise exception 'WALLET_REQUIRED'; end if;
  if p_object_id is null or length(trim(p_object_id)) = 0 then raise exception 'OBJECT_REQUIRED'; end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if p_allowance <= 0 or p_window_hours <= 0 then raise exception 'INVALID_SPIN_RULE'; end if;
  if p_roll < 1 or p_roll > 100 then raise exception 'INVALID_ROLL'; end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(p_wallet), 0));
  v_now := clock_timestamp();
  perform public.loyalty_reconcile_flow_god(p_wallet);
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
      case when v_profile.boost_expires_at is null or v_profile.boost_expires_at > v_now
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

  insert into public.loyalty_profiles(wallet) values (p_wallet) on conflict on constraint loyalty_profiles_pkey do nothing;
  select * into v_profile from public.loyalty_profiles p where p.wallet = p_wallet for update;

  if v_profile.active_staking_boost > 0
     and v_profile.boost_expires_at is not null
     and v_profile.boost_expires_at <= v_now then
    v_profile.active_staking_boost := 0;
    v_profile.boost_started_at := null;
    v_profile.boost_expires_at := null;
  end if;

  v_already_flow_god := v_profile.flow_god_unlocked_at is not null;
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

  -- Only XP from spins AFTER first unlock counts. The unlock spin is excluded.
  if v_already_flow_god then
    update public.loyalty_profiles set maintenance_xp=maintenance_xp+v_spin.total_xp
    where wallet=p_wallet returning * into v_profile;
    if not v_profile.flow_god_active and v_profile.maintenance_xp >= 1000 then
      update public.loyalty_profiles set flow_god_active=true,maintenance_xp=0,
        maintenance_started_at=v_now,maintenance_expires_at=v_now+interval '720 hours'
      where wallet=p_wallet;
    end if;
  end if;
  perform public.loyalty_reconcile_flow_god(p_wallet);
  select * into v_profile from public.loyalty_profiles where wallet=p_wallet;

  return query select
    v_spin.spin_id, v_spin.result_code, v_spin.roll,
    v_spin.loyalty_xp, v_spin.bonus_xp, v_spin.total_xp,
    v_profile.loyalty_xp, v_profile.bonus_xp, v_profile.total_xp,
    v_profile.current_tier,
    case when v_profile.boost_expires_at is null or v_profile.boost_expires_at > v_now
         then v_profile.active_staking_boost else 0 end,
    v_profile.boost_expires_at, v_unlocked,
    greatest(0, p_allowance - v_usage.used_spins),
    v_usage.period_started_at + make_interval(hours => p_window_hours);
end;
$$;

revoke all on function public.loyalty_start_spin_v2(text,text,text,integer,integer,text,integer,text,integer)
from public, anon, authenticated;
grant execute on function public.loyalty_start_spin_v2(text,text,text,integer,integer,text,integer,text,integer)
to service_role;
