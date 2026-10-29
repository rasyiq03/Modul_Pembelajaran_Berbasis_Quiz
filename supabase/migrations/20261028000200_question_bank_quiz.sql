/*
  0200 · Bank soal, kuis, dan percobaan kuis mandiri.

  Prinsip keamanan
  - Kunci jawaban & pembahasan ada di question_keys (hanya admin). Peserta menerima soal lewat
    start_quiz_attempt tanpa kunci, dan melihat kunci hanya sesuai pengaturan umpan balik kuis.
  - Peserta tidak bisa menulis tabel percobaan; mulai, kirim, dan nilai lewat fungsi server.
  - Tamu (login anonim) boleh ikut kuis yang mengizinkan tamu (settings.allow_guests).

  Format kunci (question_keys.answer) dan jawaban peserta (response) per jenis soal
    single_choice    {"answer": "B"}                    → {"selected": "B"}
    multiple_select  {"answers": ["A", "C"]}             → {"selected": ["C", "A"]}
    true_false       {"answer": true}                    → {"answer": true}
    short_answer     {"accepted": ["translasi"]}         → {"answer": "Translasi"}   (tanpa beda huruf besar/spasi)
    essay            {}                                  → {"answer": "teks"}        (dinilai manual)
    matching         {"pairs": {"L1": "R2", "L2": "R1"}} → {"pairs": {...}}          (opsi side = left/right)
    ordering         {"order": ["C", "A", "B"]}          → {"order": [...]}          (urutan penting)

  Pengaturan kuis (quizzes.settings)
    shuffle_questions, shuffle_options (bool) · time_limit_sec (int, null = tanpa batas)
    question_time_sec (int, kuis live) · attempts_allowed (int, null = tak terbatas)
    show_feedback: 'after_each' | 'after_submit' | 'never' · allow_guests (bool)
    pass_threshold (persen) · show_leaderboard (bool)
*/

-- ========== Bank soal ==========
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('single_choice', 'multiple_select', 'true_false', 'short_answer', 'essay', 'matching', 'ordering')),
  prompt      text not null,
  media_url   text,
  topic       text,
  difficulty  text check (difficulty in ('easy', 'medium', 'hard')),
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source_ref  text,          -- asal soal impor (mis. "stat-04#12"), mencegah impor ganda
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists questions_source_ref_key on public.questions(source_ref) where source_ref is not null;

create table if not exists public.question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions(id) on delete cascade,
  key           text not null,
  label         text not null,
  side          text check (side in ('left', 'right')),   -- khusus menjodohkan
  display_order int not null default 0,
  unique (question_id, key)
);
create index if not exists question_options_q_idx on public.question_options(question_id);

create table if not exists public.question_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  answer      jsonb not null default '{}'::jsonb,
  explanation text
);

create table if not exists public.question_materials (
  question_id uuid not null references public.questions(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (question_id, material_id)
);
create index if not exists qm_material_idx on public.question_materials(material_id);

create table if not exists public.question_tags (
  question_id uuid not null references public.questions(id) on delete cascade,
  tag         text not null,
  primary key (question_id, tag)
);

-- ========== Kuis ==========
create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  mode        text not null default 'self_paced'
              check (mode in ('self_paced', 'interactive_practice', 'live_competition', 'timed_assessment', 'self_paced_assessment')),
  settings    jsonb not null default '{}'::jsonb,
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  question_id   uuid not null references public.questions(id) on delete restrict,
  display_order int not null default 0,
  points        numeric not null default 1 check (points >= 0),
  primary key (quiz_id, question_id)
);
create index if not exists qq_question_idx on public.quiz_questions(question_id);

