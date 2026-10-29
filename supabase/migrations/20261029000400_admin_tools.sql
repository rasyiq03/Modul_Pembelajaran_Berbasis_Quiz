/*
  0400 · Alat admin: simpan soal & kuis secara atomik dengan validasi server, impor soal,
  statistik kuis. Juga membersihkan sisa KuisKelas Online (tabel/fungsi kq_*) bila pernah dipasang;
  fitur room PIN-nya digantikan sesi live platform (migrasi 0300).
*/

-- ========== Bersihkan KuisKelas Online (aman bila tidak ada) ==========
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'kq\_%' loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;
drop table if exists public.kq_answers, public.kq_room_roster, public.kq_room_players, public.kq_room_keys,
  public.kq_rooms, public.kq_profiles cascade;

-- ========== Validasi kunci jawaban per jenis soal ==========
/* p_options: [{key,label,side}], p_answer: format di migrasi 0200. Melempar galat yang bisa dibaca admin. */
create or replace function public._validate_question(p_type text, p_options jsonb, p_answer jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare
  keys text[] := coalesce((select array_agg(o ->> 'key') from jsonb_array_elements(coalesce(p_options, '[]')) o), '{}');
  n int := coalesce(array_length(keys, 1), 0);
  lefts text[]; rights text[]; k text;
begin
  if (select count(distinct x) from unnest(keys) x) <> n then raise exception 'BAD_QUESTION: kunci opsi harus unik'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_options, '[]')) o
             where coalesce(trim(o ->> 'key'), '') = '' or coalesce(trim(o ->> 'label'), '') = '') then
    raise exception 'BAD_QUESTION: setiap opsi butuh kunci dan teks';
  end if;
  case p_type
    when 'single_choice' then
      if n < 2 then raise exception 'BAD_QUESTION: pilihan tunggal butuh minimal 2 opsi'; end if;
      if not ((p_answer ->> 'answer') = any(keys)) then raise exception 'BAD_QUESTION: pilih satu jawaban benar'; end if;
    when 'multiple_select' then
      if n < 2 then raise exception 'BAD_QUESTION: pilihan jamak butuh minimal 2 opsi'; end if;
      if jsonb_typeof(p_answer -> 'answers') <> 'array' or jsonb_array_length(p_answer -> 'answers') = 0 then
        raise exception 'BAD_QUESTION: tandai minimal satu jawaban benar';
      end if;
      if exists (select 1 from jsonb_array_elements_text(p_answer -> 'answers') a where not (a = any(keys))) then
        raise exception 'BAD_QUESTION: jawaban benar harus salah satu opsi';
      end if;
    when 'true_false' then
      if jsonb_typeof(p_answer -> 'answer') <> 'boolean' then raise exception 'BAD_QUESTION: tentukan Benar atau Salah'; end if;
    when 'short_answer' then
      if jsonb_typeof(p_answer -> 'accepted') <> 'array'
         or not exists (select 1 from jsonb_array_elements_text(p_answer -> 'accepted') a where trim(a) <> '') then
        raise exception 'BAD_QUESTION: isi minimal satu jawaban yang diterima';
      end if;
    when 'essay' then
      null;
    when 'matching' then
      select array_agg(o ->> 'key') filter (where o ->> 'side' = 'left'), array_agg(o ->> 'key') filter (where o ->> 'side' = 'right')
        into lefts, rights from jsonb_array_elements(coalesce(p_options, '[]')) o;
      if coalesce(array_length(lefts, 1), 0) < 2 or coalesce(array_length(rights, 1), 0) < 2 then
        raise exception 'BAD_QUESTION: menjodohkan butuh minimal 2 butir kiri dan 2 kanan';
      end if;
      if jsonb_typeof(p_answer -> 'pairs') <> 'object' then raise exception 'BAD_QUESTION: pasangan belum diatur'; end if;
      foreach k in array lefts loop
        if not ((p_answer -> 'pairs' ->> k) = any(rights)) then raise exception 'BAD_QUESTION: setiap butir kiri harus punya pasangan kanan'; end if;
      end loop;
    when 'ordering' then
      if n < 2 then raise exception 'BAD_QUESTION: mengurutkan butuh minimal 2 butir'; end if;
      if jsonb_typeof(p_answer -> 'order') <> 'array'
         or (select array_agg(x order by x) from jsonb_array_elements_text(p_answer -> 'order') x) is distinct from (select array_agg(x order by x) from unnest(keys) x) then
        raise exception 'BAD_QUESTION: urutan benar harus memuat semua butir tepat sekali';
      end if;
    else
      raise exception 'BAD_QUESTION: jenis soal tidak dikenal';
  end case;
