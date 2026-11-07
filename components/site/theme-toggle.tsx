'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeChoice, type ThemeChoice } from '@/lib/theme';
import { cn } from '@/lib/utils';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeChoice, string> = { system: 'Ikuti sistem', light: 'Terang', dark: 'Gelap' };
const ICON = { system: Monitor, light: Sun, dark: Moon };

/** Satu tombol: Ikuti sistem → Terang → Gelap */
export function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = useThemeChoice();
  const Icon = ICON[choice];
  const label = `Tema: ${LABEL[choice]}. Ganti ke ${LABEL[NEXT[choice]]}`;
  return (
    <Button variant="ghost" size="icon" className={cn('shrink-0', className)} onClick={() => setChoice(NEXT[choice])} title={label} aria-label={label}>
      <Icon className="h-[1.15rem] w-[1.15rem]" />
    </Button>
  );
}
