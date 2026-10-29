'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpen, Boxes, ClipboardList, KeyRound, LayoutDashboard, ListChecks, Radio, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ADMIN_LINKS = [
  { href: '/admin', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/admin/courses', label: 'Mata kuliah', icon: BookOpen },
  { href: '/admin/materials', label: 'Materi', icon: Boxes },
  { href: '/admin/keys', label: 'Enrollment key', icon: KeyRound },
  { href: '/admin/questions', label: 'Bank soal', icon: ListChecks },
  { href: '/admin/quizzes', label: 'Kuis', icon: ClipboardList },
  { href: '/admin/sessions', label: 'Sesi live', icon: Radio },
  { href: '/admin/results', label: 'Hasil & analitik', icon: BarChart3 },
  { href: '/admin/users', label: 'Pengguna', icon: Users },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));

  return (
    <div className="container-wide py-6">
      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1" aria-label="Menu admin">
            <p className="eyebrow mb-2 px-3">Admin</p>
            {ADMIN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 font-heading text-sm font-bold no-underline transition-colors',
                  isActive(l.href) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <l.icon className="h-4 w-4 shrink-0" /> {l.label}
              </Link>
            ))}
          </nav>
        </aside>

        <nav className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden" aria-label="Menu admin">
          <div className="flex gap-1.5 pb-2">
            {ADMIN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-heading text-xs font-bold no-underline',
                  isActive(l.href) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
                )}
              >
                <l.icon className="h-3.5 w-3.5" /> {l.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