end;
$$;
revoke execute on function public._validate_question(text, jsonb, jsonb) from public, anon, authenticated;

/*
  Simpan soal (baru bila p ->> 'id' kosong). p:
  { id?, type, prompt, media_url?, topic?, difficulty?, status?, source_ref?,
    options: [{key,label,side?}], answer: {...}, explanation?, material_ids: [uuid], tags: [text] }
*/
create or replace function public.admin_save_question(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_type text := p ->> 'type';
  v_opts jsonb := case when v_type = 'true_false' or v_type = 'short_answer' or v_type = 'essay' then '[]'::jsonb
                       else coalesce(p -> 'options', '[]'::jsonb) end;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if coalesce(trim(p ->> 'prompt'), '') = '' then raise exception 'BAD_QUESTION: teks soal kosong'; end if;
  perform public._validate_question(v_type, v_opts, coalesce(p -> 'answer', '{}'::jsonb));
  if coalesce(p ->> 'status', 'draft') not in ('draft', 'published', 'archived') then raise exception 'BAD_QUESTION: status tidak valid'; end if;
  if nullif(p ->> 'difficulty', '') is not null and p ->> 'difficulty' not in ('easy', 'medium', 'hard') then
    raise exception 'BAD_QUESTION: tingkat kesulitan tidak valid';
  end if;

  if v_id is null then
    insert into questions (type, prompt, media_url, topic, difficulty, status, source_ref, created_by)
    values (v_type, p ->> 'prompt', nullif(p ->> 'media_url', ''), nullif(p ->> 'topic', ''), nullif(p ->> 'difficulty', ''),
            coalesce(p ->> 'status', 'draft'), nullif(p ->> 'source_ref', ''), auth.uid())
    returning id into v_id;
  else
    -- Jenis soal tidak boleh diganti bila soal sudah pernah dijawab (kunci lama tidak cocok lagi)
    if exists (select 1 from questions where id = v_id and type <> v_type)
       and (exists (select 1 from attempt_answers where question_id = v_id) or exists (select 1 from live_answers where question_id = v_id)) then
      raise exception 'BAD_QUESTION: jenis soal yang sudah dijawab tidak bisa diganti; duplikat soalnya';
    end if;
    update questions set type = v_type, prompt = p ->> 'prompt', media_url = nullif(p ->> 'media_url', ''),
           topic = nullif(p ->> 'topic', ''), difficulty = nullif(p ->> 'difficulty', ''),
           status = coalesce(p ->> 'status', status), source_ref = coalesce(nullif(p ->> 'source_ref', ''), source_ref)
     where id = v_id;
    if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  end if;

  /* Urutan tampil: soal mengurutkan dan sisi kanan menjodohkan diacak, agar urutan simpan
     (yang sama dengan kunci) tidak membocorkan jawaban. Opsi lain mengikuti urutan admin. */
  delete from question_options where question_id = v_id;
  insert into question_options (question_id, key, label, side, display_order)
  select v_id, trim(o ->> 'key'), o ->> 'label', nullif(o ->> 'side', ''),
         case when v_type = 'ordering' or (v_type = 'matching' and o ->> 'side' = 'right')
              then (1000 + row_number() over (order by random()))::int else (ord - 1)::int end
    from jsonb_array_elements(v_opts) with ordinality t(o, ord);
  /* Bila hasil acak kebetulan sama dengan kunci, tukar dua butir pertama */
  if v_type in ('ordering', 'matching') then
    declare tampil text[]; benar text[]; k1 text; k2 text;
    begin
      select array_agg(key order by display_order) into tampil from question_options
       where question_id = v_id and (v_type = 'ordering' or side = 'right');
      benar := case when v_type = 'ordering' then array(select jsonb_array_elements_text(p -> 'answer' -> 'order'))
                    else array(select p -> 'answer' -> 'pairs' ->> o.key from question_options o
                               where o.question_id = v_id and o.side = 'left' order by o.display_order) end;
      if tampil = benar and array_length(tampil, 1) >= 2 then
        k1 := tampil[1]; k2 := tampil[2];
        update question_options o set display_order = x.d from (
          select key, (999 + row_number() over (order by case key when k2 then 0 when k1 then 1 else 2 end, display_order))::int as d
            from question_options where question_id = v_id and (v_type = 'ordering' or side = 'right')) x
         where o.question_id = v_id and o.key = x.key;
      end if;
    end;
  end if;

  insert into question_keys (question_id, answer, explanation)
  values (v_id, coalesce(p -> 'answer', '{}'::jsonb), nullif(p ->> 'explanation', ''))
  on conflict (question_id) do update set answer = excluded.answer, explanation = excluded.explanation;

  delete from question_materials where question_id = v_id;
  insert into question_materials (question_id, material_id)
  select distinct v_id, m::uuid from jsonb_array_elements_text(coalesce(p -> 'material_ids', '[]')) m;

  delete from question_tags where question_id = v_id;
  insert into question_tags (question_id, tag)
  select distinct v_id, lower(trim(t)) from jsonb_array_elements_text(coalesce(p -> 'tags', '[]')) t where trim(t) <> '';

  return v_id;
end;
$$;

/* FR-32: duplikat soal kanonis sebagai draft baru */
create or replace function public.admin_duplicate_question(p_question uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  insert into questions (type, prompt, media_url, topic, difficulty, status, created_by)
  select type, prompt || ' (salinan)', media_url, topic, difficulty, 'draft', auth.uid() from questions where id = p_question
  returning id into v_new;
  if v_new is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  insert into question_options (question_id, key, label, side, display_order)
    select v_new, key, label, side, display_order from question_options where question_id = p_question;
  insert into question_keys (question_id, answer, explanation)
    select v_new, answer, explanation from question_keys where question_id = p_question;
  insert into question_materials select v_new, material_id from question_materials where question_id = p_question;
  insert into question_tags select v_new, tag from question_tags where question_id = p_question;
  return v_new;
end;
$$;

/* FR-34: impor banyak soal sekaligus; baris yang gagal dilaporkan tanpa membatalkan baris lain.
   Baris dengan source_ref yang sudah ada diperbarui (impor ulang tidak menggandakan soal). */
create or replace function public.admin_import_questions(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; i int := 0; ok int := 0; errs jsonb := '[]'::jsonb; v_existing uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'BAD_IMPORT: maksimal 2000 baris'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      v_existing := null;
      if nullif(r ->> 'source_ref', '') is not null then
        select id into v_existing from questions where source_ref = r ->> 'source_ref';
      end if;
      perform public.admin_save_question(case when v_existing is not null then r || jsonb_build_object('id', v_existing) else r - 'id' end);
      ok := ok + 1;
    exception when others then
      errs := errs || jsonb_build_object('row', i, 'message', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('saved', ok, 'errors', errs);
end;
$$;

/*
  Simpan kuis + daftar soalnya secara atomik. p:
  { id?, title, description?, mode, status?, settings: {...}, questions: [{question_id, points}] }   (urutan = urutan array)
*/
create or replace function public.admin_save_quiz(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_mode text := coalesce(p ->> 'mode', 'self_paced');
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
  v_fb := coalesce(s ->> 'show_feedback', case when v_mode = 'interactive_practice' then 'after_each' else 'after_submit' end);
  if v_fb not in ('after_each', 'after_submit', 'never') then raise exception 'BAD_QUIZ: pengaturan umpan balik tidak valid'; end if;
  if v_mode = 'timed_assessment' and nullif(s ->> 'time_limit_sec', '') is null then
    raise exception 'BAD_QUIZ: ujian berbatas waktu butuh batas waktu';
  end if;
  /* Hanya kunci yang dikenal yang disimpan, dengan tipe yang benar */
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
    insert into quizzes (title, description, mode, settings, status, created_by)
    values (p ->> 'title', nullif(p ->> 'description', ''), v_mode, v_settings, coalesce(p ->> 'status', 'draft'), auth.uid())
    returning id into v_id;
  else
    update quizzes set title = p ->> 'title', description = nullif(p ->> 'description', ''), mode = v_mode,
           settings = v_settings, status = coalesce(p ->> 'status', status)
     where id = v_id;
    if not found then raise exception 'QUIZ_NOT_FOUND'; end if;
  end if;

  delete from quiz_questions where quiz_id = v_id;
  insert into quiz_questions (quiz_id, question_id, display_order, points)
  select v_id, (q ->> 'question_id')::uuid, (ord - 1)::int, greatest(coalesce(nullif(q ->> 'points', '')::numeric, 1), 0)
    from jsonb_array_elements(coalesce(p -> 'questions', '[]')) with ordinality t(q, ord)
  on conflict (quiz_id, question_id) do nothing;   -- soal ganda dalam satu kuis diabaikan

  return v_id;
end;
$$;

/* FR-66: statistik kuis (tanpa pratinjau admin) */
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
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', qq.question_id, 'prompt', q.prompt, 'type', q.type, 'points', qq.points,
        'answered', (select count(*) from attempt_answers a join quiz_attempts t on t.id = a.attempt_id
                     where t.quiz_id = p_quiz and not t.is_preview and a.question_id = qq.question_id and a.response is not null),
        'correct', (select count(*) from attempt_answers a join quiz_attempts t on t.id = a.attempt_id
                    where t.quiz_id = p_quiz and not t.is_preview and a.question_id = qq.question_id and a.is_correct))
        order by qq.display_order), '[]'::jsonb)
      from quiz_questions qq join questions q on q.id = qq.question_id where qq.quiz_id = p_quiz));
end;
$$;

/* FR-07/36: katalog kuis terpublikasi untuk semua orang (metadata saja; soal & kunci tetap tertutup).
   p_material: hanya kuis yang memuat soal dari materi itu. */
create or replace function public.list_public_quizzes(p_material uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x ->> 'title'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', z.id, 'title', z.title, 'description', z.description, 'mode', z.mode, 'updated_at', z.updated_at,
      'allow_guests', coalesce((z.settings ->> 'allow_guests')::boolean, false),
      'time_limit_sec', (z.settings ->> 'time_limit_sec')::int,
      'attempts_allowed', (z.settings ->> 'attempts_allowed')::int,
      'question_count', (select count(*) from quiz_questions where quiz_id = z.id),
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

revoke execute on function public.admin_save_question(jsonb), public.admin_duplicate_question(uuid),
  public.admin_import_questions(jsonb), public.admin_save_quiz(jsonb), public.quiz_stats(uuid) from public, anon;
grant execute on function public.admin_save_question(jsonb), public.admin_duplicate_question(uuid),
  public.admin_import_questions(jsonb), public.admin_save_quiz(jsonb), public.quiz_stats(uuid) to authenticated;
