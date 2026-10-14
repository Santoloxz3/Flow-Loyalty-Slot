-- Transactional integration tests. Never persist test wallets or XP.
begin;
set local role service_role;
do $$
declare
  w text := 'maintenance-test-' || gen_random_uuid()::text;
  p public.loyalty_profiles%rowtype;
  deadline timestamptz;
begin
  insert into public.loyalty_profiles(wallet,loyalty_xp) values(w,24995);
  perform public.loyalty_start_spin_v2(w,'test-nft','legendary',5,24,'unlock',1,'no_win',0);
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert p.total_xp=25000 and p.flow_god_active and p.maintenance_xp=0, 'unlock excludes historical and unlock XP';
  assert p.maintenance_expires_at-p.maintenance_started_at=interval '720 hours', '30-day cycle';
  deadline := p.maintenance_expires_at;
  perform public.loyalty_start_spin_v2(w,'test-nft','legendary',5,24,'second',100,'jackpot',195);
  perform public.loyalty_start_spin_v2(w,'another-nft','legendary',5,24,'second',100,'jackpot',195);
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert p.total_xp=25200 and p.maintenance_xp=200, 'wallet-wide replay adds XP exactly once';
  assert p.maintenance_expires_at=deadline, 'spin does not extend cycle';
  update public.loyalty_profiles set maintenance_xp=1000,maintenance_expires_at=clock_timestamp()-interval '1 second' where wallet=w;
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert p.flow_god_active and p.maintenance_xp=0 and p.active_staking_boost=25, 'qualified renewal';
  assert p.maintenance_expires_at-p.maintenance_started_at=interval '720 hours', 'renewal anchored at prior deadline';
  update public.loyalty_profiles set maintenance_xp=800,maintenance_expires_at=clock_timestamp()-interval '1 second' where wallet=w;
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert not p.flow_god_active and p.current_tier='legend' and p.active_staking_boost=20, 'inactive Legend fallback';
  assert p.highest_tier_rank=5 and p.total_xp=25200 and p.maintenance_xp=800, 'no Lifetime XP loss';
  perform public.loyalty_start_spin_v2(w,'test-nft','legendary',5,24,'reactivate',100,'jackpot',195);
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert p.flow_god_active and p.maintenance_xp=0 and p.total_xp=25400, 'reactivation resets counter';
  update public.loyalty_profiles set maintenance_xp=1000,maintenance_expires_at=clock_timestamp()-interval '721 hours' where wallet=w;
  select * into p from public.loyalty_profile_snapshot_v2(w);
  assert not p.flow_god_active and p.maintenance_xp=0, 'no repeated renewal from stale XP';
  insert into public.loyalty_profiles(wallet,loyalty_xp,current_tier,highest_tier_rank,active_staking_boost,boost_expires_at)
    values(w||'-legend',10000,'legend',4,20,clock_timestamp()-interval '1 second');
  select * into p from public.loyalty_profile_snapshot_v2(w||'-legend');
  assert p.current_tier='legend' and p.highest_tier_rank=4 and p.maintenance_xp=0 and p.flow_god_unlocked_at is null, 'permanent Legend tier, no maintenance';
  insert into public.loyalty_profiles(wallet,loyalty_xp,current_tier,highest_tier_rank) values(w||'-existing',30000,'flow_god',5);
  select * into p from public.loyalty_profile_snapshot_v2(w||'-existing');
  assert p.flow_god_active and p.maintenance_xp=0 and p.total_xp=30000, 'existing FLOW GOD starts fresh';
  assert not has_function_privilege('anon','public.loyalty_start_spin_v2(text,text,text,integer,integer,text,integer,text,integer)','EXECUTE'), 'no anonymous spin RPC';
  assert not has_function_privilege('authenticated','public.loyalty_profile_snapshot_v2(text)','EXECUTE'), 'no client profile mutation';
end;
$$;
select 'FLOW GOD integration assertions passed' as result;
rollback;
