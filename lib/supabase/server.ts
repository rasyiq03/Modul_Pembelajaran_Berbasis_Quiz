import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/clients';

/* Data Supabase bergantung pada siapa yang login dan bisa berubah kapan saja (mis. langganan
   dicabut), jadi hasil fetch() jangan pernah masuk Data Cache. */
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Klien untuk server component, server action, dan route handler. Membaca sesi dari cookie,
 * jadi query berjalan sebagai pengguna yang login dan RLS berlaku untuknya.
 * cookies() di Next 15 async; @supabase/ssr menerima getAll/setAll async sehingga fungsi ini tetap sinkron.
 */
export function createSupabaseServer(): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { fetch: noStoreFetch },
    cookies: {
      async getAll() {
        return (await cookies()).getAll();
      },
      async setAll(toSet) {
        const cookieStore = await cookies();
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari server component (cookie read-only); middleware yang menyegarkan sesi.
        }
      },
    },
  }) as unknown as SupabaseClient<Database>;
}

/**
 * Klien service role: melewati RLS. Hanya untuk kode server, dan hanya SETELAH akses diperiksa
 * (mis. mengambil isi materi dari bucket privat). Jangan pernah diimpor oleh komponen klien.
 */
export function createSupabaseService(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') throw new Error('createSupabaseService hanya boleh dipakai di server.');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server.');
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
