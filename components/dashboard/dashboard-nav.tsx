'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Ringkasan' },
  { href: '/dashboard/materials', label: 'Materi saya' },
  { href: '/dashboard/history', label: 'Riwayat kuis' },
  { href: '/dashboard/profile', label: 'Profil' },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="pill-tabs inline-flex max-w-full overflow-x-auto" aria-label="Menu dashboard">
      {LINKS.map((l) => {
        const on = pathname === l.href;
        return (
          <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}
            className={cn('whitespace-nowrap rounded-full px-3.5 py-1.5 font-heading text-[0.8rem] font-bold no-underline', on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/70')}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
