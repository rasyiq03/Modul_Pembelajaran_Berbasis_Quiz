/*
  0100 · Inti platform: profil & role, mata kuliah, materi, enrollment key, Storage.

  Prinsip keamanan
  - RLS aktif di semua tabel. Penulisan yang butuh aturan (tukar key, buat key) hanya lewat fungsi
    SECURITY DEFINER dengan search_path tetap.
  - HTML materi TIDAK disimpan di tabel. Preview dan materi lengkap ada di bucket Storage privat dan
    hanya disajikan oleh route server (web/app/m/...) setelah akses diperiksa.
  - Role admin tidak bisa diambil sendiri: grant_admin() hanya bisa dijalankan dari SQL Editor
    (role postgres) atau service role.
  - Pengguna anonim (tamu kuis, KuisKelas Online) tidak dibuatkan profil platform.
*/

create extension if not exists pgcrypto;

-- ========== profiles ==========
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text check (char_length(display_name) <= 80),
  role         text not null default 'student' check (role in ('student', 'admin')),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
/* anon ikut diberi izin karena kebijakan RLS katalog memanggilnya (hasilnya selalu false tanpa login) */
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

/* Tamu (login anonim) bukan pengguna terdaftar */
create or replace function public.is_registered()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;
revoke execute on function public.is_registered() from public;
grant execute on function public.is_registered() to anon, authenticated;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;   -- tamu kuis / KuisKelas Online: tanpa profil platform
  end if;
  insert into public.profiles (id, email, display_name)
  values (new.id, lower(new.email),
          left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* Tamu yang kemudian mendaftar (anonim → email) mendapat profil saat itu */
drop trigger if exists on_auth_user_registered on auth.users;
create trigger on_auth_user_registered
  after update of is_anonymous on auth.users
  for each row when (old.is_anonymous and not new.is_anonymous)
  execute function public.handle_new_user();

/* Jalankan dari SQL Editor: select public.grant_admin('email@kampus.ac.id'); */
create or replace function public.grant_admin(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where email = lower(trim(p_email));
  if v_id is null then raise exception 'Profil dengan email % belum ada. Daftar dulu lewat web.', p_email; end if;
  update public.profiles set role = 'admin' where id = v_id;
  insert into public.audit_logs (actor_id, action, target) values (null, 'grant_admin', lower(trim(p_email)));
  return 'admin: ' || lower(trim(p_email));
end;
$$;
revoke execute on function public.grant_admin(text) from public, anon, authenticated;

/* Admin dapat mengubah role pengguna lain (tidak bisa menurunkan dirinya sendiri) */
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('student', 'admin') then raise exception 'BAD_ROLE'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'CANNOT_DEMOTE_SELF'; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_logs (actor_id, action, target, detail)
  values (auth.uid(), 'set_user_role', p_user::text, jsonb_build_object('role', p_role));
end;
$$;
revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ========== audit_logs ==========
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  target     text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_admin_select on public.audit_logs for select to authenticated using (public.is_admin());

-- ========== courses ==========
create table if not exists public.courses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description   text,
  cover_url     text,
  status        text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.courses enable row level security;
revoke all on public.courses from anon, authenticated;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
drop policy if exists courses_public_select on public.courses;
create policy courses_public_select on public.courses
  for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists courses_admin_write on public.courses;
create policy courses_admin_write on public.courses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ========== materials ==========
/* preview_path / content_path: folder di bucket "materials" (mis. "<id>/preview", "<id>/full")
   yang berisi index.html dan aset. Nilainya tidak rahasia; isinya hanya bisa diambil route server. */
create table if not exists public.materials (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses(id) on delete cascade,
  title               text not null,
  slug                text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description         text,
  learning_objectives text,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order       int not null default 0,
  thumbnail_url       text,
  preview_path        text,
  content_path        text,
  content_assets      jsonb not null default '[]'::jsonb,
  source_file         text,          -- asal file di repo (mis. "Statistika & Probabilitas/stat-04-diagram-pohon.html")
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (course_id, slug)
);
alter table public.materials enable row level security;
revoke all on public.materials from anon, authenticated;
grant select on public.materials to anon, authenticated;
grant insert, update, delete on public.materials to authenticated;
create index if not exists materials_course_idx on public.materials(course_id);
create index if not exists materials_status_idx on public.materials(status);
/* Materi publik hanya bila mata kuliahnya juga terpublikasi */
drop policy if exists materials_public_select on public.materials;
create policy materials_public_select on public.materials
  for select to anon, authenticated
  using (public.is_admin() or (status = 'published'
         and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')));
drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.material_tags (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  tag         text not null,
  unique (material_id, tag)
);
alter table public.material_tags enable row level security;
revoke all on public.material_tags from anon, authenticated;
grant select on public.material_tags to anon, authenticated;
grant insert, update, delete on public.material_tags to authenticated;
create index if not exists material_tags_material_idx on public.material_tags(material_id);
drop policy if exists material_tags_select on public.material_tags;
create policy material_tags_select on public.material_tags
  for select to anon, authenticated using (exists (select 1 from public.materials m where m.id = material_id));
drop policy if exists material_tags_admin_write on public.material_tags;
create policy material_tags_admin_write on public.material_tags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ========== enrollment ==========
create table if not exists public.enrollment_keys (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  key_hash    text not null unique,
  key_prefix  text not null,
  expires_at  timestamptz,
  max_uses    int check (max_uses is null or max_uses > 0),
  uses_count  int not null default 0,
  revoked     boolean not null default false,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.enrollment_keys enable row level security;
revoke all on public.enrollment_keys from anon, authenticated;
grant select, update (revoked, note, expires_at, max_uses) on public.enrollment_keys to authenticated;
create index if not exists enrollment_keys_material_idx on public.enrollment_keys(material_id);
drop policy if exists enrollment_keys_admin_select on public.enrollment_keys;
create policy enrollment_keys_admin_select on public.enrollment_keys for select to authenticated using (public.is_admin());
drop policy if exists enrollment_keys_admin_update on public.enrollment_keys;
create policy enrollment_keys_admin_update on public.enrollment_keys
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,   -- hanya pengguna terdaftar
  material_id uuid not null references public.materials(id) on delete cascade,
  source      text not null default 'key',
  key_id      uuid references public.enrollment_keys(id) on delete set null,
  revoked     boolean not null default false,
  revoked_at  timestamptz,
  revoked_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, material_id)
);
alter table public.enrollments enable row level security;
revoke all on public.enrollments from anon, authenticated;
grant select on public.enrollments to authenticated;
create index if not exists enrollments_material_idx on public.enrollments(material_id);
drop policy if exists enrollments_self_select on public.enrollments;
create policy enrollments_self_select on public.enrollments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table if not exists public.enrollment_redemptions (
  id          uuid primary key default gen_random_uuid(),
  key_id      uuid not null references public.enrollment_keys(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.enrollment_redemptions enable row level security;
revoke all on public.enrollment_redemptions from anon, authenticated;
grant select on public.enrollment_redemptions to authenticated;
create index if not exists redemptions_key_idx on public.enrollment_redemptions(key_id);
drop policy if exists redemptions_self_or_admin on public.enrollment_redemptions;
create policy redemptions_self_or_admin on public.enrollment_redemptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

/* Akses materi lengkap: admin, atau enrollment aktif pada materi itu */
create or replace function public.has_material_access(p_material uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.enrollments e
    where e.material_id = p_material and e.user_id = auth.uid() and not e.revoked);
$$;
revoke execute on function public.has_material_access(uuid) from public, anon;
grant execute on function public.has_material_access(uuid) to authenticated;

create or replace function public.normalize_key(p text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

/* Admin membuat key; teks key hanya dikembalikan sekali, yang disimpan hanya hash-nya */
create or replace function public.create_enrollment_key(
  p_material uuid, p_expires_at timestamptz default null, p_max_uses int default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw text := '';
  b bytea := gen_random_bytes(12);
  i int;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if not exists (select 1 from public.materials where id = p_material) then raise exception 'MATERIAL_NOT_FOUND'; end if;
  for i in 0..11 loop
    raw := raw || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  insert into public.enrollment_keys (material_id, key_hash, key_prefix, expires_at, max_uses, note, created_by)
  values (p_material, encode(digest(raw, 'sha256'), 'hex'), left(raw, 4), p_expires_at, p_max_uses, p_note, auth.uid())
  returning id into v_id;
  insert into public.audit_logs (actor_id, action, target) values (auth.uid(), 'create_enrollment_key', v_id::text);
  return jsonb_build_object('id', v_id, 'key', substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4));
end;
$$;
revoke execute on function public.create_enrollment_key(uuid, timestamptz, int, text) from public, anon;
grant execute on function public.create_enrollment_key(uuid, timestamptz, int, text) to authenticated;

/* Tukar key → enrollment. Atomik (baris key dikunci), tidak menghabiskan kuota bila sudah terdaftar,
   dan tidak memulihkan enrollment yang dicabut admin. */
create or replace function public.redeem_enrollment_key(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key public.enrollment_keys%rowtype;
  v_enr public.enrollments%rowtype;
  v_title text;
begin
  if not public.is_registered() then return jsonb_build_object('ok', false, 'error', 'login_required'); end if;
  select * into v_key from public.enrollment_keys
   where key_hash = encode(digest(public.normalize_key(p_key), 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_key'); end if;
  select title into v_title from public.materials where id = v_key.material_id;
  select * into v_enr from public.enrollments where user_id = auth.uid() and material_id = v_key.material_id;
  if found and not v_enr.revoked then
    return jsonb_build_object('ok', true, 'already', true, 'material_id', v_key.material_id, 'material_title', v_title);
  end if;
  if found and v_enr.revoked then return jsonb_build_object('ok', false, 'error', 'enrollment_revoked'); end if;
  if v_key.revoked then return jsonb_build_object('ok', false, 'error', 'revoked'); end if;
  if v_key.expires_at is not null and v_key.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if v_key.max_uses is not null and v_key.uses_count >= v_key.max_uses then return jsonb_build_object('ok', false, 'error', 'exhausted'); end if;
  insert into public.enrollments (user_id, material_id, source, key_id) values (auth.uid(), v_key.material_id, 'key', v_key.id);
  update public.enrollment_keys set uses_count = uses_count + 1 where id = v_key.id;
  insert into public.enrollment_redemptions (key_id, user_id, material_id) values (v_key.id, auth.uid(), v_key.material_id);
  return jsonb_build_object('ok', true, 'material_id', v_key.material_id, 'material_title', v_title);
end;
$$;
revoke execute on function public.redeem_enrollment_key(text) from public, anon;
grant execute on function public.redeem_enrollment_key(text) to authenticated;

/* FR-25: admin mencabut / memulihkan akses pengguna tertentu */
create or replace function public.set_enrollment_revoked(p_enrollment uuid, p_revoked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.enrollments
     set revoked = p_revoked,
         revoked_at = case when p_revoked then now() end,
         revoked_by = case when p_revoked then auth.uid() end
   where id = p_enrollment;
  insert into public.audit_logs (actor_id, action, target, detail)
  values (auth.uid(), 'set_enrollment_revoked', p_enrollment::text, jsonb_build_object('revoked', p_revoked));
end;
$$;
revoke execute on function public.set_enrollment_revoked(uuid, boolean) from public, anon;
grant execute on function public.set_enrollment_revoked(uuid, boolean) to authenticated;

-- ========== Storage ==========
/* Satu bucket privat. Admin mengunggah lewat klien; pembaca mengambil lewat route server
   (service role) setelah memeriksa akses, sehingga isi lengkap tidak pernah punya URL publik. */
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;

drop policy if exists materials_admin_read on storage.objects;
create policy materials_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'materials' and public.is_admin());
drop policy if exists materials_admin_insert on storage.objects;
create policy materials_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'materials' and public.is_admin());
drop policy if exists materials_admin_update on storage.objects;
create policy materials_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'materials' and public.is_admin());
drop policy if exists materials_admin_delete on storage.objects;
create policy materials_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'materials' and public.is_admin());

-- ========== updated_at ==========
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'courses', 'materials'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
