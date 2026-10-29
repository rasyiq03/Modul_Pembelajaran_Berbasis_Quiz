import { PageHeader } from '@/components/site/page-parts';
import { MaterialsAdminClient } from '@/components/admin/materials-admin-client';
import { adminListCourses, adminListMaterials } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

export default async function AdminMaterialsPage() {
  const [materials, courses] = await Promise.all([adminListMaterials(), adminListCourses()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Materi" description="Unggah HTML pratinjau dan HTML lengkap untuk setiap materi, lalu publikasikan ke katalog." />
      <MaterialsAdminClient materials={materials} courses={courses.map((c) => ({ id: c.id, title: c.title, slug: c.slug }))} />
    </div>
  );
}
