-- Dashboard totals: the totals rows under the Forma Hyrëse table (front-end R2).
-- Adds up every entry that matches the dashboard's seven filters, so the totals cover all
-- matching entries, not only the 100 on screen. One row per Veprimi (Hyrje/Blerje, Shitje/Dalje).
-- Tjetër entries are money movements (decided with the owner, 2026-10-21): their lekë count in
-- `shuma`, but their quantity of 1 isn't kilograms, so it's left out of `sasia`. `shuma_mall`
-- is the goods-only lekë that the average price per kg uses (shuma_mall ÷ sasia).
-- New and read-only: nothing that exists changes. It runs with the caller's rights, so the
-- access rules on ditor apply, and only logged-in users may call it.
-- To undo: supabase/rollback/20261026_ditor_totals.down.sql

create or replace function public.rpc_ditor_totals(
  p_from_date date default null,
  p_to_date date default null,
  p_kategoria_id uuid default null,
  p_produkti_id uuid default null,
  p_monedha_id uuid default null,
  p_bleresi_id uuid default null,
  p_veprimi text default null
)
returns table (veprimi text, regjistrime bigint, sasia numeric, shuma numeric, shuma_mall numeric)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    d.veprimi,
    count(*) as regjistrime,
    coalesce(sum(d.sasia) filter (where d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as sasia, -- Tjetër: not kilograms
    sum(d.shuma_leke) as shuma,
    coalesce(sum(d.shuma_leke) filter (where d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as shuma_mall
  from public.ditor d
  -- The same filters as the dashboard table (src/lib/ditorEntries.js, entriesQuery).
  where (p_from_date is null or d.data >= p_from_date)
    and (p_to_date is null or d.data <= p_to_date)
    and (p_kategoria_id is null or d.kategoria_id = p_kategoria_id)
    and (p_produkti_id is null or d.produkti_id = p_produkti_id)
    and (p_monedha_id is null or d.monedha_id = p_monedha_id)
    and (p_bleresi_id is null or d.bleresi_shitesi_id = p_bleresi_id)
    and (p_veprimi is null or d.veprimi = p_veprimi)
  group by d.veprimi
  order by d.veprimi;
$function$;

revoke all on function public.rpc_ditor_totals(date, date, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.rpc_ditor_totals(date, date, uuid, uuid, uuid, uuid, text) to authenticated;

-- Let the API see the new function straight away.
notify pgrst, 'reload schema';
