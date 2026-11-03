import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, Crown, Radio, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPublishedCourses, getRecentMaterials } from '@/lib/catalog/queries';
import { EmptyState } from '@/components/site/page-parts';
import { Cover } from '@/components/site/cover';

export const revalidate = 60;

export default async function HomePage() {
  const [courses, recentMaterials] = await Promise.all([
    getPublishedCourses(),
    getRecentMaterials(6),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="container-wide grid items-center gap-8 pb-12 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow mb-4 inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Modul pembelajaran berbasis kuis
          </p>
          <h1 className="text-[clamp(2.3rem,5.4vw,4rem)] leading-[1.02]">
            Baca catatannya, lalu <mark>adu paham</mark> bareng teman.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-muted-foreground">
            Semua materi kuliah dalam satu tempat. Tiap materi punya rangkuman, lab mini, dan kuis yang bisa
            dimainkan sendiri atau satu kelas sekaligus.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/courses">Jelajahi materi <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard/subscription"><Crown className="mr-1 h-4 w-4" /> Ajukan langganan</Link>
            </Button>
          </div>
          <p className="mt-5 font-heading text-sm font-bold text-muted-foreground">
            {courses.length} mata kuliah · {courses.reduce((t, c) => t + c.material_count, 0)} materi · pratinjau gratis
          </p>
        </div>

        {/* Main bareng: langsung ke /join dengan kode sesi */}
        <div className="relative rounded-xl border-2 border-[#1A1A1A] p-6 text-white shadow-[4px_4px_0_0_#1A1A1A]" style={{ background: '#46178F' }}>
          <span className="sticker absolute -right-2 -top-4">Kuis live</span>
          <h2 className="text-[1.8rem] font-extrabold text-white">Main bareng</h2>
          <p className="mb-5 mt-2 opacity-90">Masukkan kode sesi dari layar pengajar. Jawab dari HP, skor muncul di proyektor.</p>
          <form action="/join" method="get" className="flex gap-2.5">
            <input
              name="code" required minLength={6} maxLength={6} autoComplete="off" placeholder="KODE" aria-label="Kode sesi 6 karakter"
              className="min-w-0 flex-1 rounded-lg border-2 border-[#1A1A1A] bg-white px-3 py-2 text-center font-heading text-2xl font-extrabold uppercase tracking-[0.25em] text-[#1A1A1A] placeholder:text-[#1A1A1A]/35"
            />
            <button type="submit"
              className="rounded-lg border-2 border-[#1A1A1A] px-5 font-heading font-bold text-[#1A1A1A] shadow-[3px_3px_0_0_#1A1A1A] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ background: '#FFC93C' }}>
              Gabung
            </button>
          </form>
          <div className="mt-5 grid grid-cols-4 gap-2" aria-hidden="true">
            {[['#E21B3C', 'polygon(50% 0,100% 100%,0 100%)'], ['#1368CE', 'polygon(50% 0,100% 50%,50% 100%,0 50%)'], ['#D89E00', ''], ['#26890C', '']].map(([bg, clip], i) => (
              <div key={i} className="grid h-10 place-items-center rounded-lg border-2 border-[#1A1A1A]" style={{ background: bg }}>
                <i className="block h-4 w-4 bg-white" style={{ clipPath: clip || undefined, borderRadius: i === 2 ? '50%' : undefined }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cara kerja */}
      <section className="container-wide py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Cara kerjanya</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Perpustakaan materi, pembaca layar penuh yang terisolasi, langganan, dan kuis.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: 'Perpustakaan materi', text: 'Telusuri mata kuliah dan materinya. Setiap materi adalah dokumen HTML mandiri.' },
            { icon: Crown, title: 'Langganan', text: 'Pratinjau terbuka untuk semua. Ajukan langganan sekali untuk membuka semua materi berlabel Langganan.' },
            { icon: Compass, title: 'Pembaca aman', text: 'Materi tampil layar penuh di pembaca ter-sandbox, dengan lab interaktif dan kuis latihan tetap utuh.' },
            { icon: Radio, title: 'Kuis mandiri & live', text: 'Kerjakan kuis kapan saja, atau ikuti sesi live dengan kode tanpa perlu membuat akun.' },
          ].map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="grid h-11 w-11 place-items-center rounded-lg border-2 border-ink text-[#1A1A1A]" style={{ background: 'hsl(var(--yellow))' }}>
                  <f.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Mata kuliah */}
      <section className="container-wide py-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Mata kuliah</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pilih mata kuliah untuk melihat materinya.</p>
          </div>
          <Button asChild variant="link">
            <Link href="/courses">Semua mata kuliah <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {courses.length === 0 ? (
          <EmptyState title="Belum ada mata kuliah" description="Mata kuliah akan tampil di sini setelah dipublikasikan admin." />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="surface-card press flex flex-col overflow-hidden text-foreground no-underline">
                <Cover index={i} />
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h3 className="text-xl font-extrabold">{c.title}</h3>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                  <p className="mt-auto flex items-center justify-between pt-2 font-heading text-sm font-bold">
                    <span>{c.material_count} materi</span><ArrowRight className="h-4 w-4" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Materi terbaru */}
      <section className="container-wide py-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Materi terbaru</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pratinjau terbuka untuk umum; materi lengkap sesuai tingkat aksesnya.</p>
          </div>
          <Button asChild variant="link">
            <Link href="/materials">Semua materi <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {recentMaterials.length === 0 ? (
          <EmptyState title="Belum ada materi" description="Materi akan tampil di sini setelah dipublikasikan admin." />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentMaterials.map((m) => (
              <Card key={m.id} className="group flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base group-hover:text-primary">{m.title}</CardTitle>
                  <p className="font-heading text-xs font-bold text-muted-foreground">{m.courses?.title}</p>
                  <CardDescription className="line-clamp-3">{m.description}</CardDescription>
                </CardHeader>
                {m.material_tags && m.material_tags.length > 0 && (
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {m.material_tags.slice(0, 4).map((t) => (
                        <Badge key={t.tag} variant="secondary" className="text-xs">{t.tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
                <CardFooter className="mt-auto">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/courses/${m.courses?.slug}/${m.slug}`}>Baca materi <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Ajakan */}
      <section className="container-wide pb-6 pt-4">
        <div className="surface-card bg-secondary px-6 py-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Buka semua materi dengan satu langganan</h2>
            <p className="text-sm text-muted-foreground">
              Buat akun, lalu ajukan langganan ke admin. Setelah disetujui, semua materi berlabel Langganan terbuka penuh dan riwayat kuismu tersimpan di dashboard.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/signup">Buat akun</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/quizzes"><Search className="mr-1 h-4 w-4" /> Lihat kuis</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
