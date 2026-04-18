create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  unit int not null check (unit > 0 and unit <= 10),
  level int not null check (level in (100,200,300,400)),
  semester text not null check (semester in ('First','Second')),
  created_at timestamptz not null default now(),
  unique (code, level, semester)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  matric_number text not null unique,
  full_name text not null,
  level int not null check (level in (100,200,300,400)),
  created_at timestamptz not null default now()
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  session_id uuid not null references public.academic_sessions(id) on delete cascade,
  level int not null check (level in (100,200,300,400)),
  semester text not null check (semester in ('First','Second')),
  ca_score numeric not null default 0 check (ca_score >= 0 and ca_score <= 40),
  exam_score numeric not null default 0 check (exam_score >= 0 and exam_score <= 70),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, session_id, semester)
);

create index idx_results_session_sem_level on public.results (session_id, semester, level);
create index idx_results_student on public.results (student_id);
create index idx_courses_level_sem on public.courses (level, semester);
create index idx_students_level on public.students (level);

alter table public.academic_sessions enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.results enable row level security;

create policy "auth full access" on public.academic_sessions for all to authenticated using (true) with check (true);
create policy "auth full access" on public.courses for all to authenticated using (true) with check (true);
create policy "auth full access" on public.students for all to authenticated using (true) with check (true);
create policy "auth full access" on public.results for all to authenticated using (true) with check (true);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_results_updated
before update on public.results
for each row execute function public.update_updated_at_column();