/*
  0300 · Sesi kuis live dengan kode (guest quiz).

  Prinsip keamanan
  - Peserta (tamu = login anonim, atau pengguna terdaftar) bergabung lewat join_quiz_session; satu akun
    satu peserta per sesi, sehingga bergabung ulang memulihkan peserta yang sama (FR-60).
  - Tidak ada tulis langsung ke tabel sesi/peserta/jawaban. Jawaban dinilai di server dengan waktu
    dari server (question_started_at), bukan waktu kiriman peserta.
  - Kode sesi tidak bisa didaftar publik: sesi hanya terlihat oleh host/admin dan pesertanya.
*/

create table if not exists public.quiz_sessions (
  id                    uuid primary key default gen_random_uuid(),
  quiz_id               uuid not null references public.quizzes(id) on delete cascade,
  code                  text not null unique,
  status                text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  phase                 text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'ended')),
  host_id               uuid references auth.users(id) on delete set null,
  allow_guests          boolean not null default true,
  max_participants      int check (max_participants is null or max_participants > 0),
  show_leaderboard      boolean not null default true,
  question_order        uuid[] not null,
  question_time_sec     int not null default 30 check (question_time_sec between 5 and 600),
  current_question_index int not null default -1,
  question_started_at   timestamptz,
  started_at            timestamptz,
  ended_at              timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists sessions_quiz_idx on public.quiz_sessions(quiz_id);

create table if not exists public.quiz_participants (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  nickname       text not null check (char_length(nickname) between 1 and 24),
  is_guest       boolean not null default true,
  score          numeric not null default 0,
  correct_count  int not null default 0,
  answered_count int not null default 0,
  streak         int not null default 0,
  joined_at      timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, nickname)
);
create index if not exists participants_session_idx on public.quiz_participants(session_id);

create table if not exists public.live_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.quiz_sessions(id) on delete cascade,
  participant_id uuid not null references public.quiz_participants(id) on delete cascade,
  question_index int not null,
  question_id    uuid not null references public.questions(id) on delete restrict,
  response       jsonb,
  is_correct     boolean,
  points_awarded numeric not null default 0,
  time_ms        int not null,
  created_at     timestamptz not null default now(),
  unique (session_id, participant_id, question_index)
);
create index if not exists la_session_idx on public.live_answers(session_id, question_index);

-- ========== Pembantu RLS ==========
create or replace function public.is_session_host(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from quiz_sessions where id = p_session and host_id = auth.uid());
$$;
create or replace function public.is_session_participant(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from quiz_participants where session_id = p_session and user_id = auth.uid());
$$;
revoke execute on function public.is_session_host(uuid), public.is_session_participant(uuid) from public, anon;
grant execute on function public.is_session_host(uuid), public.is_session_participant(uuid) to authenticated;

alter table public.quiz_sessions     enable row level security;
alter table public.quiz_participants enable row level security;
alter table public.live_answers      enable row level security;
revoke all on public.quiz_sessions, public.quiz_participants, public.live_answers from anon, authenticated;
grant select on public.quiz_sessions, public.quiz_participants, public.live_answers to authenticated;

drop policy if exists sessions_select on public.quiz_sessions;
create policy sessions_select on public.quiz_sessions for select to authenticated
  using (public.is_session_host(id) or public.is_session_participant(id));
drop policy if exists participants_select on public.quiz_participants;
create policy participants_select on public.quiz_participants for select to authenticated
  using (public.is_session_host(session_id) or public.is_session_participant(session_id));
drop policy if exists la_select on public.live_answers;
create policy la_select on public.live_answers for select to authenticated
  using (public.is_session_host(session_id)
         or exists (select 1 from quiz_participants p where p.id = participant_id and p.user_id = auth.uid()));