-- ========== Percobaan ==========
create table if not exists public.quiz_attempts (
  id                uuid primary key default gen_random_uuid(),
  quiz_id           uuid not null references public.quizzes(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  is_guest          boolean not null default false,
  is_preview        boolean not null default false,   -- pratinjau admin (FR-47), tidak masuk statistik
  nickname          text,
  status            text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz,
  finished_at       timestamptz,
  late              boolean not null default false,
  score             numeric not null default 0,
  max_score         numeric not null default 0,
  percent           numeric not null default 0,
  passed            boolean not null default false,
  question_order    uuid[] not null,
  option_order      jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb
);
create index if not exists attempts_quiz_idx on public.quiz_attempts(quiz_id);
create index if not exists attempts_user_idx on public.quiz_attempts(user_id, started_at desc);

create table if not exists public.attempt_answers (
  id                uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id       uuid not null references public.questions(id) on delete restrict,
  question_snapshot jsonb not null,
  response          jsonb,
  is_correct        boolean,
  points_awarded    numeric not null default 0,
  max_points        numeric not null default 0,
  graded_at         timestamptz,
  graded_by         text,
  unique (attempt_id, question_id)
);

-- ========== RLS ==========
alter table public.questions          enable row level security;
alter table public.question_options   enable row level security;
alter table public.question_keys      enable row level security;
alter table public.question_materials enable row level security;
alter table public.question_tags      enable row level security;
alter table public.quizzes            enable row level security;
alter table public.quiz_questions     enable row level security;
alter table public.quiz_attempts      enable row level security;
alter table public.attempt_answers    enable row level security;

revoke all on public.questions, public.question_options, public.question_keys, public.question_materials,
  public.question_tags, public.quizzes, public.quiz_questions, public.quiz_attempts, public.attempt_answers
  from anon, authenticated;

/* Bank soal: hanya admin, baca & tulis. Peserta menerima soal lewat fungsi. */
grant select, insert, update, delete on public.questions, public.question_options, public.question_keys,
  public.question_materials, public.question_tags, public.quiz_questions to authenticated;
do $$
declare t text;
begin
  foreach t in array array['questions', 'question_options', 'question_keys', 'question_materials', 'question_tags', 'quiz_questions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;

grant select on public.quizzes to anon, authenticated;
grant insert, update, delete on public.quizzes to authenticated;
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes
  for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists quizzes_admin_write on public.quizzes;
create policy quizzes_admin_write on public.quizzes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.quiz_attempts to authenticated;
drop policy if exists attempts_self_or_admin_select on public.quiz_attempts;
create policy attempts_self_or_admin_select on public.quiz_attempts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

grant select on public.attempt_answers to authenticated;
drop policy if exists aa_admin_select on public.attempt_answers;
create policy aa_admin_select on public.attempt_answers
  for select to authenticated using (public.is_admin());

-- ========== Pembantu (internal, tidak bisa dipanggil klien) ==========
/* Soal untuk peserta: tanpa kunci, opsi sesuai urutan acak percobaan */
create or replace function public._question_payload(p_question uuid, p_option_order jsonb default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', q.id, 'type', q.type, 'prompt', q.prompt, 'media_url', q.media_url, 'topic', q.topic,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('key', o.key, 'label', o.label, 'side', o.side)
                       order by coalesce(array_position(array(select jsonb_array_elements_text(p_option_order)), o.key), 0), o.display_order)
      from question_options o where o.question_id = q.id), '[]'::jsonb))
  from questions q where q.id = p_question;
$$;

