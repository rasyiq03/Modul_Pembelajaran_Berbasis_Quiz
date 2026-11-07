'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme-script';

/* Pilihan tema disimpan di browser; "system" mengikuti pengaturan perangkat. Atribut data-theme di
   <html> dipasang THEME_SCRIPT sebelum halaman tampil, jadi tidak ada kedipan tema salah. */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const EVENT = 'cognify:theme';

export function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== 'system') return choice;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch { /* mode privat: tetap berlaku untuk halaman ini */ }
  if (choice === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', choice);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Pilihan tema saat ini; ikut berubah bila diganti dari komponen lain */
export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  useEffect(() => {
    const sync = () => setChoice(readChoice());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return [choice, applyChoice];
}

/** Tema yang benar-benar tampil (light/dark), termasuk saat sistem berganti mode */
export function useResolvedTheme(): ResolvedTheme {
  const [choice] = useThemeChoice();
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  useEffect(() => {
    const update = () => setResolved(resolveTheme(choice));
    update();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [choice]);
  return resolved;
}