-- ========== Fungsi ==========
/* FR-48/49: admin membuat sesi; kode 6 karakter tanpa huruf/angka yang mirip */
create or replace function public.create_quiz_session(p_quiz uuid, p_settings jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_quiz quizzes%rowtype;
  v_order uuid[];
  v_id uuid;
  b bytea;
  i int;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  select * into v_quiz from quizzes where id = p_quiz and status <> 'archived';
  if not found then raise exception 'QUIZ_NOT_FOUND'; end if;
  select array_agg(question_id order by case when coalesce((v_quiz.settings ->> 'shuffle_questions')::boolean, false) then random() else display_order end)
    into v_order from quiz_questions where quiz_id = p_quiz;
  if v_order is null then raise exception 'QUIZ_EMPTY'; end if;
  loop
    b := gen_random_bytes(6); v_code := '';
    for i in 0..5 loop v_code := v_code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from quiz_sessions where code = v_code);
  end loop;
  insert into quiz_sessions (quiz_id, code, host_id, allow_guests, max_participants, show_leaderboard, question_order, question_time_sec)
  values (p_quiz, v_code, auth.uid(),
          coalesce((p_settings ->> 'allow_guests')::boolean, (v_quiz.settings ->> 'allow_guests')::boolean, true),
          nullif(p_settings ->> 'max_participants', '')::int,
          coalesce((p_settings ->> 'show_leaderboard')::boolean, (v_quiz.settings ->> 'show_leaderboard')::boolean, true),
          v_order,
          coalesce((p_settings ->> 'question_time_sec')::int, (v_quiz.settings ->> 'question_time_sec')::int, 30))
  returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'code', v_code);
end;
$$;

