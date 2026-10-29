'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Boxes, LayoutDashboard, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Hanya halaman yang sudah ada; key, bank soal, kuis, sesi, dan hasil menyusul di langkah 2 */
const adminLinks = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/admin/materials', label: 'Materials', icon: Boxes },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="container-wide py-6">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className={cn('h-3 w-3 transition-transform', collapsed && 'rotate-180')} />
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
            <nav className="space-y-1">
              {adminLinks.map((l) => {
                const active = pathname === l.href || (l.href !== '/admin' && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <l.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{l.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="lg:hidden -mx-4 mb-3 overflow-x-auto px-4">
          <div className="flex gap-1 pb-2">
            {adminLinks.map((l) => {
              const active = pathname === l.href || (l.href !== '/admin' && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs',
                    active ? 'bg-accent text-accent-foreground' : 'border border-border text-muted-foreground',
                  )}
                >
                  <l.icon className="h-3.5 w-3.5" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}