/*
  0500 · Langganan menggantikan enrollment key per materi.

  - Setiap materi punya tingkat akses (materials.access_level):
      public      siapa saja, termasuk tamu, membaca materi lengkap
      member      pengguna terdaftar (login dengan akun, bukan tamu anonim)
      subscriber  pengguna dengan langganan aktif (bawaan)
    Admin selalu bisa membaca semua materi. Yang belum berhak melihat pratinjau.
  - Satu langganan membuka semua materi berlevel "subscriber". Pengguna mengajukan langganan
    (request_subscription), lalu admin menyetujui dengan masa berlaku opsional, menolak, mengubah
    masa berlaku, atau mencabut. Tabel hanya bisa dibaca; semua perubahan lewat fungsi di bawah.
  - Aturan akses ada di satu tempat, can_read_material(materi, pengguna). Halaman memanggilnya lewat
    has_material_access() dan route pembaca /m lewat service role, jadi keduanya tidak bisa berbeda.
  - Enrollment aktif dipindahkan menjadi pengajuan yang menunggu persetujuan, lalu tabel dan fungsi
    enrollment key dihapus.
*/

-- ========== Tingkat akses per materi ==========
alter table public.materials add column if not exists access_level text not null default 'subscriber';
alter table public.materials drop constraint if exists materials_access_level_check;
alter table public.materials add constraint materials_access_level_check
  check (access_level in ('public', 'member', 'subscriber'));

-- ========== subscriptions ==========
/* Satu baris per pengajuan. Status "active" yang expires_at-nya sudah lewat dianggap kedaluwarsa.
   reviewed_at = waktu keputusan admin terakhir (disetujui, ditolak, atau dicabut). */
create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'active', 'rejected', 'revoked', 'cancelled')),
  message     text check (char_length(message) <= 500),
  admin_note  text check (char_length(admin_note) <= 500),
  expires_at  timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
/* Paling banyak satu pengajuan menunggu per pengguna */
create unique index if not exists subscriptions_one_pending on public.subscriptions(user_id) where status = 'pending';
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, status);
create index if not exists subscriptions_status_idx on public.subscriptions(status, created_at desc);
drop policy if exists subscriptions_self_or_admin on public.subscriptions;
create policy subscriptions_self_or_admin on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop trigger if exists set_updated_at on public.subscriptions;
create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ========== Aturan akses ==========
create or replace function public._subscription_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s
                  where s.user_id = p_user and s.status = 'active'
                    and (s.expires_at is null or s.expires_at > now()));
$$;
revoke execute on function public._subscription_active(uuid) from public, anon, authenticated;

/* Boleh membaca materi lengkap? Tamu = p_user null. Hanya untuk server (service role). */
create or replace function public.can_read_material(p_material uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then true
      when m.status <> 'published' or c.status <> 'published' then false
      when m.access_level = 'public' then true
      when m.access_level = 'member' then exists (select 1 from public.profiles p where p.id = p_user)
      else public._subscription_active(p_user)
    end
    from public.materials m join public.courses c on c.id = m.course_id
    where m.id = p_material), false);
