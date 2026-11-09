-- Undo 20261109_produktet.sql: remove the products page's function.
-- The Produktet page then shows an error until the function is added again.

drop function if exists public.rpc_produktet(date, date, uuid, uuid, uuid, uuid);

notify pgrst, 'reload schema';
