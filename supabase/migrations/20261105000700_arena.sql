/*
  0700 · Arena: kuis gaya Kahoot melawan bot, per kuis atau acak per mata kuliah.

  - Hanya untuk pengguna terdaftar (bukan tamu). Tidak bergantung pada tingkat akses materi/kuis,
    karena Arena adalah pintu masuk; PEMBAHASAN tetap khusus pelanggan (lihat 0600).
  - Soal yang cocok: pilihan tunggal dengan 2–4 opsi dan benar/salah, berstatus terpublikasi.
    Soal tingkat "hard" (HOTS dari mesin materi) diberi waktu 40 detik dan poin ganda; lainnya 20 detik.
  - Soal dikirim satu per satu (arena_next) dan waktu menjawab diukur di server: soal dibuka 3 detik
    setelah dikirim (jeda intro), jawaban sebelum itu ditolak. Skor sama dengan mesin materi:
    poin = round((1 − waktu/batas/2) × 1000) × (2 bila HOTS), bonus beruntun min(beruntun − 1, 5) × 100.
  - Bot disimulasikan di browser; yang disimpan hanya permainan pengguna. Hasil masuk statistik kuis
    (quiz_stats) dan riwayat pengguna.
*/

-- ========== Tabel ==========
create table if not exists public.arena_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  quiz_id        uuid references public.quizzes(id) on delete cascade,
  course_id      uuid references public.courses(id) on delete cascade,
  is_preview     boolean not null default false,   -- kuis/mata kuliah draf yang dimainkan admin
  status         text not null default 'in_progress' check (status in ('in_progress', 'finished', 'abandoned')),
  question_order uuid[] not null,
  option_order   jsonb not null default '{}'::jsonb,
  current_index  int not null default -1,          -- soal yang sedang/terakhir dikirim (mulai 0)
  served_at      timestamptz,                      -- saat soal current_index mulai bisa dijawab
  score          int not null default 0,
  correct        int not null default 0,
  streak         int not null default 0,
  best_streak    int not null default 0,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  check (num_nonnulls(quiz_id, course_id) = 1)
);
create index if not exists arena_runs_user_idx on public.arena_runs(user_id, started_at desc);
create index if not exists arena_runs_quiz_idx on public.arena_runs(quiz_id) where quiz_id is not null;
create index if not exists arena_runs_course_idx on public.arena_runs(course_id) where course_id is not null;

create table if not exists public.arena_answers (
  run_id         uuid not null references public.arena_runs(id) on delete cascade,
  question_index int not null,
  question_id    uuid not null references public.questions(id) on delete restrict,
  response       jsonb,              -- null = waktu habis
  is_correct     boolean not null,
  time_ms        int,                -- null = waktu habis
  points         int not null default 0,
  answered_at    timestamptz not null default now(),
  primary key (run_id, question_index)
);
create index if not exists arena_answers_question_idx on public.arena_answers(question_id);

alter table public.arena_runs enable row level security;
alter table public.arena_answers enable row level security;
revoke all on public.arena_runs, public.arena_answers from anon, authenticated;
grant select on public.arena_runs to authenticated;
drop policy if exists arena_runs_self_or_admin on public.arena_runs;
create policy arena_runs_self_or_admin on public.arena_runs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
/* Jawaban hanya lewat arena_result (memuat kunci sesuai aturan); admin boleh membaca langsung */
grant select on public.arena_answers to authenticated;
drop policy if exists arena_answers_admin on public.arena_answers;
create policy arena_answers_admin on public.arena_answers
  for select to authenticated using (public.is_admin());

-- ========== Pembantu ==========
create or replace function public._arena_eligible(p_question uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from questions q where q.id = p_question and q.status = 'published'
       and (q.type = 'true_false'
            or (q.type = 'single_choice' and (select count(*) from question_options o where o.question_id = q.id) between 2 and 4)));
$$;

