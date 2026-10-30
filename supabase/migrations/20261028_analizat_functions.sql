-- Analizat tabs: the database adds up the entries and returns the finished rows (backend B11),
-- instead of the browser downloading every entry and adding them up itself.
--   rpc_analizat_daily   Faturat ditore: one row per day and product. The app pages through it.
--   rpc_analizat_stock   Gjendja / Mbyllja: one row per product, Hyrje minus Dalje.
--   rpc_analizat_ledger  Llogaritë: one row per buyer/seller, Hyrje, Dalje and Detyrimi.
-- Category and product filter the first two. The buyer/seller filters only Llogaritë: a
-- customer's account can't be split by product.
-- Same rules as rpc_ditor_totals, whose figures the app shows as the TOTALI of Faturat ditore:
-- Tjetër entries are money movements (decided with the owner, 2026-10-21), so their lekë count
-- but their quantity of 1 isn't kilograms, and every kg column leaves them out.
-- Rows show the product's own category, so the stock has exactly one row per product, as the
-- year-end closing needs.
-- New and read-only: nothing that exists changes. They run with the caller's rights, so the
-- access rules on ditor apply, and only logged-in users may call them.
-- To undo: supabase/rollback/20261028_analizat_functions.down.sql

create or replace function public.rpc_analizat_daily(
  p_from_date date default null,
  p_to_date date default null,
  p_kategoria_id uuid default null,
  p_produkti_id uuid default null
)
returns table (
  data date,
  kategoria_id uuid,
  kategoria text,
  produkti_id uuid,
  produkti text,
  tjeter boolean,
  hyrje_sasia numeric,
  hyrje_shuma numeric,
  dalje_sasia numeric,
  dalje_shuma numeric
)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    d.data,
    p.kategoria_id,
    k.name as kategoria,
    d.produkti_id,
    p.name as produkti,
    p.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid as tjeter,
    -- Tjetër: not kilograms
    coalesce(sum(d.sasia) filter (where d.veprimi = 'Hyrje/Blerje' and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as hyrje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Hyrje/Blerje'), 0) as hyrje_shuma,
    coalesce(sum(d.sasia) filter (where d.veprimi = 'Shitje/Dalje' and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as dalje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Shitje/Dalje'), 0) as dalje_shuma
  from public.ditor d
  join public.kategoria_list p on p.id = d.produkti_id
  left join public.kategoria k on k.id = p.kategoria_id
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_kategoria_id is null or d.kategoria_id = p_kategoria_id)
    and (p_produkti_id is null or d.produkti_id = p_produkti_id)
  group by d.data, d.produkti_id, p.name, p.kategoria_id, k.name
  order by d.data, k.name, p.name, d.produkti_id;
$function$;

create or replace function public.rpc_analizat_stock(
  p_from_date date default null,
  p_to_date date default null,
  p_kategoria_id uuid default null,
  p_produkti_id uuid default null
)
returns table (
  kategoria_id uuid,
  kategoria text,
  produkti_id uuid,
  produkti text,
  tjeter boolean,
  hyrje_shuma numeric,
  dalje_shuma numeric,
  sasia numeric,
  vlera numeric
)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    p.kategoria_id,
    k.name as kategoria,
    d.produkti_id,
    p.name as produkti,
    p.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid as tjeter,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Hyrje/Blerje'), 0) as hyrje_shuma,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Shitje/Dalje'), 0) as dalje_shuma,
    -- In stock: Hyrje minus Dalje. Tjetër: not kilograms
    coalesce(sum(case when d.veprimi = 'Hyrje/Blerje' then d.sasia else -d.sasia end)
      filter (where d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as sasia,
    coalesce(sum(case when d.veprimi = 'Hyrje/Blerje' then d.shuma_leke else -d.shuma_leke end), 0) as vlera
  from public.ditor d
  join public.kategoria_list p on p.id = d.produkti_id
  left join public.kategoria k on k.id = p.kategoria_id
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_kategoria_id is null or d.kategoria_id = p_kategoria_id)
    and (p_produkti_id is null or d.produkti_id = p_produkti_id)
  group by d.produkti_id, p.name, p.kategoria_id, k.name
  order by k.name, p.name, d.produkti_id;
$function$;

create or replace function public.rpc_analizat_ledger(
  p_from_date date default null,
  p_to_date date default null,
  p_bleresi_id uuid default null
)
returns table (
  bleresi_id uuid,
  bleresi text,
  hyrje numeric,
  dalje numeric,
  detyrim numeric
)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    d.bleresi_shitesi_id as bleresi_id,
    b.name as bleresi,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Hyrje/Blerje'), 0) as hyrje,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Shitje/Dalje'), 0) as dalje,
    -- What is owed: Hyrje minus Dalje
    coalesce(sum(case when d.veprimi = 'Hyrje/Blerje' then d.shuma_leke else -d.shuma_leke end), 0) as detyrim
  from public.ditor d
  left join public.kategoria_list b on b.id = d.bleresi_shitesi_id
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_bleresi_id is null or d.bleresi_shitesi_id = p_bleresi_id)
  group by d.bleresi_shitesi_id, b.name
  order by b.name, d.bleresi_shitesi_id;
$function$;

revoke all on function public.rpc_analizat_daily(date, date, uuid, uuid) from public, anon;
revoke all on function public.rpc_analizat_stock(date, date, uuid, uuid) from public, anon;
revoke all on function public.rpc_analizat_ledger(date, date, uuid) from public, anon;
grant execute on function public.rpc_analizat_daily(date, date, uuid, uuid) to authenticated;
grant execute on function public.rpc_analizat_stock(date, date, uuid, uuid) to authenticated;
grant execute on function public.rpc_analizat_ledger(date, date, uuid) to authenticated;

-- Let the API see the new functions straight away.
notify pgrst, 'reload schema';
