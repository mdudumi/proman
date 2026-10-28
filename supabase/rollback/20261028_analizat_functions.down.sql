-- Undo 20261028_analizat_functions.sql: remove the Analizat functions.
-- The Analizat tabs then show an error until the functions are added again, unless the app
-- is back on a version that adds up the entries in the browser.

drop function if exists public.rpc_analizat_daily(date, date, uuid, uuid);
drop function if exists public.rpc_analizat_stock(date, date, uuid, uuid);
drop function if exists public.rpc_analizat_ledger(date, date, uuid);

notify pgrst, 'reload schema';
