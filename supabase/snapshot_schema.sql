-- PROMAN schema snapshot. Read-only: it changes nothing in the database.
-- Run it in Supabase → SQL Editor, export the result as CSV and save it as
-- supabase/schema-snapshot.csv. That file is git-ignored because it includes business figures.
with
fn as (
  select '1 function' as section, p.proname::text as name, pg_get_functiondef(p.oid) as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
col as (
  select '2 column' as section, c.table_name || '.' || c.column_name as name,
         c.data_type
           || case when c.is_nullable = 'NO' then ' not null' else '' end
           || coalesce(' default ' || c.column_default, '')
           || case when c.is_generated = 'ALWAYS'
                   then ' generated always as (' || c.generation_expression || ')' else '' end as detail
  from information_schema.columns c
  where c.table_schema = 'public'
),
con as (
  select '3 constraint' as section, r.relname || '.' || k.conname as name, pg_get_constraintdef(k.oid) as detail
  from pg_constraint k join pg_class r on r.oid = k.conrelid join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'public'
),
rls as (
  select '4 rls' as section, c.relname::text as name,
         case when c.relrowsecurity then 'enabled' else 'DISABLED' end as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
pol as (
  select '5 policy' as section, tablename || '.' || policyname as name,
         cmd || ' to ' || array_to_string(roles, ',')
           || coalesce(' using (' || qual || ')', '')
           || coalesce(' with check (' || with_check || ')', '') as detail
  from pg_policies where schemaname = 'public'
),
trg as (
  select '6 trigger' as section, c.relname || '.' || t.tgname as name, pg_get_triggerdef(t.oid) as detail
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
vw as (
  select '7 view' as section, viewname::text as name, definition as detail
  from pg_views where schemaname = 'public'
),
stats as (
  select '8 data' as section, 'ditor rows' as name, count(*)::text as detail from public.ditor
  union all select '8 data', 'ditor date range', min(data)::text || ' to ' || max(data)::text from public.ditor
  union all select '8 data', 'ditor rows dated before 2000', count(*)::text from public.ditor where data < '2000-01-01'
  union all select '8 data', 'ditor rows with quantity 1', count(*)::text from public.ditor where sasia = 1
),
qty1 as (
  select '9 quantity-1 entries' as section,
         coalesce(k.name, '(none)') || ' / ' || coalesce(p.name, '(none)') || ' / ' || d.veprimi as name,
         count(*)::text || ' rows, ' || sum(d.shuma_leke)::text || ' lekë' as detail
  from public.ditor d
  left join public.kategoria_list p on p.id = d.produkti_id
  left join public.kategoria k on k.id = d.kategoria_id
  where d.sasia = 1
  group by k.name, p.name, d.veprimi
)
select * from fn
union all select * from col
union all select * from con
union all select * from rls
union all select * from pol
union all select * from trg
union all select * from vw
union all select * from stats
union all select * from qty1
order by 1, 2;
