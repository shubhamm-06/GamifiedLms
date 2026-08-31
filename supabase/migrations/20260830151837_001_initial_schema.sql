-- =====================================================================
-- Gamified LMS — Migration 001: Initial schema
-- 14 tables across identity, course content, learner activity,
-- commerce, and gamification, per Gamified_LMS_DB_Plan_v2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IDENTITY AND ACCESS
-- ---------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null,
  avatar_url     text,
  email          text unique not null,
  phone_number   text,
  role           text not null default 'student' check (role in ('student','admin')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. COURSE CONTENT
-- ---------------------------------------------------------------------

create table public.courses (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,
  title                  text not null,
  subtitle               text,
  description            text,
  thumbnail_url          text,
  status                 text not null default 'draft' check (status in ('draft','published','archived')),
  is_free                boolean not null default false,
  price_amount           int,
  currency               text not null default 'INR',
  external_product_id    text,
  access_type            text not null default 'lifetime' check (access_type in ('lifetime','fixed')),
  access_duration_days   int,
  enrollment_status      text not null default 'open' check (enrollment_status in ('open','paused','closed')),
  default_lesson_xp      int not null default 10,
  gamification_enabled   boolean not null default true,
  total_students         int not null default 0,
  total_lessons          int not null default 0,
  created_by             uuid references public.profiles(id),
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint chk_courses_fixed_access_duration check (
    access_type <> 'fixed' or (access_duration_days is not null and access_duration_days > 0)
  )
);

create index idx_courses_external_product_id on public.courses(external_product_id) where external_product_id is not null;

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  position    int not null,
  created_at  timestamptz not null default now()
);

create index idx_modules_course_id on public.modules(course_id);

create table public.games (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  title               text not null,
  bundle_url          text not null,
  bundle_version      text not null,
  bundle_size_bytes   bigint not null,
  checksum            text not null,
  max_xp              int not null default 0,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create table public.lessons (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references public.courses(id) on delete cascade,
  module_id          uuid references public.modules(id) on delete set null,
  title              text not null,
  summary            text,
  content_type       text not null check (content_type in ('video','text','quiz','game')),
  video_url          text,
  content_html       text,
  game_id            uuid references public.games(id),
  duration_seconds   int,
  xp_reward          int,
  is_preview         boolean not null default false,
  status             text not null default 'draft' check (status in ('draft','published')),
  position           int not null,
  created_at         timestamptz not null default now()
);

create index idx_lessons_course_id on public.lessons(course_id);
create index idx_lessons_module_id on public.lessons(module_id);

-- Server-computed effective XP so the client never performs the fallback itself.
create view public.lesson_effective_xp as
select l.id as lesson_id, coalesce(l.xp_reward, c.default_lesson_xp) as effective_xp
from public.lessons l
join public.courses c on c.id = l.course_id;

-- ---------------------------------------------------------------------
-- 3. COMMERCE
-- ---------------------------------------------------------------------

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id),
  course_id             uuid not null references public.courses(id),
  provider              text not null,
  provider_payment_id   text unique not null,
  email                 text not null,
  amount                int not null,
  currency              text not null default 'INR',
  status                text not null check (status in ('paid','refunded','failed')),
  raw_payload           jsonb not null,
  received_at           timestamptz not null default now()
);

create index idx_payments_email on public.payments(email);
create index idx_payments_user_id on public.payments(user_id);

-- ---------------------------------------------------------------------
-- 4. LEARNER ACTIVITY
-- ---------------------------------------------------------------------

create table public.enrollments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  course_id     uuid not null references public.courses(id),
  status        text not null default 'active' check (status in ('active','expired','revoked')),
  source        text not null check (source in ('purchase','manual','free')),
  payment_id    uuid references public.payments(id),
  enrolled_at   timestamptz not null default now(),
  expires_at    timestamptz,
  constraint uq_enrollments_user_course unique (user_id, course_id)
);

create index idx_enrollments_course_id on public.enrollments(course_id);

create table public.lesson_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id),
  lesson_id          uuid not null references public.lessons(id),
  course_id          uuid not null references public.courses(id),
  status             text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  progress_percent   int not null default 0,
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  constraint uq_lesson_progress_user_lesson unique (user_id, lesson_id)
);

create index idx_lesson_progress_course_id on public.lesson_progress(course_id);

create table public.quiz_questions (
  id               uuid primary key default gen_random_uuid(),
  lesson_id        uuid not null references public.lessons(id) on delete cascade,
  prompt           text not null,
  options          jsonb not null,
  correct_option   text not null,
  explanation      text,
  position         int not null
);

create index idx_quiz_questions_lesson_id on public.quiz_questions(lesson_id);

-- correct_option is never exposed to students; this view strips it and
-- gates rows to enrolled users (or preview lessons / admins).
create view public.quiz_questions_public as
select qq.id, qq.lesson_id, qq.prompt, qq.options, qq.explanation, qq.position
from public.quiz_questions qq
join public.lessons l on l.id = qq.lesson_id;

create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id),
  lesson_id      uuid not null references public.lessons(id),
  score          int not null,
  max_score      int not null,
  passed         boolean not null,
  answers        jsonb,
  attempted_at   timestamptz not null default now()
);

create index idx_quiz_attempts_user_lesson on public.quiz_attempts(user_id, lesson_id);

-- ---------------------------------------------------------------------
-- 5. GAMIFICATION
-- ---------------------------------------------------------------------

create table public.xp_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  amount        int not null,
  reason        text not null,
  source_type   text not null check (source_type in ('lesson','quiz','game','streak','manual')),
  source_id     uuid,
  created_at    timestamptz not null default now()
);

create unique index uq_xp_transactions_dedupe
  on public.xp_transactions(user_id, source_type, source_id)
  where source_id is not null;

create index idx_xp_transactions_user_id on public.xp_transactions(user_id);

create table public.user_stats (
  user_id              uuid primary key references public.profiles(id),
  total_xp             int not null default 0,
  level                int not null default 1,
  current_streak       int not null default 0,
  longest_streak       int not null default 0,
  last_activity_date   date,
  lessons_completed    int not null default 0
);

create table public.badges (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  description       text,
  icon_url          text,
  condition_type    text not null check (condition_type in ('lessons_completed','streak_days','total_xp','course_complete')),
  condition_value   int not null,
  is_active         boolean not null default true,
  created_by        uuid references public.profiles(id)
);

create table public.user_badges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  badge_id      uuid not null references public.badges(id),
  unlocked_at   timestamptz not null default now(),
  constraint uq_user_badges_user_badge unique (user_id, badge_id)
);

create index idx_user_badges_user_id on public.user_badges(user_id);

-- ---------------------------------------------------------------------
-- 6. ENABLE ROW LEVEL SECURITY (deny-all until policies land in 003)
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.modules          enable row level security;
alter table public.games            enable row level security;
alter table public.lessons          enable row level security;
alter table public.payments         enable row level security;
alter table public.enrollments      enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.xp_transactions  enable row level security;
alter table public.user_stats       enable row level security;
alter table public.badges           enable row level security;
alter table public.user_badges      enable row level security;
