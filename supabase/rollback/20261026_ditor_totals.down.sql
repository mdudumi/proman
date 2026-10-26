-- Undo 20261026_ditor_totals.sql: remove the dashboard totals function.
-- The dashboard's totals rows then show an error until the function is added again.

drop function if exists public.rpc_ditor_totals(date, date, uuid, uuid, uuid, uuid, text);

notify pgrst, 'reload schema';
