create table if not exists public.staking_free_spin (
  id bigserial primary key,
  wallet text not null,
  plan text not null check (plan in ('Loyal', 'Whale')),
  position_id text,
  last_used_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wallet, plan)
);

create index if not exists staking_free_spin_wallet_idx
  on public.staking_free_spin (wallet);

create index if not exists staking_free_spin_last_used_at_idx
  on public.staking_free_spin (last_used_at);
