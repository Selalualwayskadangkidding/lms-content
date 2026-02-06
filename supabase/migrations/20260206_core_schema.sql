-- Core schema for LMS

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  nis text,
  role text not null default 'STUDENT',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- subjects
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- assessments
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes integer,
  is_published boolean not null default false,
  access_password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  prompt text not null,
  points integer not null default 1,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- options
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text text not null,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

-- answer_keys (one per question)
create table if not exists public.answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_id uuid not null references public.options(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- attempts
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'IN_PROGRESS',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- responses
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.options(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- indexes
create index if not exists attempts_assessment_id_idx on public.attempts(assessment_id);
create index if not exists attempts_student_id_idx on public.attempts(student_id);
create index if not exists responses_attempt_id_idx on public.responses(attempt_id);
create index if not exists questions_assessment_id_idx on public.questions(assessment_id);
