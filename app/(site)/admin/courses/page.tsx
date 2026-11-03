import { PageHeader } from '@/components/site/page-parts';
import { CoursesAdminClient } from '@/components/admin/courses-admin-client';
import { adminListCourses } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  await requireAdmin('/admin/courses');
  const courses = await adminListCourses();
  return (
    <div className="space-y-6">
      <PageHeader title="Mata kuliah" description="Kelola mata kuliah yang tampil di katalog publik." />
      <CoursesAdminClient courses={courses} />
    </div>
  );
}