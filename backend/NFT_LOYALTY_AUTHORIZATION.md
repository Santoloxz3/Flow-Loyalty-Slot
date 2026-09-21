# NFT Loyalty Authorization

For the new FLOW Loyalty XP system, an NFT is eligible only when:

1. Its Sui Object ID exists in `public.nft_spin_whitelist`.
2. The same Object ID has an explicit rarity in `public.nft_loyalty_rarity`.

The legacy `spins_per_day` value is no longer authoritative for the XP system.

## Rarity rules

| Rarity | Free Spins | Window |
|---|---:|---:|
| low | 1 | 48 hours |
| medium | 1 | 24 hours |
| high | 3 | 24 hours |
| legendary | 5 | 24 hours |

## Add a new authorized NFT

Insert the Object ID in the whitelist, then assign its rarity:

```sql
insert into public.nft_spin_whitelist(object_id, spins_per_day)
values ('0xOBJECT_ID', 1)
on conflict (object_id) do nothing;

insert into public.nft_loyalty_rarity(object_id, rarity)
values ('0xOBJECT_ID', 'medium')
on conflict (object_id) do update
set rarity = excluded.rarity;
```

The `spins_per_day` value in the first insert is retained only because it is part of the legacy table schema. The new loyalty backend ignores it.

## Remove authorization

For safety, prefer removing the Object ID from `nft_loyalty_rarity` first. The XP backend will immediately ignore a whitelisted NFT without an explicit rarity.

Do not delete legacy whitelist data unless a deliberate cleanup is intended.

## Current mapping

- `0x8543cf871fc79a7d21c6670bd7b9b84fc965fa7984d1d51063aea11c0d25548c` → legendary
- `0xac4308d95c1ea922e14ed7e989da3d1361d1dca2c2d6908ef227cf752391752f` → high
- `0xc15a28ba8590d8fa19ac59ea954561eac8faf52115c5a418847f23a2a00de0a4` → legendary
