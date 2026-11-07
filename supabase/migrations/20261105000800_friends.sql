/*
  0800 · Teman: kode teman, permintaan pertemanan, dan papan peringkat Arena antar teman.

  - Setiap profil punya friend_code (8 karakter tanpa huruf/angka yang mirip, mis. O/0, I/1).
    Pengguna menambah teman lewat kode itu, bukan lewat pencarian email, sehingga email dan daftar
    pengguna tidak bisa ditebak.
  - friendships: satu baris per pasangan (requester → addressee), pending lalu accepted. Menolak,
    membatalkan, atau menghapus teman = menghapus barisnya. Bila dua orang saling mengirim permintaan,
    permintaan kedua langsung menerima yang pertama.
  - Teman hanya melihat nama tampilan dan statistik Arena satu sama lain (tidak ada email).
  - Semua perubahan lewat fungsi; tabel hanya bisa dibaca oleh kedua pihak.
*/

-- ========== Kode teman ==========
create or replace function public._new_friend_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_chars, 1 + (get_byte(b, i) % length(v_chars)), 1), '')
      into v_code
      from (select gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
    exit when not exists (select 1 from public.profiles where friend_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke execute on function public._new_friend_code() from public, anon, authenticated;

alter table public.profiles add column if not exists friend_code text;
update public.profiles set friend_code = public._new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default public._new_friend_code();
alter table public.profiles alter column friend_code set not null;
create unique index if not exists profiles_friend_code_key on public.profiles(friend_code);

-- ========== Pertemanan ==========
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> addressee_id)
);
/* Satu baris per pasangan, ke arah mana pun */
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists friendships_parties on public.friendships;
create policy friendships_parties on public.friendships
  for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

/* Id teman (sudah diterima) seorang pengguna */
create or replace function public._friend_ids(p_user uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when requester_id = p_user then addressee_id else requester_id end
    from friendships where status = 'accepted' and (requester_id = p_user or addressee_id = p_user);
$$;
revoke execute on function public._friend_ids(uuid) from public, anon, authenticated;

/* Kirim permintaan lewat kode teman */
create or replace function public.send_friend_request(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_other profiles%rowtype;
  v_f friendships%rowtype;
begin
  if not public.is_registered() or not exists (select 1 from profiles where id = v_me) then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_other from profiles where friend_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then raise exception 'FRIEND_CODE_NOT_FOUND'; end if;
  if v_other.id = v_me then raise exception 'FRIEND_SELF'; end if;

  select * into v_f from friendships
   where least(requester_id, addressee_id) = least(v_me, v_other.id)
     and greatest(requester_id, addressee_id) = greatest(v_me, v_other.id);
  if found then
    if v_f.status = 'accepted' then raise exception 'ALREADY_FRIENDS'; end if;
    if v_f.requester_id = v_me then raise exception 'REQUEST_PENDING'; end if;
    /* Dia sudah lebih dulu mengirim permintaan: langsung berteman */
    update friendships set status = 'accepted', accepted_at = now() where id = v_f.id;
    return jsonb_build_object('status', 'accepted', 'name', v_other.display_name);
  end if;

  if (select count(*) from friendships where requester_id = v_me and status = 'pending') >= 50 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into friendships (requester_id, addressee_id) values (v_me, v_other.id);
  return jsonb_build_object('status', 'pending', 'name', v_other.display_name);
end;
$$;

/* Terima atau tolak permintaan yang masuk */
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update friendships set status = 'accepted', accepted_at = now()
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friendships where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
end;
$$;

/* Batalkan permintaan yang dikirim, atau hapus teman */
create or replace function public.remove_friend(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where id = p_id and (requester_id = auth.uid() or addressee_id = auth.uid());
  if not found then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
end;
$$;

/* Kode temanku, daftar teman beserta ringkasan Arena, dan permintaan masuk/keluar */
create or replace function public.list_friends()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  rel as (
    select f.*, case when f.requester_id = me.id then f.addressee_id else f.requester_id end as other_id,
           f.requester_id = me.id as outgoing
      from friendships f, me where f.requester_id = me.id or f.addressee_id = me.id),
  weekly as (
    select user_id, sum(score) as points, count(*) as runs from arena_runs
     where status = 'finished' and not is_preview and finished_at > now() - interval '7 days'
     group by user_id)
  select jsonb_build_object(
    'code', (select friend_code from profiles where id = (select id from me)),
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'user_id', r.other_id, 'name', p.display_name, 'since', r.accepted_at,
        'week_points', coalesce(w.points, 0), 'week_runs', coalesce(w.runs, 0),
        'total_runs', (select count(*) from arena_runs a where a.user_id = r.other_id and a.status = 'finished' and not a.is_preview),
        'best_score', (select max(score) from arena_runs a where a.user_id = r.other_id and a.status = 'finished' and not a.is_preview))
        order by coalesce(w.points, 0) desc, p.display_name)
      from rel r join profiles p on p.id = r.other_id left join weekly w on w.user_id = r.other_id
      where r.status = 'accepted'), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', p.display_name, 'created_at', r.created_at) order by r.created_at desc)
      from rel r join profiles p on p.id = r.other_id where r.status = 'pending' and not r.outgoing), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', p.display_name, 'created_at', r.created_at) order by r.created_at desc)
      from rel r join profiles p on p.id = r.other_id where r.status = 'pending' and r.outgoing), '[]'::jsonb),
    'me', (select jsonb_build_object('week_points', coalesce(points, 0), 'week_runs', coalesce(runs, 0))
             from (select 1) x left join weekly w on w.user_id = (select id from me)))
  where auth.uid() is not null;
$$;

/* Papan peringkat Arena antara aku dan teman-temanku untuk satu kuis atau satu mata kuliah */
create or replace function public.arena_friends_leaderboard(p_quiz uuid default null, p_course uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'best', t.best, 'runs', t.runs, 'me', t.user_id = auth.uid())
                            order by t.best desc, p.display_name), '[]'::jsonb)
  from (
    select user_id, max(score) as best, count(*) as runs from arena_runs
     where status = 'finished' and not is_preview
       and ((p_quiz is not null and quiz_id = p_quiz) or (p_course is not null and course_id = p_course))
       and (user_id = auth.uid() or user_id in (select public._friend_ids(auth.uid())))
     group by user_id) t
  join profiles p on p.id = t.user_id
  where auth.uid() is not null;
$$;

revoke execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.list_friends(), public.arena_friends_leaderboard(uuid, uuid) from public, anon;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.list_friends(), public.arena_friends_leaderboard(uuid, uuid) to authenticated;
