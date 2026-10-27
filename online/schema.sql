-- =====================================================================
-- KuisKelas Online v2.0.0: skema Supabase
-- Jalankan sekali di Supabase > SQL Editor (aman dijalankan ulang).
-- Prasyarat: Authentication > Sign In / Providers > "Allow anonymous sign-ins" diaktifkan.
--
-- Prinsip keamanan:
--   * Semua perubahan permainan lewat fungsi (RPC) security definer; tabel tidak bisa ditulis langsung.
--   * Kunci jawaban & pembahasan disimpan di room_keys yang tidak bisa dibaca klien; dibuka per soal
--     lewat kq_room_reveal setelah soal ditutup. Skor dihitung di server.
--   * NIM peserta hanya terlihat oleh pemandu room (tabel room_roster); peringkat kelas tidak memuat NIM.
-- =====================================================================

-- ---------- Tabel ----------
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  student_id  text not null default '',
  nickname    text not null default '' check (char_length(nickname) <= 24),
  class_code  text not null default '' check (char_length(class_code) <= 16),
  avatar      text not null default '🙂' check (char_length(avatar) <= 8),
  xp          integer not null default 0 check (xp >= 0),
  level       integer not null default 1,
  badges      jsonb not null default '[]'::jsonb,
  games       integer not null default 0,
  best_score  integer not null default 0,
  day_streak  integer not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_class_xp on public.profiles (class_code, xp desc);

