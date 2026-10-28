import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Klien untuk komponen "use client". Sesi disimpan di cookie (bukan localStorage),
 * sehingga server component, route handler, dan middleware membaca sesi yang sama.
 */
export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as unknown as SupabaseClient<Database>;
  }
  return browserClient;
}
