-- Two new Veprimi: Import and Export (decided with the owner, 2026-11-19).
-- Import counts as a Hyrje/Blerje (goods in, money paid) and Export as a Shitje/Dalje (goods
-- out, money received), everywhere: the Bilanci, the Analizat tabs (daily invoices, stock and
-- year-end closing, buyer/seller accounts) and the Produktet page. The dashboard totals
-- (rpc_ditor_totals) return a row per Veprimi and the app adds Import into Hyrje and Export into
-- Dalje (src/lib/ditorEntries.js), so that function stays as it is.
-- Changes:
--   1. ditor_veprimi_check also accepts 'Import' and 'Export'.
--   2. The functions below compare with both values of each direction. Nothing else in them
--      changes: same parameters, columns and rules, so create or replace keeps their grants.
--      rpc_ditor_daily_report matched the words hyrje/blerje and shitje/dalje inside the
--      Veprimi; it now lists the exact values, which give the same result for the old ones.
-- Run it before the app version that offers Import and Export: until then the database refuses them.
-- To undo: supabase/rollback/20261119_import_export.down.sql

begin;

alter table public.ditor
  drop constraint ditor_veprimi_check,
  add constraint ditor_veprimi_check
    check (veprimi in ('Hyrje/Blerje', 'Shitje/Dalje', 'Import', 'Export'));

-- Bilanci (supabase/migrations/20261021_bilanci_tjeter_no_kg.sql)
CREATE OR REPLACE FUNCTION public.rpc_ditor_daily_report(p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_kategoria_id uuid DEFAULT NULL::uuid, p_produkti_id uuid DEFAULT NULL::uuid, p_monedha_id uuid DEFAULT NULL::uuid, p_bleresi_id uuid DEFAULT NULL::uuid, p_veprimi text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, data date, kategoria text, produkti text, monedha text, bleresi_shitesi text, veprimi text, opening_sasia numeric, sasia_hyrje numeric, sasia_dalje numeric, sasia_mbetur numeric, opening_shuma numeric, shuma_hyrje numeric, shuma_dalje numeric, shuma_mbetur numeric)
 LANGUAGE sql
 STABLE
