/*
  Gamifikasi di platform: XP, level, lencana, hari beruntun, progres bab & lab, dan papan peringkat.
  Dulu semua ini hidup di localStorage materi HTML; sekarang dihitung server dari data yang sudah
  terverifikasi sehingga tidak bisa dipalsukan dari peramban.

  Sumber XP (setiap kunci hanya sekali per pengguna, lihat xp_events.key):
    - kuis selesai              +20  (sekali per kuis per hari)
    - soal benar                +10  pertama kali benar, +2 bila sudah pernah benar
    - semua benar (min. 5 soal) +30
    - ikut kuis live            +20, podium +50/+30/+20 (min. 3 peserta)
    - tandai bab paham          +20  (bab dari materials.sections)
    - lab dicoba                +15  (lab dari materials.labs)
    - latihan di materi selesai +15  (sekali per materi per hari)
    - hadir hari ini            +10
  Level n butuh 50·(n−1)·n XP: 0, 100, 300, 600, 1000, ... (sama dengan mesin materi lama).
  Hanya pengguna terdaftar (punya baris profiles) yang mendapat XP; tamu anonim tidak.
*/

-- ========== Kolom tambahan ==========
alter table public.profiles add column if not exists avatar text not null default '🦉';
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar in ('🦊', '🐼', '🐯', '🐸', '🐙', '🦉', '🐧', '🦄', '🐝', '🐳', '🦖', '🐱', '🤖', '👾', '🚀', '🌵'));
grant update (display_name, avatar_url, avatar) on public.profiles to authenticated;

/* Bab & lab materi (diisi npm run content:import dari HTML), dasar validasi progres */
alter table public.materials add column if not exists sections jsonb not null default '[]'::jsonb;
alter table public.materials add column if not exists labs jsonb not null default '[]'::jsonb;

-- ========== Tabel ==========
create table if not exists public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('quiz', 'question', 'perfect', 'live', 'podium', 'read', 'lab', 'practice', 'day')),
  key        text not null,
  amount     int not null check (amount >= 0),
  label      text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists xp_events_user_idx on public.xp_events(user_id, created_at desc);
create index if not exists xp_events_created_idx on public.xp_events(created_at);
alter table public.xp_events enable row level security;
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;
drop policy if exists xp_events_own on public.xp_events;
create policy xp_events_own on public.xp_events for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table if not exists public.user_badges (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  badge     text not null check (badge in ('first', 'streak5', 'streak10', 'perfect', 'hots', 'speed', 'champ',
                                           'reader', 'labrat', 'day3', 'day7', 'lv5')),
  source    text,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
drop policy if exists user_badges_own on public.user_badges;
create policy user_badges_own on public.user_badges for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table if not exists public.material_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  kind        text not null check (kind in ('read', 'lab')),
  ref         text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, material_id, kind, ref)
);
alter table public.material_progress enable row level security;
revoke all on public.material_progress from anon, authenticated;
grant select on public.material_progress to authenticated;
drop policy if exists material_progress_own on public.material_progress;
create policy material_progress_own on public.material_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ========== Pembantu internal ==========
create or replace function public._jkt_date(t timestamptz default now())
returns date language sql immutable as $$ select (t at time zone 'Asia/Jakarta')::date $$;

create or replace function public._level(p_xp bigint)
returns int language plpgsql immutable as $$
declare n int := greatest(1, floor((1 + sqrt(1 + 0.08 * greatest(p_xp, 0))) / 2)::int);
begin
  while 50 * n * (n + 1) <= p_xp loop n := n + 1; end loop;     -- jaga presisi di batas level
  while n > 1 and 50 * (n - 1) * n > p_xp loop n := n - 1; end loop;
  return n;
end;
$$;

