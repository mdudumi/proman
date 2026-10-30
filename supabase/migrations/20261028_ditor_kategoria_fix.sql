-- Data fix: entries recorded under a different category than their product's.
-- Found on 2026-10-28 by the Analizat checks: 148 entries from July to September 2025, for four
-- products, none of them in Tjetër. They date from before front-end R7, when the entry form let a
-- product be picked under any category. The product's category in Organizim is the right one.
-- Why it matters: picking a product on the dashboard or the Bilanci also sets its category, so
-- those entries were left out of that product's figures, and counted in the wrong category's.
--
-- All or nothing, in one block:
--   1. Saves each entry's current category in backup.ditor_kategoria_20261028, so this can be
--      undone. The backup schema isn't reachable through the website's API.
--   2. Sets those entries' category to their product's category.
--   3. Stops, changing nothing, if the number isn't the 148 found on 2026-10-28, if any of them
--      moves into or out of Tjetër (that would change kg totals), or if any mismatch is left.
-- Running it a second time stops at step 1, because the backup table exists, so the backup is
-- never overwritten.
-- To undo: supabase/rollback/20261028_ditor_kategoria_fix.down.sql

do $fix$
declare
  tjeter constant uuid := '7bea04f2-8209-4f7c-aea2-d9ae0b0d1111';
  saved integer;
  changed integer;
  left_over integer;
begin
  create schema if not exists backup;
  create table backup.ditor_kategoria_20261028 (
    id uuid primary key,
    old_kategoria_id uuid not null,
    new_kategoria_id uuid not null,
    saved_at timestamptz not null default now()
  );

  insert into backup.ditor_kategoria_20261028 (id, old_kategoria_id, new_kategoria_id)
  select d.id, d.kategoria_id, p.kategoria_id
  from public.ditor d
  join public.kategoria_list p on p.id = d.produkti_id
  where d.kategoria_id <> p.kategoria_id;
  get diagnostics saved = row_count;

  if saved <> 148 then
    raise exception 'Expected 148 entries to correct, found %. Nothing was changed.', saved;
  end if;
  if exists (select 1 from backup.ditor_kategoria_20261028 where tjeter in (old_kategoria_id, new_kategoria_id)) then
    raise exception 'Some of these entries would move into or out of Tjetër, which changes kg totals. Nothing was changed.';
  end if;

  update public.ditor d
  set kategoria_id = b.new_kategoria_id
  from backup.ditor_kategoria_20261028 b
  where b.id = d.id;
  get diagnostics changed = row_count;

  select count(*) into left_over
  from public.ditor d
  join public.kategoria_list p on p.id = d.produkti_id
  where d.kategoria_id <> p.kategoria_id;

  if changed <> saved or left_over <> 0 then
    raise exception 'Changed % of % entries and % still differ. Nothing was changed.', changed, saved, left_over;
  end if;
end
$fix$;

-- What was done: the SQL Editor shows this result.
select
  (select count(*) from backup.ditor_kategoria_20261028) as entries_corrected,
  (select count(*)
     from public.ditor d
     join public.kategoria_list p on p.id = d.produkti_id
    where d.kategoria_id <> p.kategoria_id) as mismatches_left;
