/*
  0900 · Optimasi penilaian, agregasi statistik, dan penyimpanan kuis atomik.

  - Perbaikan keamanan penilaian: jsonb_typeof guard pada multiple_select dan ordering di _grade_response
    agar payload non-array tidak memicu exception fatal runtime Postgres.
  - Agregasi performa: fungsi quiz_attempts_avg_score() untuk menghitung rata-rata nilai langsung di database
    tanpa menarik seluruh baris data ke memori server Node.js.
  - Penyimpanan kuis atomik: admin_save_quiz diperbarui untuk menerima access_level secara langsung sehingga
    tidak perlu dua kali round-trip terpisah.
*/

-- 1. Guard tipe data pada _grade_response
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
      if jsonb_typeof(p_resp -> 'selected') <> 'array' then return false; end if;
      return coalesce((select array_agg(distinct x order by x) from jsonb_array_elements_text(coalesce(p_resp -> 'selected', '[]')) x), '{}')
           = coalesce((select array_agg(distinct y order by y) from jsonb_array_elements_text(coalesce(p_key -> 'answers', '[]')) y), '{}');
    when 'true_false' then
      return jsonb_typeof(p_resp -> 'answer') = 'boolean' and (p_resp -> 'answer') = (p_key -> 'answer');
    when 'short_answer' then
      return exists (select 1 from jsonb_array_elements_text(coalesce(p_key -> 'accepted', '[]')) a
                     where lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(p_resp ->> 'answer', '')), '\s+', ' ', 'g')));
    when 'ordering' then
      if jsonb_typeof(p_resp -> 'order') <> 'array' then return false; end if;
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

-- 2. Agregasi nilai rata-rata kuis di database
create or replace function public.quiz_attempts_avg_score()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(percent), 1), 0)
    from quiz_attempts
   where status = 'graded' and not is_preview;
$$;
revoke execute on function public.quiz_attempts_avg_score() from public, anon;
grant execute on function public.quiz_attempts_avg_score() to authenticated;