create or replace function public._xp_total(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from xp_events where user_id = p_user;
$$;

/* Hari beruntun: jumlah hari hadir berurutan yang berakhir hari ini atau kemarin (WIB) */
create or replace function public._day_streak(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  with d as (
    select distinct _jkt_date(created_at) as day from xp_events where user_id = p_user
  ), g as (
    select day, day - (row_number() over (order by day))::int as grp from d
  ), runs as (
    select max(day) as last_day, count(*)::int as len from g group by grp
  )
  select coalesce((select len from runs where last_day >= _jkt_date() - 1 order by last_day desc limit 1), 0);
$$;

create or replace function public._grant_badge(p_user uuid, p_badge text, p_source text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into user_badges (user_id, badge, source) values (p_user, p_badge, p_source) on conflict do nothing;
  return found;
end;
$$;

/* Catat XP sekali per kunci; mengembalikan XP yang benar-benar ditambahkan */
create or replace function public._award(p_user uuid, p_kind text, p_key text, p_amount int, p_label text, p_meta jsonb default '{}'::jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not exists (select 1 from profiles where id = p_user) then return 0; end if;
  insert into xp_events (user_id, kind, key, amount, label, meta)
  values (p_user, p_kind, p_key, p_amount, p_label, coalesce(p_meta, '{}'::jsonb))
  on conflict (user_id, key) do nothing
  returning amount into v;
  if v is not null and public._level(public._xp_total(p_user)) >= 5 then
    perform public._grant_badge(p_user, 'lv5', p_key);
  end if;
  return coalesce(v, 0);
end;
$$;

/* Panjang rangkaian benar terpanjang dari pasangan (urutan, benar) */
create or replace function public._max_run(p_items jsonb)
returns int language sql immutable as $$
  with o as (
    select (e ->> 'pos')::int as pos, coalesce((e ->> 'ok')::boolean, false) as ok from jsonb_array_elements(coalesce(p_items, '[]')) e
  ), g as (
    select ok, pos - row_number() over (partition by ok order by pos) as grp from o
  )
  select coalesce(max(c), 0)::int from (select count(*) c from g where ok group by grp) x;
$$;

-- ========== XP dari percobaan kuis ==========
create or replace function public._award_attempt(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a quiz_attempts%rowtype;
  v_title text;
  r record;
  v_first boolean;
  v_total int;
  v_run int;
  v_src text := 'attempt:' || p_attempt;
  v_meta jsonb;
begin
  select * into a from quiz_attempts where id = p_attempt;
  if not found or a.is_preview or a.status not in ('submitted', 'graded') then return; end if;
  if not exists (select 1 from profiles where id = a.user_id) then return; end if;
  select title into v_title from quizzes where id = a.quiz_id;
  v_meta := jsonb_build_object('attempt', a.id, 'quiz', a.quiz_id);

  perform _award(a.user_id, 'quiz', 'done:' || a.quiz_id || ':' || _jkt_date(coalesce(a.finished_at, now())),
                 20, 'Kuis selesai: ' || v_title, v_meta);
  for r in select question_id from attempt_answers where attempt_id = a.id and is_correct loop
    v_first := not exists (select 1 from xp_events where user_id = a.user_id and kind = 'question' and meta ->> 'question' = r.question_id::text);
    perform _award(a.user_id, 'question', 'a:' || a.id || ':' || r.question_id, case when v_first then 10 else 2 end,
                   case when v_first then 'Soal benar pertama kali' else 'Soal benar (ulangan)' end,
                   v_meta || jsonb_build_object('question', r.question_id));
  end loop;

  select count(*) into v_total from attempt_answers where attempt_id = a.id;
  perform _grant_badge(a.user_id, 'first', v_src);
  if a.status = 'graded' and v_total >= 5 and a.percent >= 100 then
    perform _award(a.user_id, 'perfect', 'perfect:' || a.id, 30, 'Semua jawaban benar', v_meta);
    perform _grant_badge(a.user_id, 'perfect', v_src);
  end if;
  select _max_run(jsonb_agg(jsonb_build_object('pos', array_position(a.question_order, question_id), 'ok', is_correct)))
    into v_run from attempt_answers where attempt_id = a.id;
  if v_run >= 5 then perform _grant_badge(a.user_id, 'streak5', v_src); end if;
  if v_run >= 10 then perform _grant_badge(a.user_id, 'streak10', v_src); end if;
  if exists (select 1 from attempt_answers aa join questions q on q.id = aa.question_id
              where aa.attempt_id = a.id and q.difficulty = 'hard')
     and not exists (select 1 from attempt_answers aa join questions q on q.id = aa.question_id
                      where aa.attempt_id = a.id and q.difficulty = 'hard' and aa.is_correct is not true) then
    perform _grant_badge(a.user_id, 'hots', v_src);
  end if;
end;
$$;

create or replace function public._trg_award_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._award_attempt(new.id);
  return null;
end;
$$;
drop trigger if exists quiz_attempts_award on public.quiz_attempts;
create trigger quiz_attempts_award
  after update of status, score on public.quiz_attempts
  for each row when (new.status in ('submitted', 'graded') and not new.is_preview)
  execute function public._trg_award_attempt();

-- ========== XP dari sesi live ==========
create or replace function public._award_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s quiz_sessions%rowtype;
  v_title text;
  v_n int;
  v_q int;
  p record;
  r record;
  v_first boolean;
  v_run int;
  v_avg numeric;
  v_src text := 'session:' || p_session;
  v_meta jsonb := jsonb_build_object('session', p_session);
begin
  select * into s from quiz_sessions where id = p_session;
  if not found or s.status <> 'completed' then return; end if;
  select title into v_title from quizzes where id = s.quiz_id;
  v_q := coalesce(array_length(s.question_order, 1), 0);
  select count(*) into v_n from quiz_participants where session_id = p_session and answered_count > 0;

  for p in select qp.*, rank() over (order by qp.score desc) as rk
             from quiz_participants qp where qp.session_id = p_session and qp.answered_count > 0 loop
    continue when not exists (select 1 from profiles where id = p.user_id);
    perform _award(p.user_id, 'live', 'live:' || p_session, 20, 'Ikut kuis live: ' || v_title, v_meta);
    for r in select question_id, question_index from live_answers where participant_id = p.id and is_correct loop
      v_first := not exists (select 1 from xp_events where user_id = p.user_id and kind = 'question' and meta ->> 'question' = r.question_id::text);
      perform _award(p.user_id, 'question', 'l:' || p_session || ':' || r.question_index, case when v_first then 10 else 2 end,
                     case when v_first then 'Soal benar pertama kali' else 'Soal benar (ulangan)' end,
                     v_meta || jsonb_build_object('question', r.question_id));
    end loop;
    if v_n >= 3 and p.rk <= 3 then
      perform _award(p.user_id, 'podium', 'podium:' || p_session, (array[50, 30, 20])[p.rk],
                     'Peringkat ' || p.rk || ' kuis live', v_meta);
    end if;
    if v_n >= 3 and p.rk = 1 then perform _grant_badge(p.user_id, 'champ', v_src); end if;
    perform _grant_badge(p.user_id, 'first', v_src);
    if v_q >= 5 and p.correct_count >= v_q then perform _grant_badge(p.user_id, 'perfect', v_src); end if;
    select _max_run(jsonb_agg(jsonb_build_object('pos', question_index, 'ok', is_correct))), avg(time_ms)
      into v_run, v_avg from live_answers where participant_id = p.id;
    if v_run >= 5 then perform _grant_badge(p.user_id, 'streak5', v_src); end if;
    if v_run >= 10 then perform _grant_badge(p.user_id, 'streak10', v_src); end if;
    if v_q >= 3 and v_avg < 5000 and p.correct_count >= 0.7 * v_q then perform _grant_badge(p.user_id, 'speed', v_src); end if;
  end loop;
end;
$$;

create or replace function public._trg_award_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._award_session(new.id);
  return null;
end;
$$;
drop trigger if exists quiz_sessions_award on public.quiz_sessions;
create trigger quiz_sessions_award
  after update of status on public.quiz_sessions
  for each row when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public._trg_award_session();

revoke execute on function public._jkt_date(timestamptz), public._level(bigint), public._xp_total(uuid), public._day_streak(uuid),
  public._grant_badge(uuid, text, text), public._award(uuid, text, text, int, text, jsonb), public._max_run(jsonb),
  public._award_attempt(uuid), public._trg_award_attempt(), public._award_session(uuid), public._trg_award_session()
  from public, anon, authenticated;

-- ========== RPC untuk klien ==========
/* Hadir hari ini (+10 XP sekali per hari) dan lencana hari beruntun */
create or replace function public.daily_checkin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_gain int; v_streak int; v_badges text[] := '{}';
begin
  if not public.is_registered() or not exists (select 1 from profiles where id = v_uid) then
    return jsonb_build_object('ok', false);
  end if;
  v_streak := _day_streak(v_uid);
  if not exists (select 1 from xp_events where user_id = v_uid and _jkt_date(created_at) = _jkt_date()) then
    v_streak := v_streak + 1;   -- hari ini belum terhitung
  end if;
  v_gain := _award(v_uid, 'day', 'day:' || _jkt_date(), 10,
                   case when v_streak > 1 then 'Hadir ' || v_streak || ' hari berturut-turut' else 'Hadir hari ini' end,
                   jsonb_build_object('streak', v_streak));
  if v_streak >= 3 and _grant_badge(v_uid, 'day3', 'day:' || _jkt_date()) then v_badges := v_badges || 'day3'; end if;
  if v_streak >= 7 and _grant_badge(v_uid, 'day7', 'day:' || _jkt_date()) then v_badges := v_badges || 'day7'; end if;
  return jsonb_build_object('ok', true, 'xp', v_gain, 'streak', v_streak, 'total', _xp_total(v_uid), 'badges', to_jsonb(v_badges));
end;
$$;

/* Progres materi dari pembaca (bab ditandai paham, lab dicoba, latihan selesai). Hanya bab/lab yang
   tercatat di materials.sections/labs dan hanya untuk pengguna yang punya akses materi lengkap. */
create or replace function public.record_material_progress(p_material uuid, p_kind text, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  m materials%rowtype;
  v_label text;
  v_gain int := 0;
  v_badges text[] := '{}';
  v_meta jsonb := jsonb_build_object('material', p_material);
begin
  if not public.is_registered() or not exists (select 1 from profiles where id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'login_required');
  end if;
  select * into m from materials where id = p_material;
  if not found or not public.has_material_access(p_material) then return jsonb_build_object('ok', false, 'error', 'no_access'); end if;

  if p_kind in ('read', 'lab') then
    select e ->> 'label' into v_label
      from jsonb_array_elements(case when p_kind = 'read' then m.sections else m.labs end) e where e ->> 'id' = p_ref;
    if v_label is null then return jsonb_build_object('ok', false, 'error', 'unknown_ref'); end if;
    insert into material_progress (user_id, material_id, kind, ref) values (v_uid, p_material, p_kind, p_ref) on conflict do nothing;
    v_gain := _award(v_uid, p_kind, p_kind || ':' || p_material || ':' || p_ref, case when p_kind = 'read' then 20 else 15 end,
                     case when p_kind = 'read' then 'Bab selesai: ' else 'Lab dicoba: ' end || left(v_label, 60),
                     v_meta || jsonb_build_object('ref', p_ref));
    if p_kind = 'read' and jsonb_array_length(m.sections) > 0 and not exists (
         select 1 from jsonb_array_elements(m.sections) e
          where not exists (select 1 from material_progress mp where mp.user_id = v_uid and mp.material_id = p_material
                              and mp.kind = 'read' and mp.ref = e ->> 'id'))
       and _grant_badge(v_uid, 'reader', 'material:' || p_material) then
      v_badges := v_badges || 'reader';
    end if;
    if p_kind = 'lab' and jsonb_array_length(m.labs) > 0 and not exists (
         select 1 from jsonb_array_elements(m.labs) e
          where not exists (select 1 from material_progress mp where mp.user_id = v_uid and mp.material_id = p_material
                              and mp.kind = 'lab' and mp.ref = e ->> 'id'))
       and _grant_badge(v_uid, 'labrat', 'material:' || p_material) then
      v_badges := v_badges || 'labrat';
    end if;
  elsif p_kind = 'practice' then
    v_gain := _award(v_uid, 'practice', 'practice:' || p_material || ':' || _jkt_date(), 15,
                     'Latihan di materi: ' || left(m.title, 60), v_meta);
  else
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;
  return jsonb_build_object('ok', true, 'xp', v_gain, 'total', _xp_total(v_uid), 'badges', to_jsonb(v_badges));
end;
$$;

/* Ringkasan gamifikasi milik sendiri */
create or replace function public.get_my_progress()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_total bigint;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then return null; end if;
  v_total := _xp_total(v_uid);
  return jsonb_build_object(
    'xp', v_total,
    'week_xp', (select coalesce(sum(amount), 0) from xp_events where user_id = v_uid and created_at >= now() - interval '7 days'),
    'streak', _day_streak(v_uid),
    'rank', (select count(*) + 1 from (select user_id from xp_events group by user_id having sum(amount) > v_total) t),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge', badge, 'earned_at', earned_at) order by earned_at)
                          from user_badges where user_id = v_uid), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                          select label, amount, kind, created_at from xp_events where user_id = v_uid
                           order by created_at desc, id desc limit 15) x), '[]'::jsonb));
end;
$$;

/* Papan peringkat XP: semua waktu atau 7 hari terakhir. Hanya nama tampilan & avatar, tanpa email. */
create or replace function public.xp_leaderboard(p_period text default 'all', p_limit int default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select e.user_id, sum(e.amount)::bigint as xp
      from xp_events e
     where p_period <> 'week' or e.created_at >= now() - interval '7 days'
     group by e.user_id
  ), r as (
    select t.user_id, t.xp, rank() over (order by t.xp desc) as rank,
           coalesce(nullif(trim(p.display_name), ''), 'Pengguna') as name, p.avatar,
           (select sum(amount) from xp_events where user_id = t.user_id)::bigint as total
      from t join profiles p on p.id = t.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'avatar', avatar, 'xp', xp, 'total', total,
                                               'me', user_id = auth.uid()) order by rank, name), '[]'::jsonb)
    from (select * from r order by rank, name limit least(greatest(coalesce(p_limit, 20), 1), 100)) x;
$$;

revoke execute on function public.daily_checkin(), public.record_material_progress(uuid, text, text),
  public.get_my_progress(), public.xp_leaderboard(text, int) from public, anon;
grant execute on function public.daily_checkin(), public.record_material_progress(uuid, text, text),
  public.get_my_progress() to authenticated;
grant execute on function public.xp_leaderboard(text, int) to anon, authenticated;

-- ========== Isi ulang XP dari aktivitas yang sudah ada (aman diulang) ==========
do $$
declare r record;
begin
  for r in select id from quiz_attempts where status in ('submitted', 'graded') and not is_preview loop
    perform public._award_attempt(r.id);
  end loop;
  for r in select id from quiz_sessions where status = 'completed' loop
    perform public._award_session(r.id);
  end loop;
end $$;
