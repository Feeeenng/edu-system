create table if not exists public.deliveries (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null
);

create index if not exists deliveries_updated_at_idx
  on public.deliveries (updated_at desc);

alter table public.deliveries enable row level security;

drop policy if exists deliveries_anon_select on public.deliveries;
create policy deliveries_anon_select
  on public.deliveries
  for select
  to anon
  using (true);

drop policy if exists deliveries_anon_insert on public.deliveries;
create policy deliveries_anon_insert
  on public.deliveries
  for insert
  to anon
  with check (true);

drop policy if exists deliveries_anon_update on public.deliveries;
create policy deliveries_anon_update
  on public.deliveries
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists deliveries_anon_delete on public.deliveries;
create policy deliveries_anon_delete
  on public.deliveries
  for delete
  to anon
  using (true);
