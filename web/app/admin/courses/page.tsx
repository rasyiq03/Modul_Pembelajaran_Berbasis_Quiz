import { PageHeader } from '@/components/site/page-parts';
import { CoursesAdminClient } from '@/components/admin/courses-admin-client';
import { adminListCourses } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  const courses = await adminListCourses();
  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Create and manage the courses shown in the public catalog." />
      <CoursesAdminClient courses={courses} />
    </div>
  );
}