create table if not exists public.rooms (
  pin           text primary key,
  host_uid      uuid not null references auth.users(id) on delete cascade,
  class_code    text not null,
  material_id   text not null,
  material_path text,
  title         text,
  status        text not null default 'lobby'
                check (status in ('lobby', 'intro', 'question', 'result', 'board', 'final', 'closed')),
  q_index       integer not null default -1,
  q_count       integer not null,
  q_started_at  timestamptz,
  times         integer[] not null,
  hots          boolean[] not null,
  perm          jsonb not null,
  questions     jsonb not null,          -- [{q, o, topic, ref}] tanpa kunci
  sections      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rooms_class_created on public.rooms (class_code, created_at desc);
create index if not exists rooms_host_created on public.rooms (host_uid, created_at desc);

create table if not exists public.room_keys (
  pin   text primary key references public.rooms(pin) on delete cascade,
  key   integer[] not null,
  expl  jsonb not null default '[]'::jsonb
);

create table if not exists public.room_players (
  room_pin    text not null references public.rooms(pin) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nickname    text not null default '',
  avatar      text not null default '🙂',
  class_code  text not null default '',
  score       integer not null default 0,
  correct     integer not null default 0,
  answered    integer not null default 0,
  streak      integer not null default 0,
  best_streak integer not null default 0,
  last_q      integer not null default -2,
  joined_at   timestamptz not null default now(),
  primary key (room_pin, user_id)
);

-- NIM peserta per room, terpisah agar peserta lain tidak bisa membacanya
create table if not exists public.room_roster (
  room_pin    text not null references public.rooms(pin) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  student_id  text not null default '',
  primary key (room_pin, user_id)
);

create table if not exists public.answers (
  room_pin   text not null references public.rooms(pin) on delete cascade,
  q_index    integer not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  choice     integer not null check (choice between 0 and 3),
  is_correct boolean not null,
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (room_pin, q_index, user_id)
);

-- ---------- Pembantu RLS ----------
create or replace function public.kq_is_host(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms where pin = p_pin and host_uid = auth.uid());
$$;
create or replace function public.kq_in_room(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_players where room_pin = p_pin and user_id = auth.uid());
$$;

-- ---------- Row Level Security ----------
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_keys    enable row level security;
alter table public.room_players enable row level security;
alter table public.room_roster  enable row level security;
alter table public.answers      enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
-- Profil ditulis lewat kq_sync_profile

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to authenticated using (true);
-- room_keys: sengaja tanpa policy (tidak bisa dibaca/ditulis klien)

drop policy if exists players_read on public.room_players;
create policy players_read on public.room_players for select to authenticated
  using (public.kq_is_host(room_pin) or public.kq_in_room(room_pin));

drop policy if exists roster_read on public.room_roster;
create policy roster_read on public.room_roster for select to authenticated using (public.kq_is_host(room_pin));

drop policy if exists answers_read on public.answers;
create policy answers_read on public.answers for select to authenticated
  using (user_id = auth.uid() or public.kq_is_host(room_pin));

-- Hak akses kolom: NIM di profiles tidak bisa dibaca siapa pun lewat API
revoke all on public.profiles, public.rooms, public.room_keys, public.room_players, public.room_roster, public.answers from anon, authenticated;
grant select (user_id, nickname, class_code, avatar, xp, level, badges, games, best_score, day_streak, updated_at)
  on public.profiles to authenticated;
grant select on public.rooms, public.room_players, public.room_roster, public.answers to authenticated;

-- ---------- Fungsi profil ----------
-- XP dihitung di perangkat (mode offline), jadi server hanya menyimpan salinannya untuk peringkat kelas.
create or replace function public.kq_sync_profile(
  p_student_id text, p_nickname text, p_class text, p_avatar text,
  p_xp integer, p_level integer, p_badges jsonb, p_games integer, p_best_score integer, p_day_streak integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_class is null or p_class !~ '^[A-Z0-9-]{2,16}$' then raise exception 'BAD_CLASS'; end if;
  insert into profiles (user_id, student_id, nickname, class_code, avatar, xp, level, badges, games, best_score, day_streak, updated_at)
  values (auth.uid(), left(coalesce(p_student_id, ''), 24), left(coalesce(p_nickname, ''), 24), p_class,
          left(coalesce(p_avatar, '🙂'), 8), greatest(coalesce(p_xp, 0), 0), coalesce(p_level, 1),
          case when jsonb_typeof(p_badges) = 'array' then p_badges else '[]'::jsonb end,
          coalesce(p_games, 0), coalesce(p_best_score, 0), coalesce(p_day_streak, 0), now())
  on conflict (user_id) do update
    set student_id = excluded.student_id, nickname = excluded.nickname, class_code = excluded.class_code,
        avatar = excluded.avatar, xp = excluded.xp, level = excluded.level, badges = excluded.badges,
        games = excluded.games, best_score = excluded.best_score, day_streak = excluded.day_streak,
        updated_at = now();
end;
$$;

-- ---------- Fungsi permainan ----------
create or replace function public.kq_create_room(
  p_class text, p_material text, p_path text, p_title text,
  p_questions jsonb, p_key integer[], p_expl jsonb,
  p_times integer[], p_hots boolean[], p_perm jsonb, p_sections jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  v_pin text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_class is null or p_class !~ '^[A-Z0-9-]{2,16}$' then raise exception 'BAD_CLASS'; end if;
  n := coalesce(jsonb_array_length(p_questions), 0);
  if n < 1 or n > 200
     or coalesce(array_length(p_key, 1), 0) <> n
     or coalesce(array_length(p_times, 1), 0) <> n
     or coalesce(array_length(p_hots, 1), 0) <> n
     or jsonb_array_length(p_perm) <> n
     or exists (select 1 from unnest(p_key) k where k is null or k < 0 or k > 3)
     or exists (select 1 from unnest(p_times) t where t is null or t < 5 or t > 300)
  then raise exception 'BAD_QUIZ'; end if;
  if (select count(*) from rooms where host_uid = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'RATE_LIMIT';
  end if;
  loop
    v_pin := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from rooms where pin = v_pin);
  end loop;
  insert into rooms (pin, host_uid, class_code, material_id, material_path, title, q_count, times, hots, perm, questions, sections)
  values (v_pin, auth.uid(), p_class, left(coalesce(p_material, 'materi'), 80), left(p_path, 300), left(p_title, 200),
          n, p_times, p_hots, p_perm, p_questions, coalesce(p_sections, '{}'::jsonb));
  insert into room_keys (pin, key, expl) values (v_pin, p_key, coalesce(p_expl, '[]'::jsonb));
  return v_pin;
end;
$$;

create or replace function public.kq_join_room(
  p_pin text, p_student_id text, p_nickname text, p_avatar text, p_class text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from rooms where pin = p_pin;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if r.status in ('final', 'closed') then raise exception 'ROOM_CLOSED'; end if;
  if not exists (select 1 from room_players where room_pin = p_pin and user_id = auth.uid())
     and (select count(*) from room_players where room_pin = p_pin) >= 200 then
    raise exception 'ROOM_FULL';
  end if;
  insert into room_players (room_pin, user_id, nickname, avatar, class_code)
  values (p_pin, auth.uid(), left(coalesce(p_nickname, ''), 24), left(coalesce(p_avatar, '🙂'), 8), left(coalesce(p_class, ''), 16))
  on conflict (room_pin, user_id) do update
    set nickname = excluded.nickname, avatar = excluded.avatar, class_code = excluded.class_code;
  insert into room_roster (room_pin, user_id, student_id)
  values (p_pin, auth.uid(), left(coalesce(p_student_id, ''), 24))
  on conflict (room_pin, user_id) do update set student_id = excluded.student_id;
  return jsonb_build_object('material_id', r.material_id, 'title', r.title, 'q_count', r.q_count, 'server_now', now());
end;
$$;

create or replace function public.kq_host_advance(p_pin text, p_status text, p_q integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kq_is_host(p_pin) then raise exception 'NOT_HOST'; end if;
  if p_status not in ('lobby', 'intro', 'question', 'result', 'board', 'final', 'closed') then raise exception 'BAD_QUIZ'; end if;
  update rooms
     set status = p_status,
         q_index = p_q,
         q_started_at = case when p_status = 'question' then now() else q_started_at end,
         updated_at = now()
   where pin = p_pin;
end;
$$;

create or replace function public.kq_submit_answer(p_pin text, p_q integer, p_choice integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype;
  pl room_players%rowtype;
  k integer;
  t integer;
  dt double precision;
  ok boolean;
  st integer;
  base integer := 0;
  bonus integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'BAD_QUIZ'; end if;
  select * into r from rooms where pin = p_pin;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if r.status <> 'question' or r.q_index <> p_q then raise exception 'NOT_ACCEPTING'; end if;
  select * into pl from room_players where room_pin = p_pin and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_JOINED'; end if;
  if exists (select 1 from answers where room_pin = p_pin and q_index = p_q and user_id = auth.uid()) then
    raise exception 'ALREADY_ANSWERED';
  end if;
  t := r.times[p_q + 1];
  dt := extract(epoch from (now() - r.q_started_at));
  if dt > t + 1.5 then raise exception 'TIME_UP'; end if;   -- toleransi jeda jaringan
  dt := least(greatest(dt, 0), t);
  select key[p_q + 1] into k from room_keys where pin = p_pin;
  ok := (k = p_choice);
  -- Beruntun hanya berlanjut bila soal sebelumnya dijawab benar
  st := case when not ok then 0 when pl.last_q = p_q - 1 then pl.streak + 1 else 1 end;
  if ok then
    base := round((1 - (dt / t) / 2) * 1000)::int * (case when r.hots[p_q + 1] then 2 else 1 end);
    bonus := case when st > 1 then least(st - 1, 5) * 100 else 0 end;
  end if;
  insert into answers (room_pin, q_index, user_id, choice, is_correct, points)
  values (p_pin, p_q, auth.uid(), p_choice, ok, base + bonus);
  update room_players
     set score = score + base + bonus,
         correct = correct + (case when ok then 1 else 0 end),
         answered = answered + 1,
         streak = st,
         best_streak = greatest(best_streak, st),
         last_q = case when ok then p_q else -2 end
   where room_pin = p_pin and user_id = auth.uid();
  return jsonb_build_object('correct', ok, 'points', base + bonus, 'streak', st, 'bonus', bonus);
end;
$$;

-- Kunci & pembahasan: pemandu mendapat semua; peserta hanya soal yang sudah ditutup
create or replace function public.kq_room_reveal(p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r rooms%rowtype;
  rk room_keys%rowtype;
  host boolean;
  upto integer;
  keys jsonb := '[]'::jsonb;
  expl jsonb := '[]'::jsonb;
  i integer;
begin
  select * into r from rooms where pin = p_pin;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  host := public.kq_is_host(p_pin);
  if not host and not public.kq_in_room(p_pin) then raise exception 'NOT_JOINED'; end if;
  select * into rk from room_keys where pin = p_pin;
  upto := case
    when host or r.status in ('final', 'closed') then r.q_count - 1
    when r.status in ('result', 'board') then r.q_index
    else r.q_index - 1
  end;
  for i in 0 .. r.q_count - 1 loop
    if i <= upto then
      keys := keys || to_jsonb(rk.key[i + 1]);
      expl := expl || coalesce(rk.expl -> i, '""'::jsonb);
    else
      keys := keys || 'null'::jsonb;
      expl := expl || 'null'::jsonb;
    end if;
  end loop;
  return jsonb_build_object('key', keys, 'expl', expl);
end;
$$;

revoke all on function public.kq_sync_profile(text, text, text, text, integer, integer, jsonb, integer, integer, integer) from public, anon;
grant execute on function public.kq_sync_profile(text, text, text, text, integer, integer, jsonb, integer, integer, integer) to authenticated;
revoke all on function public.kq_create_room(text, text, text, text, jsonb, integer[], jsonb, integer[], boolean[], jsonb, jsonb) from public, anon;
revoke all on function public.kq_join_room(text, text, text, text, text) from public, anon;
revoke all on function public.kq_host_advance(text, text, integer) from public, anon;
revoke all on function public.kq_submit_answer(text, integer, integer) from public, anon;
revoke all on function public.kq_room_reveal(text) from public, anon;
grant execute on function public.kq_create_room(text, text, text, text, jsonb, integer[], jsonb, integer[], boolean[], jsonb, jsonb) to authenticated;
grant execute on function public.kq_join_room(text, text, text, text, text) to authenticated;
grant execute on function public.kq_host_advance(text, text, integer) to authenticated;
grant execute on function public.kq_submit_answer(text, integer, integer) to authenticated;
grant execute on function public.kq_room_reveal(text) to authenticated;
grant execute on function public.kq_is_host(text), public.kq_in_room(text) to authenticated;

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['rooms', 'room_players', 'answers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
