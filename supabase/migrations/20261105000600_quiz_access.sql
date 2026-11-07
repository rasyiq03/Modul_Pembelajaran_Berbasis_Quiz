/*
  0600 · Akses kuis mengikuti tingkat akses materi, dan pembahasan khusus pelanggan.

  - quizzes.access_level: null = ikuti materi (bawaan), atau public/member/subscriber untuk menimpa.
    Tingkat efektif kuis yang mengikuti materi = tingkat PALING KETAT di antara materi soal-soalnya;
    kuis tanpa materi terkait = public.
  - Kuis mandiri (start_quiz_attempt) hanya bisa dimulai sesuai tingkat itu. Tamu tetap butuh
    settings.allow_guests, dan hanya untuk kuis berlevel public.
  - Kunci jawaban tetap tampil sesuai show_feedback. PEMBAHASAN hanya untuk pelanggan aktif dan admin,
    di semua tempat: hasil kuis, latihan interaktif, dan sesi live (host tetap melihatnya).
  - Arena (0700) memakai pembantu yang sama; katalog kuis (list_public_quizzes) diperbarui di 0700.
*/

-- ========== Tingkat akses kuis ==========
alter table public.quizzes add column if not exists access_level text;
alter table public.quizzes drop constraint if exists quizzes_access_level_check;
alter table public.quizzes add constraint quizzes_access_level_check
  check (access_level is null or access_level in ('public', 'member', 'subscriber'));