/* Benar/salah suatu jawaban; null = perlu dinilai manual (esai) */
create or replace function public._grade_response(p_type text, p_key jsonb, p_resp jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare k text;
begin
  if p_resp is null or p_resp = 'null'::jsonb then
    return case when p_type = 'essay' then null else false end;
  end if;
  case p_type
    when 'single_choice' then
      return (p_resp ->> 'selected') is not distinct from (p_key ->> 'answer');
    when 'multiple_select' then
      return coalesce((select array_agg(distinct x order by x) from jsonb_array_elements_text(coalesce(p_resp -> 'selected', '[]')) x), '{}')
           = coalesce((select array_agg(distinct y order by y) from jsonb_array_elements_text(coalesce(p_key -> 'answers', '[]')) y), '{}');
    when 'true_false' then
      return jsonb_typeof(p_resp -> 'answer') = 'boolean' and (p_resp -> 'answer') = (p_key -> 'answer');
    when 'short_answer' then
      return exists (select 1 from jsonb_array_elements_text(coalesce(p_key -> 'accepted', '[]')) a
                     where lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(p_resp ->> 'answer', '')), '\s+', ' ', 'g')));
    when 'ordering' then
      -- urutan penting: bandingkan array apa adanya, tanpa diurutkan
      return (p_resp -> 'order') = (p_key -> 'order');
    when 'matching' then
      if jsonb_typeof(p_resp -> 'pairs') <> 'object' then return false; end if;
      for k in select jsonb_object_keys(p_key -> 'pairs') loop
        if (p_resp -> 'pairs' ->> k) is distinct from (p_key -> 'pairs' ->> k) then return false; end if;
      end loop;
      return (select count(*) from jsonb_object_keys(p_resp -> 'pairs')) = (select count(*) from jsonb_object_keys(p_key -> 'pairs'));
    else
      return null;   -- essay
  end case;
end;
$$;