/* Batas waktu per soal (detik) */
create or replace function public._arena_time(p_question uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when (select difficulty from questions where id = p_question) = 'hard' then 40 else 20 end;
$$;

revoke execute on function public._arena_eligible(uuid), public._arena_time(uuid) from public, anon, authenticated;

-- ========== Fungsi untuk klien ==========
/* Mulai permainan. p_count: jumlah soal (5–50); null = semua soal yang cocok (maks. 50). */
create or replace function public.arena_start(p_quiz uuid default null, p_course uuid default null, p_count int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.is_admin();
  v_n int := least(greatest(coalesce(p_count, 50), 5), 50);
  v_title text;
  v_status text;
  v_order uuid[];
  v_opts jsonb := '{}'::jsonb;
  v_q uuid;
  v_run arena_runs%rowtype;
begin
  if not public.is_registered() or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'LOGIN_REQUIRED';
  end if;
  if (p_quiz is null) = (p_course is null) then raise exception 'BAD_ARENA: pilih satu kuis atau satu mata kuliah'; end if;

  if p_quiz is not null then
    select title, status into v_title, v_status from quizzes where id = p_quiz;
    if not found or (v_status <> 'published' and not v_admin) then raise exception 'QUIZ_NOT_FOUND'; end if;
    select array_agg(id) into v_order from (
      select qq.question_id as id from quiz_questions qq
       where qq.quiz_id = p_quiz and public._arena_eligible(qq.question_id)
       order by random() limit v_n) t;
  else
    select title, status into v_title, v_status from courses where id = p_course;
    if not found or (v_status <> 'published' and not v_admin) then raise exception 'COURSE_NOT_FOUND'; end if;
    select array_agg(id) into v_order from (
      select id from (
        select distinct q.id from questions q
          join question_materials qm on qm.question_id = q.id
          join materials m on m.id = qm.material_id
         where m.course_id = p_course and (m.status = 'published' or v_admin) and public._arena_eligible(q.id)) d
       order by random() limit v_n) t;
  end if;
  if v_order is null then raise exception 'ARENA_EMPTY'; end if;

  foreach v_q in array v_order loop
    v_opts := v_opts || jsonb_build_object(v_q::text,
      (select coalesce(jsonb_agg(key order by random()), '[]'::jsonb) from question_options where question_id = v_q));
  end loop;

  /* Satu permainan berjalan per pengguna: yang lama dianggap ditinggalkan */
  update arena_runs set status = 'abandoned', finished_at = now() where user_id = auth.uid() and status = 'in_progress';
  insert into arena_runs (user_id, quiz_id, course_id, is_preview, question_order, option_order)
  values (auth.uid(), p_quiz, p_course, v_status <> 'published', v_order, v_opts)
  returning * into v_run;

  return jsonb_build_object('run_id', v_run.id, 'title', v_title, 'count', array_length(v_order, 1));
end;
$$;

/* Kirim soal berikutnya (atau soal yang sedang berjalan bila halaman dimuat ulang) */
create or replace function public.arena_next(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r arena_runs%rowtype; v_q uuid; v_t int;
begin
  select * into v_r from arena_runs where id = p_run and user_id = auth.uid() for update;
  if not found then raise exception 'ARENA_NOT_FOUND'; end if;
  if v_r.status <> 'in_progress' then raise exception 'ARENA_FINISHED'; end if;
  if v_r.current_index < 0 or exists (select 1 from arena_answers where run_id = p_run and question_index = v_r.current_index) then
    if v_r.current_index + 1 >= array_length(v_r.question_order, 1) then raise exception 'ARENA_FINISHED'; end if;
    update arena_runs set current_index = current_index + 1, served_at = now() + interval '3 seconds'
     where id = p_run returning * into v_r;
  end if;
  v_q := v_r.question_order[v_r.current_index + 1];
  v_t := public._arena_time(v_q);
  return jsonb_build_object(
    'index', v_r.current_index, 'count', array_length(v_r.question_order, 1),
    'time_sec', v_t, 'hots', v_t > 20,
    'opens_at', v_r.served_at, 'server_now', now(),
    'score', v_r.score, 'streak', v_r.streak,
    'question', public._question_payload(v_q, v_r.option_order -> v_q::text));
end;
$$;

/* Jawab soal yang sedang berjalan; p_response null = waktu habis. Dinilai dan diberi poin di server. */
create or replace function public.arena_answer(p_run uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_r arena_runs%rowtype;
  v_q uuid;
  v_type text;
  v_key question_keys%rowtype;
  v_t int;
  v_ms int;
  v_timeout boolean;
  v_ok boolean;
  v_streak int := 0;
  v_base int := 0;
  v_bonus int := 0;
  v_last boolean;
  v_exp boolean := public._can_see_explanations(auth.uid());
begin
  select * into v_r from arena_runs where id = p_run and user_id = auth.uid() for update;
  if not found then raise exception 'ARENA_NOT_FOUND'; end if;
  if v_r.status <> 'in_progress' then raise exception 'ARENA_FINISHED'; end if;
  if v_r.current_index < 0 or now() < v_r.served_at - interval '250 milliseconds' then raise exception 'NOT_ACCEPTING'; end if;
  if exists (select 1 from arena_answers where run_id = p_run and question_index = v_r.current_index) then
    raise exception 'ALREADY_ANSWERED';
  end if;

  v_q := v_r.question_order[v_r.current_index + 1];
  select type into v_type from questions where id = v_q;
  select * into v_key from question_keys where question_id = v_q;
  v_t := public._arena_time(v_q);
  v_ms := greatest(0, round(extract(epoch from now() - v_r.served_at) * 1000))::int;
  /* Toleransi 1,5 detik untuk jeda jaringan */
  v_timeout := p_response is null or p_response = 'null'::jsonb or v_ms > v_t * 1000 + 1500;
  v_ms := least(v_ms, v_t * 1000);
  v_ok := not v_timeout and coalesce(public._grade_response(v_type, coalesce(v_key.answer, '{}'::jsonb), p_response), false);
  if v_ok then
    v_streak := v_r.streak + 1;
    v_base := round((1 - (v_ms::numeric / (v_t * 1000)) / 2) * 1000)::int * case when v_t > 20 then 2 else 1 end;
    v_bonus := case when v_streak > 1 then least(v_streak - 1, 5) * 100 else 0 end;
  end if;

  insert into arena_answers (run_id, question_index, question_id, response, is_correct, time_ms, points)
  values (p_run, v_r.current_index, v_q, case when v_timeout then null else p_response end, v_ok,
          case when v_timeout then null else v_ms end, v_base + v_bonus);
  v_last := v_r.current_index + 1 >= array_length(v_r.question_order, 1);
  update arena_runs
     set score = score + v_base + v_bonus, correct = correct + case when v_ok then 1 else 0 end,
         streak = v_streak, best_streak = greatest(best_streak, v_streak),
         status = case when v_last then 'finished' else status end,
         finished_at = case when v_last then now() else finished_at end
   where id = p_run returning * into v_r;

  return jsonb_build_object(
    'correct', v_ok, 'timeout', v_timeout, 'time_ms', case when v_timeout then null else v_ms end,
    'base', v_base, 'bonus', v_bonus, 'points', v_base + v_bonus, 'streak', v_streak,
    'score', v_r.score, 'correct_count', v_r.correct, 'finished', v_last,
    'answer', v_key.answer,
    'explanation', case when v_exp then v_key.explanation end,
    'explanation_locked', not v_exp and coalesce(v_key.explanation, '') <> '');
end;
$$;

/* Hasil permainan untuk pemiliknya atau admin; pembahasan khusus pelanggan */
create or replace function public.arena_result(p_run uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_r arena_runs%rowtype; v_exp boolean := public._can_see_explanations(auth.uid());
begin
  select * into v_r from arena_runs where id = p_run and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'ARENA_NOT_FOUND'; end if;
  return jsonb_build_object(
    'run_id', v_r.id, 'status', v_r.status, 'quiz_id', v_r.quiz_id, 'course_id', v_r.course_id,
    'course_slug', (select slug from courses where id = v_r.course_id),
    'title', coalesce((select title from quizzes where id = v_r.quiz_id), (select title from courses where id = v_r.course_id)),
    'score', v_r.score, 'correct', v_r.correct, 'count', array_length(v_r.question_order, 1),
    'answered', (select count(*) from arena_answers where run_id = p_run),
    'best_streak', v_r.best_streak, 'started_at', v_r.started_at, 'finished_at', v_r.finished_at,
    'explanations', v_exp,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'question', public._question_payload(a.question_id, v_r.option_order -> a.question_id::text),
                'response', a.response, 'is_correct', a.is_correct, 'time_ms', a.time_ms, 'points', a.points,
                'answer', k.answer,
                'explanation', case when v_exp then k.explanation end,
                'explanation_locked', not v_exp and coalesce(k.explanation, '') <> '')
              order by a.question_index), '[]'::jsonb)
              from arena_answers a left join question_keys k on k.question_id = a.question_id
              where a.run_id = p_run));
end;
$$;

/* Mata kuliah yang bisa dimainkan di Arena, beserta jumlah soal yang cocok */
create or replace function public.arena_courses()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'title', title, 'question_count', n) order by display_order, title), '[]'::jsonb)
  from (
    select c.id, c.slug, c.title, c.display_order,
           (select count(distinct q.id) from questions q
              join question_materials qm on qm.question_id = q.id
              join materials m on m.id = qm.material_id
             where m.course_id = c.id and m.status = 'published' and public._arena_eligible(q.id)) as n
      from courses c where c.status = 'published') t
  where n > 0;