AS $function$
with tx_all as (
  select
    t.id,
    t.data,
    t.kategoria_id,
    t.produkti_id,
    t.monedha_id,
    t.bleresi_shitesi_id,
    t.veprimi,
    coalesce(t.sasia, 0)::numeric as sasia,
    coalesce(t.shuma_leke, 0)::numeric as shuma_leke
  from public.ditor t
  where
    (p_kategoria_id is null or t.kategoria_id = p_kategoria_id)
    and (p_produkti_id is null or t.produkti_id = p_produkti_id)
    and (p_monedha_id is null or t.monedha_id = p_monedha_id)
    and (p_bleresi_id is null or t.bleresi_shitesi_id = p_bleresi_id)
    and (p_veprimi is null or t.veprimi = p_veprimi)
),
tx_enriched as (
  select
    t.id,
    t.data,
    t.kategoria_id,
    t.produkti_id,
    t.monedha_id,
    t.bleresi_shitesi_id,
    t.veprimi,

    case
      when t.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid then 0 -- Tjetër: not kilograms
      when t.veprimi in ('Hyrje/Blerje', 'Import') then t.sasia
      else 0
    end as sasia_hyrje,

    case
      when t.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid then 0 -- Tjetër: not kilograms
      when t.veprimi in ('Shitje/Dalje', 'Export') then t.sasia
      else 0
    end as sasia_dalje,

    case
      when t.veprimi in ('Hyrje/Blerje', 'Import') then t.shuma_leke
      else 0
    end as shuma_hyrje,

    case
      when t.veprimi in ('Shitje/Dalje', 'Export') then t.shuma_leke
      else 0
    end as shuma_dalje,

    case
      when t.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid then 0 -- Tjetër: not kilograms
      when t.veprimi in ('Hyrje/Blerje', 'Import') then t.sasia
      when t.veprimi in ('Shitje/Dalje', 'Export') then -t.sasia
      else 0
    end as net_sasia,

    case
      when t.veprimi in ('Hyrje/Blerje', 'Import') then t.shuma_leke
      when t.veprimi in ('Shitje/Dalje', 'Export') then -t.shuma_leke
      else 0
    end as net_shuma
  from tx_all t
),
tx_running as (
  select
    x.*,

    coalesce(
      sum(x.net_sasia) over (
        order by x.data, x.id
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as opening_sasia,

    coalesce(
      sum(x.net_shuma) over (
        order by x.data, x.id
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as opening_shuma,

    coalesce(
      sum(x.net_sasia) over (
        order by x.data, x.id
        rows between unbounded preceding and current row
      ),
      0
    ) as sasia_mbetur,

    coalesce(
      sum(x.net_shuma) over (
        order by x.data, x.id
        rows between unbounded preceding and current row
      ),
      0
    ) as shuma_mbetur
  from tx_enriched x
),
tx_filtered as (
  select *
  from tx_running
  where
    (p_from_date is null or data >= p_from_date)
    and (p_to_date is null or data <= p_to_date)
)
select
  f.id,
  f.data,
  k.name as kategoria,
  p.name as produkti,
  m.name as monedha,
  bs.name as bleresi_shitesi,
  f.veprimi,
  f.opening_sasia,
  f.sasia_hyrje,
  f.sasia_dalje,
  f.sasia_mbetur,
  f.opening_shuma,
  f.shuma_hyrje,
  f.shuma_dalje,
  f.shuma_mbetur
from tx_filtered f
left join public.kategoria k on k.id = f.kategoria_id
left join public.kategoria_list p on p.id = f.produkti_id
left join public.kategoria_list m on m.id = f.monedha_id
left join public.kategoria_list bs on bs.id = f.bleresi_shitesi_id
order by f.data, f.id;
$function$;

-- Analizat (supabase/migrations/20261028_analizat_functions.sql)
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
    coalesce(sum(d.sasia) filter (where d.veprimi in ('Hyrje/Blerje', 'Import') and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as hyrje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Hyrje/Blerje', 'Import')), 0) as hyrje_shuma,
    coalesce(sum(d.sasia) filter (where d.veprimi in ('Shitje/Dalje', 'Export') and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as dalje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Shitje/Dalje', 'Export')), 0) as dalje_shuma
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
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Hyrje/Blerje', 'Import')), 0) as hyrje_shuma,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Shitje/Dalje', 'Export')), 0) as dalje_shuma,
    -- In stock: Hyrje minus Dalje. Tjetër: not kilograms
    coalesce(sum(case when d.veprimi in ('Hyrje/Blerje', 'Import') then d.sasia else -d.sasia end)
      filter (where d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as sasia,
    coalesce(sum(case when d.veprimi in ('Hyrje/Blerje', 'Import') then d.shuma_leke else -d.shuma_leke end), 0) as vlera
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
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Hyrje/Blerje', 'Import')), 0) as hyrje,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Shitje/Dalje', 'Export')), 0) as dalje,
    -- What is owed: Hyrje minus Dalje
    coalesce(sum(case when d.veprimi in ('Hyrje/Blerje', 'Import') then d.shuma_leke else -d.shuma_leke end), 0) as detyrim
  from public.ditor d
  left join public.kategoria_list b on b.id = d.bleresi_shitesi_id
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_bleresi_id is null or d.bleresi_shitesi_id = p_bleresi_id)
  group by d.bleresi_shitesi_id, b.name
  order by b.name, d.bleresi_shitesi_id;
$function$;

-- Produktet (supabase/migrations/20261109_produktet.sql)
create or replace function public.rpc_produktet(
  p_from_date date default null,
  p_to_date date default null,
  p_kategoria_id uuid default null,
  p_produkti_id uuid default null,
  p_monedha_id uuid default null,
  p_bleresi_id uuid default null
)
returns table (
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
    p.kategoria_id,
    k.name as kategoria,
    d.produkti_id,
    p.name as produkti,
    coalesce(p.kategoria_id = '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid, false) as tjeter,
    -- Tjetër: not kilograms
    coalesce(sum(d.sasia) filter (where d.veprimi in ('Hyrje/Blerje', 'Import') and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as hyrje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Hyrje/Blerje', 'Import')), 0) as hyrje_shuma,
    coalesce(sum(d.sasia) filter (where d.veprimi in ('Shitje/Dalje', 'Export') and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as dalje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi in ('Shitje/Dalje', 'Export')), 0) as dalje_shuma
  from public.ditor d
  left join public.kategoria_list p on p.id = d.produkti_id
  left join public.kategoria k on k.id = p.kategoria_id
  -- The same filters as the dashboard table (src/lib/ditorEntries.js, entriesQuery).
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_kategoria_id is null or d.kategoria_id = p_kategoria_id)
    and (p_produkti_id is null or d.produkti_id = p_produkti_id)
    and (p_monedha_id is null or d.monedha_id = p_monedha_id)
    and (p_bleresi_id is null or d.bleresi_shitesi_id = p_bleresi_id)
  group by d.produkti_id, p.name, p.kategoria_id, k.name
  order by k.name, p.name, d.produkti_id;
$function$;

commit;

-- Let the API see the changes straight away.
notify pgrst, 'reload schema';