-- 3. Pembaruan admin_save_quiz dengan dukungan access_level atomik
create or replace function public.admin_save_quiz(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_mode text := coalesce(p ->> 'mode', 'self_paced');
  v_access text;
  s jsonb := coalesce(p -> 'settings', '{}'::jsonb);
  v_settings jsonb;
  v_fb text;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if coalesce(trim(p ->> 'title'), '') = '' then raise exception 'BAD_QUIZ: judul kuis kosong'; end if;
  if v_mode not in ('self_paced', 'interactive_practice', 'live_competition', 'timed_assessment', 'self_paced_assessment') then
    raise exception 'BAD_QUIZ: mode tidak dikenal';
  end if;
  if coalesce(p ->> 'status', 'draft') not in ('draft', 'published', 'archived') then raise exception 'BAD_QUIZ: status tidak valid'; end if;
  
  if p ? 'access_level' then
    v_access := nullif(p ->> 'access_level', '');
    if v_access is not null and v_access not in ('public', 'member', 'subscriber') then
      raise exception 'BAD_QUIZ: tingkat akses tidak dikenal';
    end if;
  end if;

  v_fb := coalesce(s ->> 'show_feedback', case when v_mode = 'interactive_practice' then 'after_each' else 'after_submit' end);
  if v_fb not in ('after_each', 'after_submit', 'never') then raise exception 'BAD_QUIZ: pengaturan umpan balik tidak valid'; end if;
  if v_mode = 'timed_assessment' and nullif(s ->> 'time_limit_sec', '') is null then
    raise exception 'BAD_QUIZ: ujian berbatas waktu butuh batas waktu';
  end if;

  v_settings := jsonb_strip_nulls(jsonb_build_object(
    'shuffle_questions', coalesce((s ->> 'shuffle_questions')::boolean, false),
    'shuffle_options', coalesce((s ->> 'shuffle_options')::boolean, false),
    'time_limit_sec', nullif(s ->> 'time_limit_sec', '')::int,
    'question_time_sec', coalesce(nullif(s ->> 'question_time_sec', '')::int, 30),
    'attempts_allowed', case when v_mode = 'self_paced_assessment' then 1 else nullif(s ->> 'attempts_allowed', '')::int end,
    'show_feedback', v_fb,
    'allow_guests', coalesce((s ->> 'allow_guests')::boolean, false),
    'pass_threshold', coalesce(nullif(s ->> 'pass_threshold', '')::numeric, 60),
    'show_leaderboard', coalesce((s ->> 'show_leaderboard')::boolean, true)));
  if (v_settings ->> 'time_limit_sec')::int not between 30 and 14400 then raise exception 'BAD_QUIZ: batas waktu 30 detik–4 jam'; end if;
  if (v_settings ->> 'question_time_sec')::int not between 5 and 600 then raise exception 'BAD_QUIZ: waktu per soal 5–600 detik'; end if;
  if (v_settings ->> 'attempts_allowed')::int < 1 then raise exception 'BAD_QUIZ: jumlah percobaan minimal 1'; end if;
  if (v_settings ->> 'pass_threshold')::numeric not between 0 and 100 then raise exception 'BAD_QUIZ: batas lulus 0–100'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'questions', '[]')) q
             where not exists (select 1 from questions where id = (q ->> 'question_id')::uuid)) then
    raise exception 'BAD_QUIZ: ada soal yang tidak ditemukan';
  end if;
  if coalesce(p ->> 'status', 'draft') = 'published' then
    if coalesce(jsonb_array_length(p -> 'questions'), 0) = 0 then raise exception 'BAD_QUIZ: kuis tanpa soal tidak bisa dipublikasikan'; end if;
    if exists (select 1 from jsonb_array_elements(p -> 'questions') q join questions x on x.id = (q ->> 'question_id')::uuid
               where x.status <> 'published') then
      raise exception 'BAD_QUIZ: publikasikan dulu semua soal di kuis ini';
    end if;
  end if;

  if v_id is null then
    insert into quizzes (title, description, mode, settings, status, access_level, created_by)
    values (p ->> 'title', nullif(p ->> 'description', ''), v_mode, v_settings, coalesce(p ->> 'status', 'draft'), v_access, auth.uid())
    returning id into v_id;
  else
    update quizzes
       set title = p ->> 'title', description = nullif(p ->> 'description', ''), mode = v_mode,
           settings = v_settings, status = coalesce(p ->> 'status', status),
           access_level = case when p ? 'access_level' then v_access else access_level end
     where id = v_id;
    if not found then raise exception 'QUIZ_NOT_FOUND'; end if;
  end if;

  delete from quiz_questions where quiz_id = v_id;
  insert into quiz_questions (quiz_id, question_id, display_order, points)
  select v_id, (q ->> 'question_id')::uuid, (ord - 1)::int, coalesce((q ->> 'points')::numeric, 1)
    from jsonb_array_elements(coalesce(p -> 'questions', '[]')) with ordinality t(q, ord);

  return v_id;
end;
$$;

-- 4. Menyertakan cakupan materi pada quiz_access untuk justifikasi akses & kuis multi-materi
create or replace function public.quiz_access(p_quiz uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'level', public._quiz_access_level(p_quiz),
    'can_take', public._can_take_quiz(p_quiz, auth.uid()),
    'explanations', public._can_see_explanations(auth.uid()),
    'arena_count', (select count(*) from quiz_questions qq where qq.quiz_id = p_quiz and public._arena_eligible(qq.question_id)),
    'materials', (select coalesce(jsonb_agg(distinct jsonb_build_object('title', m.title, 'slug', m.slug, 'course_slug', c.slug)), '[]'::jsonb)
                    from quiz_questions qq join question_materials qm on qm.question_id = qq.question_id
                    join materials m on m.id = qm.material_id join courses c on c.id = m.course_id
                   where qq.quiz_id = p_quiz and m.status = 'published' and c.status = 'published'))
  where exists (select 1 from quizzes where id = p_quiz and (status = 'published' or public.is_admin()));
$$;
