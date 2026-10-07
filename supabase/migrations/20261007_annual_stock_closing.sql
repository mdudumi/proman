-- Mbyllja vjetore ruhet veç faturave, që hyrjet e reja të vitit të mos
-- ndryshojnë gjendjen historike të mbyllur.
create table if not exists public.gjendje_vjetore (
  id uuid primary key default gen_random_uuid(),
  viti integer not null check (viti between 2000 and 2100),
  data_mbylljes date not null,
  produkti_id uuid not null references public.kategoria_list(id),
  kategoria_id uuid not null references public.kategoria(id),
  sasia numeric(14,3) not null default 0,
  vlera_leke numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (viti, produkti_id)
);

alter table public.gjendje_vjetore enable row level security;

create policy "Authenticated users can read annual closings"
  on public.gjendje_vjetore for select to authenticated using (true);
create policy "Authenticated users can create annual closings"
  on public.gjendje_vjetore for insert to authenticated with check (auth.uid() = created_by);
create policy "Authenticated users can update annual closings"
  on public.gjendje_vjetore for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
