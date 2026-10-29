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
import { ADMIN_LINKS } from '@/components/admin/admin-shell';

const publicLinks = [
  { href: '/', label: 'Beranda' },
  { href: '/courses', label: 'Mata Kuliah' },
  { href: '/materials', label: 'Materi' },
  { href: '/quizzes', label: 'Kuis' },
  { href: '/join', label: 'Gabung Kuis' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user: authUser, profile, isAdmin, signOut, loading } = useAuth();
  /* Sesi anonim (tamu kuis) tidak dianggap akun: tetap tampilkan Masuk/Daftar */
  const user = authUser && !authUser.is_anonymous ? authUser : null;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  /* Muat ulang agar server component ikut tahu sesi sudah berakhir */
  const doSignOut = async () => { await signOut(); setOpen(false); router.push('/'); router.refresh(); };
  const name = profile?.display_name || user?.email?.split('@')[0];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const mobileLink = (href: string, label: string) => (
    <SheetClose asChild key={href}>
      <Link
        href={href}
        className={cn('block rounded-md px-3 py-2 font-heading text-sm font-bold no-underline', isActive(href) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}
      >
        {label}
      </Link>
    </SheetClose>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="container-wide flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-foreground no-underline">
            <BrandMark />
            <span className="hidden text-base font-extrabold tracking-tight sm:inline">KuisKelas</span>
          </Link>
          <nav className="pill-tabs hidden lg:inline-flex" aria-label="Navigasi utama">
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
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {loading ? null : user ? (
              <>
                {isAdmin && (
                  <Button asChild variant="ghost" size="sm"><Link href="/admin">Admin</Link></Button>
                )}
                <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Dashboard</Link></Button>
                <span className="max-w-[10rem] truncate text-sm text-muted-foreground">{name}</span>
                <Button variant="outline" size="sm" onClick={doSignOut}>
                  <LogOut className="mr-1 h-4 w-4" /> Keluar
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/signin">Masuk</Link></Button>
                <Button asChild size="sm"><Link href="/signup">Daftar</Link></Button>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Buka menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigasi</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-4">
                  <span className="font-heading font-bold">Menu</span>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon"><X className="h-5 w-5" /><span className="sr-only">Tutup</span></Button>
                  </SheetClose>
                </div>
                <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                  <p className="eyebrow px-3 py-2">Jelajahi</p>
                  {publicLinks.map((l) => mobileLink(l.href, l.label))}

                  {user && (
                    <>
                      <p className="eyebrow px-3 pb-2 pt-4">Akun · {name}</p>
                      {mobileLink('/dashboard', 'Dashboard')}
                      {mobileLink('/dashboard/history', 'Riwayat kuis')}
                      {mobileLink('/dashboard/profile', 'Profil')}
                      <SheetClose asChild>
                        <button onClick={doSignOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-heading text-sm font-bold hover:bg-secondary">
                          <LogOut className="h-4 w-4" /> Keluar
                        </button>
                      </SheetClose>
                    </>
                  )}

                  {user && isAdmin && (
                    <>
                      <p className="eyebrow px-3 pb-2 pt-4">Admin</p>
                      {ADMIN_LINKS.map((l) => mobileLink(l.href, l.label))}
                    </>
                  )}

                  {!user && (
                    <div className="mt-4 flex flex-col gap-2 px-2">
                      <SheetClose asChild><Button asChild variant="outline"><Link href="/signin">Masuk</Link></Button></SheetClose>
                      <SheetClose asChild><Button asChild><Link href="/signup">Daftar</Link></Button></SheetClose>
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
