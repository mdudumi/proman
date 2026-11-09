-- Products page (Produktet): one row per product, with what came in and what went out, in kg
-- and lekë, for the same filters as the dashboard except Veprimi (both directions are columns).
-- Same rules as rpc_ditor_totals: Tjetër entries are money movements (decided with the owner,
-- 2026-10-21), so their lekë count but their quantity of 1 isn't kilograms, and every kg column
-- leaves them out.
-- Rows show the product's own category, as rpc_analizat_stock does. The products are joined
-- with a left join, so every matching entry counts and the sums always equal the dashboard
-- totals; an entry without a product would come back as a row with no product.
-- New and read-only: nothing that exists changes. It runs with the caller's rights, so the
-- access rules on ditor apply, and only logged-in users may call it.
-- To undo: supabase/rollback/20261109_produktet.down.sql

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
    coalesce(sum(d.sasia) filter (where d.veprimi = 'Hyrje/Blerje' and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as hyrje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Hyrje/Blerje'), 0) as hyrje_shuma,
    coalesce(sum(d.sasia) filter (where d.veprimi = 'Shitje/Dalje' and d.kategoria_id <> '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111'::uuid), 0) as dalje_sasia,
    coalesce(sum(d.shuma_leke) filter (where d.veprimi = 'Shitje/Dalje'), 0) as dalje_shuma
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

revoke all on function public.rpc_produktet(date, date, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.rpc_produktet(date, date, uuid, uuid, uuid, uuid) to authenticated;

-- Let the API see the new function straight away.
notify pgrst, 'reload schema';