$$;

revoke execute on function public.arena_start(uuid, uuid, int), public.arena_next(uuid), public.arena_answer(uuid, jsonb),
  public.arena_result(uuid) from public, anon;
grant execute on function public.arena_start(uuid, uuid, int), public.arena_next(uuid), public.arena_answer(uuid, jsonb),
  public.arena_result(uuid) to authenticated;
revoke execute on function public.arena_courses() from public;
grant execute on function public.arena_courses() to anon, authenticated;

-- ========== Halaman & katalog kuis: tingkat akses (0600) dan jumlah soal Arena ==========
create or replace function public.quiz_access(p_quiz uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'level', public._quiz_access_level(p_quiz),
    'can_take', public._can_take_quiz(p_quiz, auth.uid()),
    'explanations', public._can_see_explanations(auth.uid()),
    'arena_count', (select count(*) from quiz_questions qq where qq.quiz_id = p_quiz and public._arena_eligible(qq.question_id)))
  where exists (select 1 from quizzes where id = p_quiz and (status = 'published' or public.is_admin()));
$$;

create or replace function public.list_public_quizzes(p_material uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x ->> 'title'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', z.id, 'title', z.title, 'description', z.description, 'mode', z.mode, 'updated_at', z.updated_at,
      'allow_guests', coalesce((z.settings ->> 'allow_guests')::boolean, false),
      'time_limit_sec', (z.settings ->> 'time_limit_sec')::int,
      'attempts_allowed', (z.settings ->> 'attempts_allowed')::int,
      'access_level', public._quiz_access_level(z.id),
      'can_take', public._can_take_quiz(z.id, auth.uid()),
      'question_count', (select count(*) from quiz_questions where quiz_id = z.id),
      'arena_count', (select count(*) from quiz_questions qq where qq.quiz_id = z.id and public._arena_eligible(qq.question_id)),
      'materials', (select coalesce(jsonb_agg(distinct jsonb_build_object('title', m.title, 'slug', m.slug, 'course_slug', c.slug)), '[]'::jsonb)
                      from quiz_questions qq join question_materials qm on qm.question_id = qq.question_id
                      join materials m on m.id = qm.material_id join courses c on c.id = m.course_id
                     where qq.quiz_id = z.id and m.status = 'published' and c.status = 'published')) as x
    from quizzes z
    where z.status = 'published'
      and (p_material is null or exists (select 1 from quiz_questions qq join question_materials qm on qm.question_id = qq.question_id
                                         where qq.quiz_id = z.id and qm.material_id = p_material))) t;