$$;
revoke execute on function public.can_read_material(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_read_material(uuid, uuid) to service_role;

/* Untuk pengguna yang sedang login (atau tamu): dipanggil halaman materi */
create or replace function public.has_material_access(p_material uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_read_material(p_material, auth.uid());
$$;
revoke execute on function public.has_material_access(uuid) from public;
grant execute on function public.has_material_access(uuid) to anon, authenticated;

-- ========== Pengajuan oleh pengguna ==========
create or replace function public.request_subscription(p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'login_required');
  end if;
  if exists (select 1 from public.subscriptions where user_id = auth.uid() and status = 'pending') then
    return jsonb_build_object('ok', false, 'error', 'already_pending');
  end if;
  /* Langganan tanpa batas waktu tidak perlu diperpanjang; yang berbatas boleh diajukan ulang */
  if exists (select 1 from public.subscriptions where user_id = auth.uid() and status = 'active' and expires_at is null) then
    return jsonb_build_object('ok', false, 'error', 'already_active');
  end if;
  insert into public.subscriptions (user_id, message)
  values (auth.uid(), nullif(left(btrim(coalesce(p_message, '')), 500), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'already_pending');
end;
$$;

create or replace function public.cancel_subscription_request()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.subscriptions set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  return jsonb_build_object('ok', found);
end;
$$;

revoke execute on function public.request_subscription(text), public.cancel_subscription_request() from public, anon;
grant execute on function public.request_subscription(text), public.cancel_subscription_request() to authenticated;

-- ========== Keputusan admin ==========
/* Setujui (dengan masa berlaku opsional) atau tolak pengajuan yang menunggu. Saat perpanjangan
   disetujui, langganan aktif yang lama diakhiri sekarang agar setiap pengguna punya satu langganan aktif. */
create or replace function public.review_subscription(
  p_id uuid, p_approve boolean, p_expires_at timestamptz default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_approve and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'BAD_SUBSCRIPTION: masa berlaku harus setelah hari ini';
  end if;
  update public.subscriptions
     set status = case when p_approve then 'active' else 'rejected' end,
         expires_at = case when p_approve then p_expires_at end,
         admin_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending'
  returning user_id into v_user;
  if v_user is null then raise exception 'BAD_SUBSCRIPTION: pengajuan ini sudah ditinjau atau dibatalkan'; end if;
  if p_approve then
    update public.subscriptions set expires_at = now()
     where user_id = v_user and id <> p_id and status = 'active' and (expires_at is null or expires_at > now());
  end if;
  insert into public.audit_logs (actor_id, action, target, detail)
  values (auth.uid(), case when p_approve then 'approve_subscription' else 'reject_subscription' end, p_id::text,
          jsonb_build_object('user_id', v_user, 'expires_at', p_expires_at));
end;
$$;

/* Ubah masa berlaku langganan yang disetujui (juga untuk mengaktifkan lagi yang sudah kedaluwarsa) */
create or replace function public.set_subscription_expiry(p_id uuid, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'BAD_SUBSCRIPTION: masa berlaku harus setelah hari ini';
  end if;
  update public.subscriptions set expires_at = p_expires_at where id = p_id and status = 'active';
  if not found then raise exception 'BAD_SUBSCRIPTION: langganan ini tidak aktif'; end if;
  insert into public.audit_logs (actor_id, action, target, detail)
  values (auth.uid(), 'set_subscription_expiry', p_id::text, jsonb_build_object('expires_at', p_expires_at));
end;
$$;

create or replace function public.revoke_subscription(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.subscriptions
     set status = 'revoked',
         admin_note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), admin_note),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'active';
  if not found then raise exception 'BAD_SUBSCRIPTION: langganan ini tidak aktif'; end if;
  insert into public.audit_logs (actor_id, action, target) values (auth.uid(), 'revoke_subscription', p_id::text);
end;
$$;

revoke execute on function public.review_subscription(uuid, boolean, timestamptz, text),
  public.set_subscription_expiry(uuid, timestamptz), public.revoke_subscription(uuid, text) from public, anon;
grant execute on function public.review_subscription(uuid, boolean, timestamptz, text),
  public.set_subscription_expiry(uuid, timestamptz), public.revoke_subscription(uuid, text) to authenticated;

-- ========== Hapus enrollment key ==========
/* Pemegang enrollment aktif menjadi pengajuan langganan. Tidak langsung aktif, karena langganan
   membuka lebih banyak materi daripada satu key; admin cukup menyetujuinya di Admin → Langganan. */
do $$
begin
  if to_regclass('public.enrollments') is not null then
    insert into public.subscriptions (user_id, message)
    select e.user_id, 'Dipindahkan dari enrollment key (' || count(*) || ' materi).'
      from public.enrollments e
     where not e.revoked
       and not exists (select 1 from public.subscriptions s where s.user_id = e.user_id and s.status in ('pending', 'active'))
     group by e.user_id
    on conflict do nothing;
  end if;
end $$;

drop function if exists public.redeem_enrollment_key(text);
drop function if exists public.create_enrollment_key(uuid, timestamptz, int, text);
drop function if exists public.set_enrollment_revoked(uuid, boolean);
drop function if exists public.normalize_key(text);
drop table if exists public.enrollment_redemptions;
drop table if exists public.enrollments;
drop table if exists public.enrollment_keys;
