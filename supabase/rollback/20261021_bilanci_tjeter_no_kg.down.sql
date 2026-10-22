-- Undo 20261021_bilanci_tjeter_no_kg.sql: restore the report function as it was before
-- that migration (taken from the 2026-10-20 schema snapshot).

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
      when lower(t.veprimi) like '%blerje%' or lower(t.veprimi) like '%hyrje%' then t.sasia
      else 0
    end as sasia_hyrje,

    case
      when lower(t.veprimi) like '%shitje%' or lower(t.veprimi) like '%dalje%' then t.sasia
      else 0
    end as sasia_dalje,

    case
      when lower(t.veprimi) like '%blerje%' or lower(t.veprimi) like '%hyrje%' then t.shuma_leke
      else 0
    end as shuma_hyrje,

    case
      when lower(t.veprimi) like '%shitje%' or lower(t.veprimi) like '%dalje%' then t.shuma_leke
      else 0
    end as shuma_dalje,

    case
      when lower(t.veprimi) like '%blerje%' or lower(t.veprimi) like '%hyrje%' then t.sasia
      when lower(t.veprimi) like '%shitje%' or lower(t.veprimi) like '%dalje%' then -t.sasia
      else 0
    end as net_sasia,

    case
      when lower(t.veprimi) like '%blerje%' or lower(t.veprimi) like '%hyrje%' then t.shuma_leke
      when lower(t.veprimi) like '%shitje%' or lower(t.veprimi) like '%dalje%' then -t.shuma_leke
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
