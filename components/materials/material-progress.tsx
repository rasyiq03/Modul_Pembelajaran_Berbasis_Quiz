'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Circle, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XpBar } from '@/components/gamification/level-parts';
import { useXp } from '@/components/gamification/xp-provider';
import { getSupabaseBrowser } from '@/lib/supabase/clients';
import { cn } from '@/lib/utils';

type Item = { id: string; label: string };
type Progress = { read: string[]; lab: string[] };

type Ctx = {
  materialId: string;
  sections: Item[];
  labs: Item[];
  done: Progress;
  /** Pengguna boleh mendapat XP dari materi ini (terdaftar & membuka materi lengkap) */
  earn: boolean;
  record: (kind: 'read' | 'lab' | 'practice', ref?: string) => Promise<{ ok: boolean; xp?: number }>;
};

const MaterialProgressContext = createContext<Ctx | null>(null);
const useMaterialProgress = () => useContext(MaterialProgressContext);

export function MaterialProgressProvider({ materialId, sections, labs, initial, earn, children }: {
  materialId: string; sections: Item[]; labs: Item[]; initial: Progress; earn: boolean; children: ReactNode;
}) {
  const { announce } = useXp();
  const [done, setDone] = useState<Progress>(initial);

  const record = useCallback(async (kind: 'read' | 'lab' | 'practice', ref?: string) => {
    if (!earn) return { ok: false };
    if (kind !== 'practice') setDone((d) => (d[kind].includes(ref!) ? d : { ...d, [kind]: [...d[kind], ref!] }));
    const { data } = await getSupabaseBrowser().rpc('record_material_progress', { p_material: materialId, p_kind: kind, p_ref: ref ?? null });
    if (data?.ok) {
      const item = (kind === 'read' ? sections : labs).find((x) => x.id === ref);
      announce({
        xp: data.xp, total: data.total, badges: data.badges,
        label: kind === 'read' ? `Bab selesai: ${item?.label ?? ref}` : kind === 'lab' ? `Lab dicoba: ${item?.label ?? ref}` : 'Latihan di materi selesai',
      });
    }
    return { ok: !!data?.ok, xp: data?.xp };
  }, [earn, materialId, sections, labs, announce]);

  const value = useMemo(() => ({ materialId, sections, labs, done, earn, record }), [materialId, sections, labs, done, earn, record]);
  return <MaterialProgressContext.Provider value={value}>{children}</MaterialProgressContext.Provider>;
}

/* Sama dengan header CSP route /m: materi berjalan di origin terisolasi, tanpa akses ke sesi web */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

/**
 * Iframe pembaca + jembatan postMessage ke mesin materi. Iframe ter-sandbox (origin "null"), jadi
 * pesan hanya diterima bila event.source adalah iframe ini; isi pesan tetap divalidasi server.
 */
export function MaterialFrame({ src }: { src: string }) {
  const ctx = useMaterialProgress();
  const ref = useRef<HTMLIFrameElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    function post(msg: object) {
      ref.current?.contentWindow?.postMessage({ source: 'kuiskelas-host', ...msg }, '*');
    }
    async function onMessage(e: MessageEvent) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data;
      if (!d || d.source !== 'kuiskelas' || typeof d.type !== 'string') return;
      const c = ctxRef.current;
      if (d.type === 'ready') {
        post({ type: 'init', earn: !!c?.earn, read: c?.done.read ?? [], labs: c?.done.lab ?? [] });
      } else if ((d.type === 'read' || d.type === 'lab') && typeof d.ref === 'string' && c) {
        const r = await c.record(d.type, d.ref.slice(0, 80));
        post({ type: 'ack', kind: d.type, ref: d.ref, ok: r.ok, xp: r.xp ?? 0 });
      } else if (d.type === 'practice' && c) {
        const r = await c.record('practice');
        post({ type: 'ack', kind: 'practice', ok: r.ok, xp: r.xp ?? 0 });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return <iframe ref={ref} key={src} title="Materi" src={src} className="material-iframe" sandbox={SANDBOX} referrerPolicy="no-referrer" />;
}

/** Daftar bab & lab dengan tanda selesai; diperbarui langsung dari pembaca */
export function MaterialProgressCard() {
  const ctx = useMaterialProgress();
  if (!ctx || (!ctx.sections.length && !ctx.labs.length)) return null;
  const { sections, labs, done, earn } = ctx;
  const total = sections.length + labs.length;
  const n = sections.filter((s) => done.read.includes(s.id)).length + labs.filter((l) => done.lab.includes(l.id)).length;
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Progres belajar</CardTitle>
        <XpBar pct={total ? (n / total) * 100 : 0} className="h-2" />
        <p className="font-heading text-xs font-bold text-muted-foreground">
          {n}/{total} selesai{earn ? ' · tandai bab di materi untuk +20 XP, coba lab untuk +15 XP' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {sections.map((s) => {
              const ok = done.read.includes(s.id);
              return (
                <li key={s.id} className={cn('flex items-start gap-2', ok ? 'text-foreground' : 'text-muted-foreground')}>
                  {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Selesai" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-label="Belum" />}
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {labs.length > 0 && (
          <div className="space-y-1.5">
            <p className="eyebrow">Lab interaktif</p>
            <ul className="space-y-1.5 text-sm">
              {labs.map((l) => {
                const ok = done.lab.includes(l.id);
                return (
                  <li key={l.id} className={cn('flex items-start gap-2', ok ? 'text-foreground' : 'text-muted-foreground')}>
                    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Dicoba" /> : <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-label="Belum dicoba" />}
                    <span>{l.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