$$;
revoke execute on function public.list_public_quizzes(uuid) from public;
grant execute on function public.list_public_quizzes(uuid) to anon, authenticated;

-- ========== Statistik kuis: kuis mandiri + Arena ==========
create or replace function public.quiz_stats(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'attempts', (select count(*) from quiz_attempts where quiz_id = p_quiz and not is_preview),
    'finished', (select count(*) from quiz_attempts where quiz_id = p_quiz and not is_preview and status <> 'in_progress'),
    'participants', (select count(distinct user_id) from quiz_attempts where quiz_id = p_quiz and not is_preview),
    'guests', (select count(distinct user_id) from quiz_attempts where quiz_id = p_quiz and not is_preview and is_guest),
    'avg_percent', (select round(avg(percent), 1) from quiz_attempts where quiz_id = p_quiz and not is_preview and status <> 'in_progress'),
    'pass_rate', (select round(100.0 * avg(case when passed then 1 else 0 end), 1) from quiz_attempts
                   where quiz_id = p_quiz and not is_preview and status <> 'in_progress'),
    'arena', (select jsonb_build_object(
                'runs', count(*),
                'players', count(distinct user_id),
                'avg_accuracy', round(avg(100.0 * correct / nullif(array_length(question_order, 1), 0)), 1),
                'avg_score', round(avg(score)),
                'best_score', max(score))
              from arena_runs where quiz_id = p_quiz and not is_preview and status = 'finished'),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', qq.question_id, 'prompt', q.prompt, 'type', q.type, 'points', qq.points,
        'answered', (select count(*) from attempt_answers a join quiz_attempts t on t.id = a.attempt_id
                     where t.quiz_id = p_quiz and not t.is_preview and a.question_id = qq.question_id and a.response is not null),
        'correct', (select count(*) from attempt_answers a join quiz_attempts t on t.id = a.attempt_id
                    where t.quiz_id = p_quiz and not t.is_preview and a.question_id = qq.question_id and a.is_correct),
        'arena_answered', (select count(*) from arena_answers a join arena_runs r on r.id = a.run_id
                           where r.quiz_id = p_quiz and not r.is_preview and a.question_id = qq.question_id),
        'arena_correct', (select count(*) from arena_answers a join arena_runs r on r.id = a.run_id
                          where r.quiz_id = p_quiz and not r.is_preview and a.question_id = qq.question_id and a.is_correct))
        order by qq.display_order), '[]'::jsonb)
      from quiz_questions qq join questions q on q.id = qq.question_id where qq.quiz_id = p_quiz));
end;
$$;
