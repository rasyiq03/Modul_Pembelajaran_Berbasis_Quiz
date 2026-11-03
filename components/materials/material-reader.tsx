'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Loader2, Lock, LockOpen,
  Maximize2, Minimize2, PanelRight, Radio,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { BrandMark } from '@/components/site/brand-mark';
import { AccessPanel, type LatestSubscription } from '@/components/subscription/access-panel';
import { ACCESS_LEVEL_HELP, ACCESS_LEVEL_LABEL, fmtDate } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { MaterialAccess } from '@/lib/materials/access';
import type { AccessLevel, QuizMode } from '@/lib/database.types';

/* Sama dengan header CSP route /m: materi berjalan di origin terisolasi, tanpa akses ke sesi web */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

export type ReaderSibling = { slug: string; title: string; level: AccessLevel; locked: boolean };
export type ReaderQuiz = { id: string; title: string; mode: QuizMode; question_count: number };

/**
 * Pembaca materi layar penuh. Materi HTML dirancang untuk memenuhi layar (header, tab, daftar isi
 * sendiri), jadi pembaca hanya menambah satu bilah tipis: kembali, judul, status akses, navigasi
 * antarmateri, dan panel berisi info, kuis, serta daftar materi mata kuliah.
 */
export function MaterialReader({ course, material, access, siblings, quizzes, latest }: {
  course: { slug: string; title: string };
  material: { slug: string; title: string; description: string | null; objectives: string[]; tags: string[]; updatedAt: string; draft: boolean };
  access: MaterialAccess;
  siblings: ReaderSibling[];
  quizzes: ReaderQuiz[];
  latest: LatestSubscription | null;
}) {
  const [panel, setPanel] = useState<'info' | 'access' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fsSupported, setFsSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const here = `/courses/${course.slug}/${material.slug}`;
  const href = (s: ReaderSibling) => `/courses/${course.slug}/${s.slug}`;
  const idx = siblings.findIndex((s) => s.slug === material.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const canUnlock = !access.canRead;

  /* Iframe dipasang setelah hidrasi agar onLoad pasti tertangkap (indikator muat tidak macet) */
  useEffect(() => {
    setMounted(true);
    setFsSupported(typeof document.documentElement.requestFullscreen === 'function');
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => setLoaded(false), [access.readerSrc]);

  const toggleFullscreen = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    p.catch(() => {});
  };

  const navLink = (s: ReaderSibling | null, dir: 'prev' | 'next') => {
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    const label = s ? `${dir === 'prev' ? 'Sebelumnya' : 'Berikutnya'}: ${s.title}` : dir === 'prev' ? 'Ini materi pertama' : 'Ini materi terakhir';
    return s ? (
      <Button asChild variant="ghost" size="icon" className="h-9 w-9">
        <Link href={href(s)} title={label} aria-label={label}><Icon className="h-5 w-5" /></Link>
      </Button>
    ) : (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled title={label} aria-label={label}><Icon className="h-5 w-5" /></Button>
    );
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b-2 border-ink bg-card px-1.5 sm:gap-1.5 sm:px-3">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Link href={`/courses/${course.slug}`} title={`Kembali ke ${course.title}`} aria-label={`Kembali ke ${course.title}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Link href="/" className="hidden shrink-0 no-underline sm:block" aria-label="Beranda StudyStudio"><BrandMark className="h-7 w-7" /></Link>
        <div className="min-w-0 flex-1 px-1 leading-tight">
          <p className="truncate font-heading text-[0.9rem] font-bold text-foreground">{material.title}</p>
          <p className="hidden truncate font-heading text-xs text-muted-foreground sm:block">
            {course.title}{idx >= 0 ? ` · Materi ${idx + 1} dari ${siblings.length}` : ''}
          </p>
        </div>

        {access.showing === 'full' ? (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-success px-2.5 py-0.5 font-heading text-xs font-bold text-success-foreground sm:inline-flex">
            <CheckCircle2 className="h-3.5 w-3.5" /> {material.draft ? 'Draf (admin)' : 'Materi lengkap'}
          </span>
        ) : access.showing === 'preview' ? (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 font-heading text-xs font-bold text-[#1A1A1A] sm:inline-flex" style={{ background: 'hsl(var(--yellow))' }}>
            <Lock className="h-3.5 w-3.5" /> Pratinjau
          </span>
        ) : null}
        {canUnlock && (
          <Button size="sm" className="h-8 shrink-0 px-2.5 sm:px-3" onClick={() => setPanel('access')}>
            <LockOpen className="h-4 w-4" /><span className="ml-1.5 hidden sm:inline">Buka materi lengkap</span><span className="ml-1 sm:hidden">Buka</span>
          </Button>
        )}

        <nav className="hidden items-center md:flex" aria-label="Materi sebelumnya dan berikutnya">
          {navLink(prev, 'prev')}
          {navLink(next, 'next')}
        </nav>
        {fsSupported && (
          <Button variant="ghost" size="icon" className="hidden h-9 w-9 sm:inline-flex" onClick={toggleFullscreen}
            title={fullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'} aria-label={fullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}>
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setPanel('info')} title="Info, kuis, dan daftar materi" aria-label="Buka panel materi">
          <PanelRight className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {access.readerSrc ? (
          <>
            {mounted && (
              <iframe
                key={access.readerSrc}
                title={material.title}
                src={access.readerSrc}
                className="absolute inset-0 h-full w-full border-0"
                sandbox={SANDBOX}
                referrerPolicy="no-referrer"
                allowFullScreen
                onLoad={() => setLoaded(true)}
              />
            )}
            {!loaded && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background" aria-hidden="true">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
              <div className="surface-card space-y-4 p-6">
                <p className="eyebrow">{course.title}</p>
                <h1 className="text-2xl">{material.title}</h1>
                {material.description && <p className="text-muted-foreground">{material.description}</p>}
                {access.canRead ? (
                  <p className="note-box font-heading text-sm">Materi lengkap belum diunggah. Coba lagi nanti.</p>
                ) : (
                  <>
                    <p className="flex items-center gap-2 font-heading text-sm font-bold"><Lock className="h-4 w-4" /> Pratinjau belum tersedia untuk materi ini.</p>
                    <AccessPanel level={access.level} tier={access.tier} here={here} latest={latest} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={panel === 'access'} onOpenChange={(o) => setPanel(o ? 'access' : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buka materi lengkap</DialogTitle>
            <DialogDescription>{material.title} · tingkat akses <b>{ACCESS_LEVEL_LABEL[access.level]}</b></DialogDescription>
          </DialogHeader>
          <AccessPanel level={access.level} tier={access.tier} here={here} latest={latest} />
        </DialogContent>
      </Dialog>

      <Sheet open={panel === 'info'} onOpenChange={(o) => setPanel(o ? 'info' : null)}>
        <SheetContent side="right" className="flex w-[22rem] max-w-full flex-col gap-0 p-0 sm:max-w-sm">
          <div className="border-b-2 border-ink px-5 py-4 pr-12">
            <p className="eyebrow">{course.title}</p>
            <SheetTitle className="mt-1 text-lg leading-snug">{material.title}</SheetTitle>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-2">
              {[prev, next].map((s, i) => (
                s ? (
                  <SheetClose asChild key={i}>
                    <Button asChild variant="outline" size="sm" className={cn('h-auto justify-start whitespace-normal py-2 text-left', i === 1 && 'justify-end text-right')}>
                      <Link href={href(s)}>
                        {i === 0 && <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />}
                        <span className="line-clamp-2 text-xs">{s.title}</span>
                        {i === 1 && <ChevronRight className="ml-1 h-4 w-4 shrink-0" />}
                      </Link>
                    </Button>
                  </SheetClose>
                ) : <span key={i} />
              ))}
            </div>

            <section className="space-y-2">
              <h3 className="eyebrow">Akses</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={access.level === 'public' ? 'secondary' : 'outline'}>{ACCESS_LEVEL_LABEL[access.level]}</Badge>
                <span className="font-heading text-xs font-bold">
                  {access.showing === 'full' ? 'Kamu membaca materi lengkap' : access.canRead ? 'Materi lengkap belum diunggah' : 'Kamu melihat pratinjau'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{ACCESS_LEVEL_HELP[access.level]}</p>
              {canUnlock && (
                <Button size="sm" onClick={() => setPanel('access')}><LockOpen className="mr-1.5 h-4 w-4" /> Buka materi lengkap</Button>
              )}
            </section>

            {(material.description || material.objectives.length > 0) && (
              <section className="space-y-2">
                <h3 className="eyebrow">Tentang materi</h3>
                {material.description && <p className="text-sm text-muted-foreground">{material.description}</p>}
                {material.objectives.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {material.objectives.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                )}
                {material.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{material.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>
                )}
                <p className="font-heading text-xs text-muted-foreground">Diperbarui {fmtDate(material.updatedAt)}</p>
              </section>
            )}

            {quizzes.length > 0 && (
              <section className="space-y-2">
                <h3 className="eyebrow">Kuis untuk materi ini</h3>
                {quizzes.map((q) => {
                  const live = q.mode === 'live_competition';
                  return (
                    <Link key={q.id} href={live ? '/join' : `/quizzes/${q.id}`}
                      className="flex items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 font-heading text-sm text-foreground no-underline hover:bg-secondary">
                      {live ? <Radio className="h-4 w-4 shrink-0 text-primary" /> : <ClipboardList className="h-4 w-4 shrink-0 text-primary" />}
                      <span className="min-w-0 flex-1"><b className="block truncate">{q.title}</b><span className="text-xs text-muted-foreground">{live ? 'Lewat kode sesi live' : `${q.question_count} soal`}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </Link>
                  );
                })}
              </section>
            )}

            {siblings.length > 0 && (
              <section className="space-y-1">
                <h3 className="eyebrow mb-2">Materi di {course.title}</h3>
                {siblings.map((s, i) => {
                  const current = s.slug === material.slug;
                  return (
                    <SheetClose asChild key={s.slug}>
                      <Link href={href(s)} aria-current={current ? 'page' : undefined}
                        className={cn('flex items-start gap-2.5 rounded-md px-2.5 py-2 font-heading text-sm no-underline',
                          current ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}>
                        <span className="mt-px w-5 shrink-0 text-xs font-bold tabular-nums opacity-70">{i + 1}</span>
                        <span className="min-w-0 flex-1">{s.title}</span>
                        {s.locked && <Lock className="mt-1 h-3.5 w-3.5 shrink-0 opacity-60" aria-label="Terkunci" />}
                      </Link>
                    </SheetClose>
                  );
                })}
              </section>
            )}
          </div>

          {access.readerSrc && (
            <div className="border-t-2 border-ink px-5 py-3">
              <a href={access.readerSrc} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-heading text-sm font-bold">
                <ExternalLink className="h-4 w-4" /> Buka materi di tab baru
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