/* Hitung ulang total skor percobaan dari jawaban yang sudah dinilai */
create or replace function public._finalize_attempt(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_score numeric; v_max numeric; v_manual boolean; v_thr numeric;
begin
  select coalesce(sum(points_awarded), 0), coalesce(sum(max_points), 0),
         bool_or(is_correct is null and graded_by is distinct from 'manual')
    into v_score, v_max, v_manual
    from attempt_answers where attempt_id = p_attempt;
  select coalesce((settings_snapshot ->> 'pass_threshold')::numeric, 0) into v_thr from quiz_attempts where id = p_attempt;
  update quiz_attempts
     set score = v_score, max_score = v_max,
         percent = case when v_max > 0 then round(v_score / v_max * 100, 1) else 0 end,
         passed = v_max > 0 and v_score / v_max * 100 >= v_thr,
         status = case when coalesce(v_manual, false) then 'submitted' else 'graded' end,
         finished_at = coalesce(finished_at, now())
   where id = p_attempt;
end;
$$;

revoke execute on function public._question_payload(uuid, jsonb), public._grade_response(text, jsonb, jsonb),
  public._finalize_attempt(uuid) from public, anon, authenticated;

-- ========== Fungsi untuk klien ==========
/* Mulai (atau lanjutkan) percobaan. Mengembalikan soal tanpa kunci. */
create or replace function public.start_quiz_attempt(p_quiz uuid, p_nickname text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quiz quizzes%rowtype;
  v_att quiz_attempts%rowtype;
  v_admin boolean := public.is_admin();
  v_reg boolean := public.is_registered();
  v_s jsonb;
  v_order uuid[];
  v_opts jsonb := '{}'::jsonb;
  v_q uuid;
  v_used int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_quiz from quizzes where id = p_quiz;
  if not found or (v_quiz.status <> 'published' and not v_admin) then raise exception 'QUIZ_NOT_FOUND'; end if;
  if v_quiz.mode = 'live_competition' then raise exception 'LIVE_ONLY'; end if;
  v_s := v_quiz.settings;
  if not v_reg and not coalesce((v_s ->> 'allow_guests')::boolean, false) then raise exception 'LOGIN_REQUIRED'; end if;

  -- Lanjutkan percobaan yang masih berjalan
  select * into v_att from quiz_attempts
   where quiz_id = p_quiz and user_id = auth.uid() and status = 'in_progress'
     and (deadline_at is null or deadline_at > now())
   order by started_at desc limit 1;
  if not found then
    select count(*) into v_used from quiz_attempts
     where quiz_id = p_quiz and user_id = auth.uid() and status <> 'in_progress' and not is_preview;
    if (v_s ->> 'attempts_allowed') is not null and v_used >= (v_s ->> 'attempts_allowed')::int and not v_admin then
      raise exception 'ATTEMPTS_EXHAUSTED';
    end if;
    select array_agg(question_id order by case when coalesce((v_s ->> 'shuffle_questions')::boolean, false) then random() else display_order end)
      into v_order from quiz_questions where quiz_id = p_quiz;
    if v_order is null then raise exception 'QUIZ_EMPTY'; end if;
    if coalesce((v_s ->> 'shuffle_options')::boolean, false) then
      foreach v_q in array v_order loop
        v_opts := v_opts || jsonb_build_object(v_q::text,
          (select coalesce(jsonb_agg(key order by random()), '[]'::jsonb) from question_options where question_id = v_q));
      end loop;
    end if;
    insert into quiz_attempts (quiz_id, user_id, is_guest, is_preview, nickname, deadline_at, question_order, option_order, settings_snapshot)
    values (p_quiz, auth.uid(), not v_reg, v_quiz.status <> 'published',
            left(nullif(trim(p_nickname), ''), 24),
            case when (v_s ->> 'time_limit_sec') is not null then now() + make_interval(secs => (v_s ->> 'time_limit_sec')::int) end,
            v_order, v_opts, v_s)
    returning * into v_att;
  end if;

  return jsonb_build_object(
    'attempt_id', v_att.id, 'started_at', v_att.started_at, 'deadline_at', v_att.deadline_at, 'server_now', now(),
    'quiz', jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'description', v_quiz.description, 'mode', v_quiz.mode,
                               'show_feedback', coalesce(v_s ->> 'show_feedback', 'after_submit')),
    'questions', (select jsonb_agg(public._question_payload(qid, v_att.option_order -> qid::text)
                                   || jsonb_build_object('points', (select points from quiz_questions where quiz_id = p_quiz and question_id = qid))
                                   order by ord)
                  from unnest(v_att.question_order) with ordinality u(qid, ord)));
end;
$$;

/* Latihan interaktif (show_feedback = after_each): cek satu jawaban tanpa menyelesaikan percobaan */
create or replace function public.check_practice_answer(p_attempt uuid, p_question uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_att quiz_attempts%rowtype; v_type text; v_key question_keys%rowtype;
begin
  select * into v_att from quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if coalesce(v_att.settings_snapshot ->> 'show_feedback', 'after_submit') <> 'after_each' then raise exception 'FEEDBACK_DISABLED'; end if;
  if not (p_question = any(v_att.question_order)) then raise exception 'QUESTION_NOT_IN_QUIZ'; end if;
  select type into v_type from questions where id = p_question;
  select * into v_key from question_keys where question_id = p_question;
  return jsonb_build_object('correct', public._grade_response(v_type, coalesce(v_key.answer, '{}'), p_response),
                            'answer', v_key.answer, 'explanation', v_key.explanation);
end;
$$;

/* Kirim semua jawaban: p_responses = {"<question_id>": <response>, ...}. Dinilai di server. */
create or replace function public.submit_quiz_attempt(p_attempt uuid, p_responses jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_att quiz_attempts%rowtype;
  v_late boolean;
  v_q uuid;
  v_type text;
  v_key jsonb;
  v_pts numeric;
  v_resp jsonb;
  v_ok boolean;
begin
  select * into v_att from quiz_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_att.status <> 'in_progress' then raise exception 'ALREADY_SUBMITTED'; end if;
  -- Toleransi 60 detik untuk jeda jaringan; lewat dari itu jawaban diabaikan
  v_late := v_att.deadline_at is not null and now() > v_att.deadline_at + interval '60 seconds';
  foreach v_q in array v_att.question_order loop
    select q.type, coalesce(k.answer, '{}'::jsonb) into v_type, v_key
      from questions q left join question_keys k on k.question_id = q.id where q.id = v_q;
    select points into v_pts from quiz_questions where quiz_id = v_att.quiz_id and question_id = v_q;
    v_resp := case when v_late then null else p_responses -> v_q::text end;
    v_ok := public._grade_response(v_type, v_key, v_resp);
    insert into attempt_answers (attempt_id, question_id, question_snapshot, response, is_correct, points_awarded, max_points, graded_at, graded_by)
    values (p_attempt, v_q, public._question_payload(v_q, v_att.option_order -> v_q::text), v_resp, v_ok,
            case when v_ok then coalesce(v_pts, 1) else 0 end, coalesce(v_pts, 1),
            case when v_ok is not null then now() end, case when v_ok is not null then 'auto' end)
    on conflict (attempt_id, question_id) do nothing;
  end loop;
  update quiz_attempts set late = v_late, finished_at = now() where id = p_attempt;
  perform public._finalize_attempt(p_attempt);
  return public.get_attempt_result(p_attempt);
end;
$$;

/* Hasil percobaan untuk pemilik atau admin; kunci & pembahasan sesuai show_feedback */
create or replace function public.get_attempt_result(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_att quiz_attempts%rowtype; v_reveal boolean; v_title text;
begin
  select * into v_att from quiz_attempts where id = p_attempt and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_att.status = 'in_progress' then raise exception 'NOT_SUBMITTED'; end if;
  v_reveal := public.is_admin() or coalesce(v_att.settings_snapshot ->> 'show_feedback', 'after_submit') <> 'never';
  select title into v_title from quizzes where id = v_att.quiz_id;
  return jsonb_build_object(
    'attempt_id', v_att.id, 'quiz_id', v_att.quiz_id, 'quiz_title', v_title, 'status', v_att.status,
    'score', v_att.score, 'max_score', v_att.max_score, 'percent', v_att.percent, 'passed', v_att.passed,
    'late', v_att.late, 'started_at', v_att.started_at, 'finished_at', v_att.finished_at, 'feedback', v_reveal,
    'items', (select jsonb_agg(jsonb_build_object(
                'question', a.question_snapshot, 'response', a.response, 'is_correct', a.is_correct,
                'points', a.points_awarded, 'max_points', a.max_points,
                'answer', case when v_reveal then k.answer end,
                'explanation', case when v_reveal then k.explanation end)
              order by array_position(v_att.question_order, a.question_id))
              from attempt_answers a left join question_keys k on k.question_id = a.question_id
              where a.attempt_id = p_attempt));
end;
$$;

/* Penilaian manual (esai/jawaban singkat) oleh admin */
create or replace function public.grade_attempt_answer(p_answer uuid, p_points numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_att uuid; v_max numeric;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  select attempt_id, max_points into v_att, v_max from attempt_answers where id = p_answer;
  if v_att is null then raise exception 'ANSWER_NOT_FOUND'; end if;
  if p_points < 0 or p_points > v_max then raise exception 'BAD_POINTS'; end if;
  update attempt_answers set points_awarded = p_points, is_correct = p_points >= v_max,
         graded_at = now(), graded_by = 'manual' where id = p_answer;
  perform public._finalize_attempt(v_att);
end;
$$;

revoke execute on function public.start_quiz_attempt(uuid, text), public.check_practice_answer(uuid, uuid, jsonb),
  public.submit_quiz_attempt(uuid, jsonb), public.get_attempt_result(uuid), public.grade_attempt_answer(uuid, numeric)
  from public, anon;
grant execute on function public.start_quiz_attempt(uuid, text), public.check_practice_answer(uuid, uuid, jsonb),
  public.submit_quiz_attempt(uuid, jsonb), public.get_attempt_result(uuid), public.grade_attempt_answer(uuid, numeric)
  to authenticated;

do $$
declare t text;
begin
  foreach t in array array['questions', 'quizzes'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
