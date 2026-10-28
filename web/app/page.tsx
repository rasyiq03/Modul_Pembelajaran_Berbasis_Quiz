import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, GraduationCap, PlayCircle, Sparkles, Trophy, Users } from 'lucide-react';
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
              <Sparkles className="h-3.5 w-3.5" /> Interactive university learning
            </p>
            <h1 className="max-w-[18ch] text-[clamp(2rem,5.2vw,3.4rem)]">
              Read rich lecture materials, then test yourself live
            </h1>
            <p className="mt-4 max-w-[60ch] text-lg text-muted-foreground">
              Interactive HTML course notes with calculators, visualizations, and simulations,
              paired with a question bank and Kahoot-style live quiz sessions.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/courses">Browse courses <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/join"><PlayCircle className="mr-1 h-4 w-4" /> Join a quiz</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-wide py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Four modules that work together: a material library, an isolated HTML reader,
            a reusable question bank, and live quiz sessions.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: 'Material library', text: 'Browse published courses and their interactive materials, each a self-contained HTML document.' },
            { icon: Compass, title: 'Secure reader', text: 'Materials open in a sandboxed reader. Enroll with a per-material key to unlock the full content.' },
            { icon: GraduationCap, title: 'Question bank', text: 'A reusable bank spanning multiple types: multiple choice, true/false, matching, ordering, essay.' },
            { icon: Trophy, title: 'Live quizzes', text: 'Hosts start sessions; guests join with a code and nickname. Server-authoritative scoring.' },
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

      {/* Courses */}
      <section className="container-wide py-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Courses</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse the catalog and dive into a course.</p>
          </div>
          <Button asChild variant="link">
            <Link href="/courses">All courses <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {courses.length === 0 ? (
          <EmptyState title="No courses published yet" description="Once an administrator publishes courses they will appear here." />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id} className="group hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg group-hover:text-primary">{c.title}</CardTitle>
                    <Badge variant="secondary"><span>{c.material_count} materials</span></Badge>
                  </div>
                  <CardDescription className="line-clamp-3">{c.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/courses/${c.slug}`}>View course <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent materials */}
      <section className="container-wide py-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Recently updated materials</h2>
            <p className="mt-1 text-sm text-muted-foreground">Preview snippets are public; full content unlocks with enrollment.</p>
          </div>
          <Button asChild variant="link">
            <Link href="/materials">All materials <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {recentMaterials.length === 0 ? (
          <EmptyState title="No materials published yet" description="Once an administrator publishes materials they will appear here." />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentMaterials.map((m) => (
              <Card key={m.id} className="group hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base group-hover:text-primary">{m.title}</CardTitle>
                    <Badge variant="outline">{m.courses?.slug?.toUpperCase()}</Badge>
                  </div>
                  <CardDescription className="line-clamp-3">{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {m.material_tags?.slice(0, 4).map((t) => (
                      <Badge key={t.tag} variant="secondary" className="text-xs">{t.tag}</Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/courses/${m.courses?.slug}/${m.slug}`}>
                      <Users className="mr-1 h-4 w-4" /> View material
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="container-wide py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Ready to test your understanding?</h2>
            <p className="text-sm text-muted-foreground">
              Join a live quiz with a session code, or sign in to track your history.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/join">Join a quiz</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/signin">Sign in</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}