/* FR-50/51/60: bergabung (atau bergabung ulang) dengan kode dan nama tampilan */
create or replace function public.join_quiz_session(p_code text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s quiz_sessions%rowtype;
  v_p quiz_participants%rowtype;
  v_nick text := left(regexp_replace(trim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), 24);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_s from quiz_sessions where code = upper(trim(p_code));
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into v_p from quiz_participants where session_id = v_s.id and user_id = auth.uid();
  if found then
    update quiz_participants set last_seen_at = now() where id = v_p.id;
    return jsonb_build_object('session_id', v_s.id, 'participant_id', v_p.id, 'nickname', v_p.nickname, 'rejoined', true);
  end if;
  if v_s.status in ('completed', 'cancelled') then raise exception 'SESSION_CLOSED'; end if;
  if not v_s.allow_guests and not public.is_registered() then raise exception 'LOGIN_REQUIRED'; end if;
  if char_length(v_nick) < 1 then raise exception 'NICKNAME_REQUIRED'; end if;
  if v_s.max_participants is not null
     and (select count(*) from quiz_participants where session_id = v_s.id) >= v_s.max_participants then
    raise exception 'SESSION_FULL';
  end if;
  if exists (select 1 from quiz_participants where session_id = v_s.id and lower(nickname) = lower(v_nick)) then
    raise exception 'NICKNAME_TAKEN';
  end if;
  insert into quiz_participants (session_id, user_id, nickname, is_guest)
  values (v_s.id, auth.uid(), v_nick, not public.is_registered())
  returning * into v_p;
  return jsonb_build_object('session_id', v_s.id, 'participant_id', v_p.id, 'nickname', v_p.nickname, 'rejoined', false);
end;
$$;

/* FR-53: kontrol host. p_action: start | reveal | next | end | cancel */
create or replace function public.host_session_action(p_session uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s quiz_sessions%rowtype; v_n int;
begin
  if not public.is_session_host(p_session) then raise exception 'NOT_HOST'; end if;
  select * into v_s from quiz_sessions where id = p_session for update;
  v_n := coalesce(array_length(v_s.question_order, 1), 0);
  if v_s.status in ('completed', 'cancelled') then raise exception 'SESSION_CLOSED'; end if;
  case p_action
    when 'start' then
      if v_s.status <> 'waiting' then raise exception 'ALREADY_STARTED'; end if;
      update quiz_sessions set status = 'active', phase = 'question', current_question_index = 0,
             question_started_at = now(), started_at = now() where id = p_session;
    when 'reveal' then
      if v_s.phase <> 'question' then raise exception 'BAD_PHASE'; end if;
      update quiz_sessions set phase = 'reveal' where id = p_session;
    when 'next' then
      if v_s.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
      if v_s.current_question_index + 1 >= v_n then
        update quiz_sessions set status = 'completed', phase = 'ended', ended_at = now() where id = p_session;
      else
        update quiz_sessions set phase = 'question', current_question_index = current_question_index + 1,
               question_started_at = now() where id = p_session;
      end if;
    when 'end' then
      update quiz_sessions set status = 'completed', phase = 'ended', ended_at = now() where id = p_session;
    when 'cancel' then
      update quiz_sessions set status = 'cancelled', phase = 'ended', ended_at = now() where id = p_session;
    else raise exception 'BAD_ACTION';
  end case;
  return public.get_session_state(p_session);
end;
$$;

/* FR-54: keadaan sesi untuk host dan peserta (soal tanpa kunci; kunci hanya saat reveal/ended) */
create or replace function public.get_session_state(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s quiz_sessions%rowtype;
  v_host boolean := public.is_session_host(p_session);
  v_me quiz_participants%rowtype;
  v_q uuid;
  v_board jsonb;
begin
  select * into v_s from quiz_sessions where id = p_session;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into v_me from quiz_participants where session_id = p_session and user_id = auth.uid();
  if not v_host and v_me.id is null then raise exception 'NOT_JOINED'; end if;
  if v_me.id is not null then update quiz_participants set last_seen_at = now() where id = v_me.id; end if;
  v_q := case when v_s.current_question_index >= 0 then v_s.question_order[v_s.current_question_index + 1] end;
  if v_s.show_leaderboard or v_host then
    select jsonb_agg(jsonb_build_object('nickname', nickname, 'score', score, 'correct', correct_count, 'me', user_id = auth.uid())
                     order by score desc, joined_at)
      into v_board
      from (select * from quiz_participants where session_id = p_session order by score desc, joined_at limit 50) t;
  end if;
  return jsonb_build_object(
    'session_id', v_s.id, 'code', case when v_host then v_s.code end, 'status', v_s.status, 'phase', v_s.phase,
    'quiz_title', (select title from quizzes where id = v_s.quiz_id),
    'index', v_s.current_question_index, 'count', coalesce(array_length(v_s.question_order, 1), 0),
    'question_time_sec', v_s.question_time_sec, 'question_started_at', v_s.question_started_at, 'server_now', now(),
    'question', case when v_q is not null and v_s.phase in ('question', 'reveal') then public._question_payload(v_q) end,
    'answer', case when v_q is not null and v_s.phase = 'reveal' then (select answer from question_keys where question_id = v_q) end,
    'explanation', case when v_q is not null and v_s.phase = 'reveal' then (select explanation from question_keys where question_id = v_q) end,
    'answered', (select count(*) from live_answers where session_id = p_session and question_index = v_s.current_question_index),
    'participants', (select count(*) from quiz_participants where session_id = p_session),
    'me', case when v_me.id is not null then jsonb_build_object(
            'participant_id', v_me.id, 'nickname', v_me.nickname, 'score', v_me.score, 'correct', v_me.correct_count,
            'answered_current', exists (select 1 from live_answers where participant_id = v_me.id and question_index = v_s.current_question_index),
            'last', (select jsonb_build_object('is_correct', is_correct, 'points', points_awarded)
                       from live_answers where participant_id = v_me.id and question_index = v_s.current_question_index
                       and v_s.phase <> 'question')) end,
    'leaderboard', v_board);
end;
$$;

/* FR-55/56: kirim jawaban untuk soal yang sedang berjalan; poin = bobot × (1000 − 500 × waktu/batas) */
create or replace function public.submit_live_answer(p_session uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s quiz_sessions%rowtype;
  v_p quiz_participants%rowtype;
  v_q uuid;
  v_type text;
  v_key jsonb;
  v_w numeric;
  v_ms int;
  v_ok boolean;
  v_pts numeric := 0;
begin
  select * into v_s from quiz_sessions where id = p_session;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into v_p from quiz_participants where session_id = p_session and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_JOINED'; end if;
  if v_s.status <> 'active' or v_s.phase <> 'question' then raise exception 'NOT_ACCEPTING'; end if;
  v_ms := greatest(0, round(extract(epoch from (now() - v_s.question_started_at)) * 1000))::int;
  if v_ms > v_s.question_time_sec * 1000 + 1500 then raise exception 'TIME_UP'; end if;   -- toleransi jaringan
  if exists (select 1 from live_answers where participant_id = v_p.id and question_index = v_s.current_question_index) then
    raise exception 'ALREADY_ANSWERED';
  end if;
  v_q := v_s.question_order[v_s.current_question_index + 1];
  select q.type, coalesce(k.answer, '{}'::jsonb) into v_type, v_key
    from questions q left join question_keys k on k.question_id = q.id where q.id = v_q;
  select points into v_w from quiz_questions where quiz_id = v_s.quiz_id and question_id = v_q;
  v_ok := public._grade_response(v_type, v_key, p_response);
  if v_ok then
    v_pts := round(coalesce(v_w, 1) * (1000 - 500 * least(v_ms, v_s.question_time_sec * 1000)::numeric / (v_s.question_time_sec * 1000)));
  end if;
  insert into live_answers (session_id, participant_id, question_index, question_id, response, is_correct, points_awarded, time_ms)
  values (p_session, v_p.id, v_s.current_question_index, v_q, p_response, v_ok, v_pts, v_ms);
  update quiz_participants
     set score = score + v_pts, answered_count = answered_count + 1,
         correct_count = correct_count + case when v_ok then 1 else 0 end,
         streak = case when v_ok then streak + 1 else 0 end, last_seen_at = now()
   where id = v_p.id;
  return jsonb_build_object('received', true, 'time_ms', v_ms);
end;
$$;

/* FR-59: hasil lengkap untuk host/admin (untuk tabel & CSV) */
create or replace function public.get_session_results(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_session_host(p_session) then raise exception 'NOT_HOST'; end if;
  return jsonb_build_object(
    'session', (select to_jsonb(s) - 'question_order' from quiz_sessions s where id = p_session),
    'participants', (select coalesce(jsonb_agg(jsonb_build_object(
        'participant_id', p.id, 'nickname', p.nickname, 'is_guest', p.is_guest,
        'email', (select email from profiles where id = p.user_id),
        'score', p.score, 'correct', p.correct_count, 'answered', p.answered_count, 'joined_at', p.joined_at)
        order by p.score desc, p.joined_at), '[]'::jsonb)
      from quiz_participants p where p.session_id = p_session),
    'per_question', (select coalesce(jsonb_agg(jsonb_build_object(
        'index', i - 1, 'question_id', qid,
        'answered', (select count(*) from live_answers where session_id = p_session and question_index = i - 1),
        'correct', (select count(*) from live_answers where session_id = p_session and question_index = i - 1 and is_correct))
        order by i), '[]'::jsonb)
      from unnest((select question_order from quiz_sessions where id = p_session)) with ordinality u(qid, i)));
end;
$$;

revoke execute on function public.create_quiz_session(uuid, jsonb), public.join_quiz_session(text, text),
  public.host_session_action(uuid, text), public.get_session_state(uuid), public.submit_live_answer(uuid, jsonb),
  public.get_session_results(uuid) from public, anon;
grant execute on function public.create_quiz_session(uuid, jsonb), public.join_quiz_session(text, text),
  public.host_session_action(uuid, text), public.get_session_state(uuid), public.submit_live_answer(uuid, jsonb),
  public.get_session_results(uuid) to authenticated;

-- ========== Realtime (RLS tetap berlaku) ==========
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['quiz_sessions', 'quiz_participants'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
