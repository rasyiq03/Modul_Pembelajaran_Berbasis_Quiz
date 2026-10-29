import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, KeyRound, Radio, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPublishedCourses, getRecentMaterials } from '@/lib/catalog/queries';
import { EmptyState } from '@/components/site/page-parts';

export const revalidate = 60;

export default async function HomePage() {
  const [courses, recentMaterials] = await Promise.all([
    getPublishedCourses(),
    getRecentMaterials(6),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="container-wide pb-12 pt-12 sm:pb-16 sm:pt-16">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4 inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Modul pembelajaran berbasis kuis
            </p>
            <h1 className="max-w-[18ch] text-[clamp(2rem,5.2vw,3.4rem)]">
              Baca materi interaktif, lalu uji pemahamanmu
            </h1>
            <p className="mt-4 max-w-[60ch] text-lg text-muted-foreground">
              Rangkuman kuliah dalam HTML lengkap dengan kalkulator, visualisasi, dan simulasi,
              ditutup kuis latihan bergaya Kahoot. Pengajar juga bisa membuka kuis live dengan kode sesi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/courses">Jelajahi mata kuliah <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/join"><Radio className="mr-1 h-4 w-4" /> Gabung kuis dengan kode</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cara kerja */}
      <section className="container-wide py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Cara kerjanya</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Perpustakaan materi, pembaca HTML yang terisolasi, enrollment key per materi, dan kuis.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: 'Perpustakaan materi', text: 'Telusuri mata kuliah dan materinya. Setiap materi adalah dokumen HTML mandiri.' },
            { icon: KeyRound, title: 'Enrollment key', text: 'Pratinjau terbuka untuk semua. Tukar key dari pengajar untuk membuka materi lengkap.' },
            { icon: Compass, title: 'Pembaca aman', text: 'Materi dibuka di pembaca ter-sandbox dengan lab interaktif dan kuis latihan tetap utuh.' },
            { icon: Radio, title: 'Kuis mandiri & live', text: 'Kerjakan kuis kapan saja, atau ikuti sesi live dengan kode tanpa perlu membuat akun.' },
          ].map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
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
            {courses.map((c) => (
              <Card key={c.id} className="group transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg group-hover:text-primary">{c.title}</CardTitle>
                    <Badge variant="secondary"><span>{c.material_count} materi</span></Badge>
                  </div>
                  <CardDescription className="line-clamp-3">{c.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/courses/${c.slug}`}>Lihat mata kuliah <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Materi terbaru */}
      <section className="container-wide py-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Materi terbaru</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pratinjau terbuka untuk umum; materi lengkap terbuka setelah enrollment.</p>
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
              <Card key={m.id} className="group transition-shadow hover:shadow-md">
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
                <CardFooter>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/courses/${m.courses?.slug}/${m.slug}`}>Buka materi <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Ajakan */}
      <section className="border-t border-border bg-muted/30">
        <div className="container-wide py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Punya enrollment key?</h2>
            <p className="text-sm text-muted-foreground">
              Buat akun, buka materinya, lalu tukar key untuk membaca materi lengkap. Riwayat kuis tersimpan di dashboard.
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
