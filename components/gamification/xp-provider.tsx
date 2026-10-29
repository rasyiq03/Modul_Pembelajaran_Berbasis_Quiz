'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/supabase/auth-provider';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { useToast } from '@/hooks/use-toast';
import { BADGE, levelOf, levelName } from '@/lib/gamification';

type Gain = { xp?: number; total?: number; badges?: string[]; label?: string };

type XpContextValue = {
  /** Total XP pengguna terdaftar; null untuk tamu atau saat belum dimuat */
  xp: number | null;
  refresh: () => Promise<void>;
  /** Tampilkan toast XP/naik level/lencana dari hasil RPC dan perbarui total */
  announce: (gain: Gain) => void;
};

const XpContext = createContext<XpContextValue>({ xp: null, refresh: async () => {}, announce: () => {} });

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

export function XpProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [xp, setXp] = useState<number | null>(null);
  const registered = !!user && !user.is_anonymous && !!profile;
  const uid = registered ? user!.id : null;

  const refresh = useCallback(async () => {
    if (!uid) return setXp(null);
    const { data } = await getSupabaseBrowser().rpc('get_my_progress');
    setXp(data ? Number(data.xp) : null);
  }, [uid]);

  const announce = useCallback((g: Gain) => {
    const gained = Number(g.xp ?? 0);
    if (g.total != null) {
      const total = Number(g.total);
      setXp(total);
      if (gained > 0) {
        toast({ title: `+${gained} XP`, description: g.label });
        const before = levelOf(total - gained), after = levelOf(total);
        if (after > before) toast({ title: `Naik level! Lv ${after}`, description: `Gelar baru: ${levelName(after)}` });
      }
    }
    for (const id of g.badges ?? []) {
      const b = BADGE[id];
      if (b) toast({ title: `${b.icon} Lencana baru: ${b.name}`, description: b.desc });
    }
  }, [toast]);

  /* Hadir hari ini: sekali per hari per pengguna di perangkat ini (server tetap menjaga sekali sehari) */
  useEffect(() => {
    if (!uid) { setXp(null); return; }
    let stop = false;
    (async () => {
      const key = `kk:checkin:${uid}`;
      let done = false;
      try { done = localStorage.getItem(key) === today(); } catch { /* penyimpanan diblokir */ }
      if (!done) {
        const { data } = await getSupabaseBrowser().rpc('daily_checkin');
        if (stop) return;
        if (data?.ok) {
          try { localStorage.setItem(key, today()); } catch { /* abaikan */ }
          announce({ xp: data.xp, total: data.total, badges: data.badges, label: data.streak && data.streak > 1 ? `Hadir ${data.streak} hari berturut-turut` : 'Hadir hari ini' });
          return;
        }
      }
      await refresh();
    })();
    return () => { stop = true; };
  }, [uid, refresh, announce]);

  const value = useMemo(() => ({ xp, refresh, announce }), [xp, refresh, announce]);
  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

export const useXp = () => useContext(XpContext);
