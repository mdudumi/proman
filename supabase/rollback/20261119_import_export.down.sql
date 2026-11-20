-- Undo 20261119_import_export.sql: the database accepts only Hyrje/Blerje and Shitje/Dalje again.
-- 1. Put the app back on a version without Import and Export first.
-- 2. The constraint can't come back while entries with Import or Export exist: this script stops
--    with an error and changes nothing. Change those entries to Hyrje/Blerje or Shitje/Dalje, or
--    delete them, then run it again. To list them:
--      select * from public.ditor where veprimi in ('Import', 'Export');
-- 3. Then run these again, in this order, to put the functions back as they were:
--      supabase/migrations/20261021_bilanci_tjeter_no_kg.sql
--      supabase/migrations/20261028_analizat_functions.sql
--      supabase/migrations/20261109_produktet.sql
--    They only replace functions, so running them again is safe.

alter table public.ditor
  drop constraint ditor_veprimi_check,
  add constraint ditor_veprimi_check
    check (veprimi in ('Hyrje/Blerje', 'Shitje/Dalje'));
