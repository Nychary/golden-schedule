create extension if not exists pgcrypto;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student text not null,
  subject text not null check (subject in ('english', 'physics')),
  lesson_date date not null,
  lesson_time time not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;

create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

alter table public.lessons enable row level security;

drop policy if exists "Public can read lessons" on public.lessons;
drop policy if exists "Public can create lessons" on public.lessons;
drop policy if exists "Public can update lessons" on public.lessons;
drop policy if exists "Public can delete lessons" on public.lessons;

create policy "Public can read lessons"
on public.lessons
for select
to anon, authenticated
using (true);

create policy "Public can create lessons"
on public.lessons
for insert
to anon, authenticated
with check (true);

create policy "Public can update lessons"
on public.lessons
for update
to anon, authenticated
using (true)
with check (true);

create policy "Public can delete lessons"
on public.lessons
for delete
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.lessons to anon, authenticated;
