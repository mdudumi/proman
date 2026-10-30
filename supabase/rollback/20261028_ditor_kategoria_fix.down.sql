-- Undo 20261028_ditor_kategoria_fix.sql: put the corrected entries back under their old
-- category, from the backup, then remove the backup so the fix could be run again.
-- All or nothing: if any of those entries was deleted, or its category changed again since the
-- fix, it stops and changes nothing, so no later edit is overwritten.

do $undo$
declare
  saved integer;
  restored integer;
begin
  select count(*) into saved from backup.ditor_kategoria_20261028;

  update public.ditor d
  set kategoria_id = b.old_kategoria_id
  from backup.ditor_kategoria_20261028 b
  where b.id = d.id
    and d.kategoria_id = b.new_kategoria_id;
  get diagnostics restored = row_count;

  if restored <> saved then
    raise exception 'Only % of % entries are as the fix left them: some were deleted or changed since. Nothing was changed.', restored, saved;
  end if;

  drop table backup.ditor_kategoria_20261028;
end
$undo$;

-- What was done: the SQL Editor shows this result.
select count(*) as mismatches_now
from public.ditor d
join public.kategoria_list p on p.id = d.produkti_id
where d.kategoria_id <> p.kategoria_id;
