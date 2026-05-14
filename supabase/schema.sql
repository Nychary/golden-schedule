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

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  subject text not null check (subject in ('english', 'physics')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists students_subject_name_unique
on public.students (subject, first_name, last_name);

insert into public.students (first_name, last_name, subject)
values
  ('Ярослав', '', 'english'),
  ('Маша', '', 'english'),
  ('Даша', '', 'english'),
  ('Артём', '', 'physics'),
  ('Катя', '1', 'physics'),
  ('Катя', '2', 'physics'),
  ('Миша', '', 'physics'),
  ('Соня', '', 'physics')
on conflict (subject, first_name, last_name) do nothing;

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
drop trigger if exists students_set_updated_at on public.students;

create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row
execute function public.set_updated_at();

alter table public.lessons enable row level security;
alter table public.students enable row level security;

drop policy if exists "Public can read lessons" on public.lessons;
drop policy if exists "Public can create lessons" on public.lessons;
drop policy if exists "Public can update lessons" on public.lessons;
drop policy if exists "Public can delete lessons" on public.lessons;
drop policy if exists "Authenticated can read lessons" on public.lessons;
drop policy if exists "Authenticated can create lessons" on public.lessons;
drop policy if exists "Authenticated can update lessons" on public.lessons;
drop policy if exists "Authenticated can delete lessons" on public.lessons;
drop policy if exists "Public can read students" on public.students;
drop policy if exists "Public can create students" on public.students;
drop policy if exists "Public can update students" on public.students;
drop policy if exists "Public can delete students" on public.students;
drop policy if exists "Authenticated can read students" on public.students;
drop policy if exists "Authenticated can create students" on public.students;
drop policy if exists "Authenticated can update students" on public.students;
drop policy if exists "Authenticated can delete students" on public.students;

create policy "Authenticated can read lessons"
on public.lessons
for select
to authenticated
using (true);

create policy "Authenticated can create lessons"
on public.lessons
for insert
to authenticated
with check (true);

create policy "Authenticated can update lessons"
on public.lessons
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated can delete lessons"
on public.lessons
for delete
to authenticated
using (true);

create policy "Authenticated can read students"
on public.students
for select
to authenticated
using (true);

create policy "Authenticated can create students"
on public.students
for insert
to authenticated
with check (true);

create policy "Authenticated can update students"
on public.students
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated can delete students"
on public.students
for delete
to authenticated
using (true);

revoke select, insert, update, delete on public.lessons from anon;
revoke select, insert, update, delete on public.students from anon;
revoke usage on schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.students to authenticated;
