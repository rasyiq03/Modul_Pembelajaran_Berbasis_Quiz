import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/site/page-parts';
import { Cover } from '@/components/site/cover';
import { getPublishedCourses } from '@/lib/catalog/queries';

export const revalidate = 60;

export const metadata = { title: 'Mata Kuliah · Cognify' };

export default async function CoursesPage() {
  const courses = await getPublishedCourses();
  return (
    <div className="container-page py-10">
      <div className="space-y-2 pb-8">
        <h1 className="text-[clamp(2rem,4vw,2.8rem)]">Katalog mata kuliah</h1>
        <p className="text-muted-foreground">
          Setiap mata kuliah berisi beberapa materi kuliah interaktif beserta kuis latihannya.
        </p>
      </div>
      {courses.length === 0 ? (
        <EmptyState
          title="Belum ada mata kuliah"
          description="Mata kuliah akan tampil di sini setelah dipublikasikan admin."
          icon={<BookOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <Link key={c.id} href={`/courses/${c.slug}`} className="surface-card press flex flex-col overflow-hidden text-foreground no-underline">
              <Cover index={i} />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="text-xl font-extrabold">{c.title}</h2>
                <p className="line-clamp-4 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-auto flex items-center justify-between pt-2 font-heading text-sm font-bold">
                  <span>{c.material_count} materi</span><ArrowRight className="h-4 w-4" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
