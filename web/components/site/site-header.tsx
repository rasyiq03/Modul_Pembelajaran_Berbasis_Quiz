'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/lib/supabase/auth-provider';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/site/brand-mark';

/* Hanya halaman yang sudah ada; tambahkan di sini saat halaman langkah 2 selesai dibuat */
const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/materials', label: 'Materials' },
];

const adminLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/materials', label: 'Materials' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  /* Muat ulang agar server component ikut tahu sesi sudah berakhir */
  const doSignOut = async () => { await signOut(); setOpen(false); router.refresh(); };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="container-wide flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-foreground no-underline">
            <BrandMark />
            <span className="hidden text-base font-extrabold tracking-tight sm:inline">KuisKelas</span>
          </Link>
          <nav className="pill-tabs hidden md:inline-flex" aria-label="Navigasi utama">
            {publicLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold no-underline transition-colors',
                  isActive(l.href) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/70',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex md:items-center md:gap-2">
            {loading ? null : user ? (
              <>
                {isAdmin && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/admin">Admin</Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {profile?.display_name || user.email?.split('@')[0]}
                </span>
                <Button variant="outline" size="sm" onClick={doSignOut}>
                  <LogOut className="mr-1 h-4 w-4" /> Sign out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-4">
                  <span className="font-semibold">Menu</span>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-5 w-5" />
                    </Button>
                  </SheetClose>
                </div>
                <nav className="flex-1 overflow-y-auto p-2">
                  <div className="px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Browse
                  </div>
                  {publicLinks.map((l) => (
                    <SheetClose asChild key={l.href}>
                      <Link
                        href={l.href}
                        className={cn(
                          'block rounded-md px-3 py-2 text-sm',
                          isActive(l.href) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {l.label}
                      </Link>
                    </SheetClose>
                  ))}

                  {user && (
                    <>
                      <div className="px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        Account
                      </div>
                      <p className="px-3 py-1 text-sm text-muted-foreground">
                        {profile?.display_name || user.email?.split('@')[0]}
                      </p>
                      <SheetClose asChild>
                        <button
                          onClick={doSignOut}
                          className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </SheetClose>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <div className="px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        Admin
                      </div>
                      {adminLinks.map((l) => (
                        <SheetClose asChild key={l.href}>
                          <Link
                            href={l.href}
                            className={cn(
                              'block rounded-md px-3 py-2 text-sm',
                              isActive(l.href) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                            )}
                          >
                            {l.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </>
                  )}

                  {!user && (
                    <div className="mt-3 flex flex-col gap-2 px-2">
                      <SheetClose asChild>
                        <Button asChild variant="outline">
                          <Link href="/signin">Sign in</Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild>
                          <Link href="/signup">Sign up</Link>
                        </Button>
                      </SheetClose>
                    </div>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}