/* Tingkat efektif sebuah kuis */
create or replace function public._quiz_access_level(p_quiz uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(z.access_level, (
    select case max(case m.access_level when 'public' then 1 when 'member' then 2 else 3 end)
             when 1 then 'public' when 2 then 'member' when 3 then 'subscriber' end
      from quiz_questions qq
      join question_materials qm on qm.question_id = qq.question_id
      join materials m on m.id = qm.material_id
     where qq.quiz_id = z.id), 'public')
  from quizzes z where z.id = p_quiz;
$$;

/* Pelanggan aktif atau admin: boleh melihat pembahasan */
create or replace function public._can_see_explanations(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (select 1 from profiles where id = p_user and role = 'admin')
    or public._subscription_active(p_user));
$$;

/* Boleh mengerjakan kuis mandiri? Tamu = p_user tanpa profil (login anonim) atau null */
create or replace function public._can_take_quiz(p_quiz uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from profiles where id = p_user and role = 'admin') then true
    else case public._quiz_access_level(p_quiz)
      when 'public' then true
      when 'member' then exists (select 1 from profiles where id = p_user)
      else public._subscription_active(p_user)
    end
  end;
$$;

revoke execute on function public._quiz_access_level(uuid), public._can_see_explanations(uuid),
  public._can_take_quiz(uuid, uuid) from public, anon, authenticated;

/* Untuk halaman kuis: tingkat akses, boleh mengerjakan, dan boleh melihat pembahasan */
create or replace function public.quiz_access(p_quiz uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'level', public._quiz_access_level(p_quiz),
    'can_take', public._can_take_quiz(p_quiz, auth.uid()),
    'explanations', public._can_see_explanations(auth.uid()))
  where exists (select 1 from quizzes where id = p_quiz and (status = 'published' or public.is_admin()));
$$;
revoke execute on function public.quiz_access(uuid) from public;
grant execute on function public.quiz_access(uuid) to anon, authenticated;

/* Admin mengatur tingkat akses kuis (null = ikuti materi) */
create or replace function public.admin_set_quiz_access(p_quiz uuid, p_level text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_level is not null and p_level not in ('public', 'member', 'subscriber') then
    raise exception 'BAD_QUIZ: tingkat akses tidak dikenal';
  end if;
  update quizzes set access_level = p_level where id = p_quiz;
  if not found then raise exception 'QUIZ_NOT_FOUND'; end if;
end;
$$;
revoke execute on function public.admin_set_quiz_access(uuid, text) from public, anon;
grant execute on function public.admin_set_quiz_access(uuid, text) to authenticated;

-- ========== Mulai kuis: cek tingkat akses ==========
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
  v_level text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_quiz from quizzes where id = p_quiz;
  if not found or (v_quiz.status <> 'published' and not v_admin) then raise exception 'QUIZ_NOT_FOUND'; end if;
  if v_quiz.mode = 'live_competition' then raise exception 'LIVE_ONLY'; end if;
  v_s := v_quiz.settings;
  v_level := public._quiz_access_level(p_quiz);
  if not v_reg and (v_level <> 'public' or not coalesce((v_s ->> 'allow_guests')::boolean, false)) then
    raise exception 'LOGIN_REQUIRED';
  end if;
  if not public._can_take_quiz(p_quiz, auth.uid()) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;

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

-- ========== Pembahasan khusus pelanggan ==========
create or replace function public.check_practice_answer(p_attempt uuid, p_question uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_att quiz_attempts%rowtype; v_type text; v_key question_keys%rowtype; v_exp boolean := public._can_see_explanations(auth.uid());
begin
  select * into v_att from quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if coalesce(v_att.settings_snapshot ->> 'show_feedback', 'after_submit') <> 'after_each' then raise exception 'FEEDBACK_DISABLED'; end if;
  if not (p_question = any(v_att.question_order)) then raise exception 'QUESTION_NOT_IN_QUIZ'; end if;
  select type into v_type from questions where id = p_question;
  select * into v_key from question_keys where question_id = p_question;
  return jsonb_build_object('correct', public._grade_response(v_type, coalesce(v_key.answer, '{}'), p_response),
                            'answer', v_key.answer,
                            'explanation', case when v_exp then v_key.explanation end,
                            'explanation_locked', not v_exp and coalesce(v_key.explanation, '') <> '');
end;
$$;

create or replace function public.get_attempt_result(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_att quiz_attempts%rowtype; v_reveal boolean; v_exp boolean; v_title text;
begin
  select * into v_att from quiz_attempts where id = p_attempt and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_att.status = 'in_progress' then raise exception 'NOT_SUBMITTED'; end if;
  v_reveal := public.is_admin() or coalesce(v_att.settings_snapshot ->> 'show_feedback', 'after_submit') <> 'never';
  v_exp := v_reveal and public._can_see_explanations(auth.uid());
  select title into v_title from quizzes where id = v_att.quiz_id;
  return jsonb_build_object(
    'attempt_id', v_att.id, 'quiz_id', v_att.quiz_id, 'quiz_title', v_title, 'status', v_att.status,
    'score', v_att.score, 'max_score', v_att.max_score, 'percent', v_att.percent, 'passed', v_att.passed,
    'late', v_att.late, 'started_at', v_att.started_at, 'finished_at', v_att.finished_at, 'feedback', v_reveal,
    'explanations', v_exp,
    'explanations_locked', v_reveal and not v_exp and exists (
      select 1 from attempt_answers a join question_keys k on k.question_id = a.question_id
       where a.attempt_id = p_attempt and coalesce(k.explanation, '') <> ''),
    'items', (select jsonb_agg(jsonb_build_object(
                'question', a.question_snapshot, 'response', a.response, 'is_correct', a.is_correct,
                'points', a.points_awarded, 'max_points', a.max_points,
                'answer', case when v_reveal then k.answer end,
                'explanation', case when v_exp then k.explanation end)
              order by array_position(v_att.question_order, a.question_id))
              from attempt_answers a left join question_keys k on k.question_id = a.question_id
              where a.attempt_id = p_attempt));
end;
$$;

/* Sesi live: sama dengan 0300, hanya pembahasan saat reveal yang dibatasi (host tetap melihatnya) */
create or replace function public.get_session_state(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s quiz_sessions%rowtype;
  v_host boolean := public.is_session_host(p_session);
  v_me quiz_participants%rowtype;
  v_q uuid;
  v_board jsonb;
  v_exp boolean;
begin
  select * into v_s from quiz_sessions where id = p_session;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into v_me from quiz_participants where session_id = p_session and user_id = auth.uid();
  if not v_host and v_me.id is null then raise exception 'NOT_JOINED'; end if;
  if v_me.id is not null then update quiz_participants set last_seen_at = now() where id = v_me.id; end if;
  v_exp := v_host or public._can_see_explanations(auth.uid());
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
    'explanation', case when v_q is not null and v_s.phase = 'reveal' and v_exp then (select explanation from question_keys where question_id = v_q) end,
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

