import { PageHeader } from '@/components/site/page-parts';
import { MaterialsAdminClient } from '@/components/admin/materials-admin-client';
import { adminListCourses, adminListMaterials } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

export default async function AdminMaterialsPage() {
  const [materials, courses] = await Promise.all([adminListMaterials(), adminListCourses()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description="Upload preview and full HTML for each material, then publish it to the catalog." />
      <MaterialsAdminClient materials={materials} courses={courses.map((c) => ({ id: c.id, title: c.title, slug: c.slug }))} />
    </div>
  );
}
