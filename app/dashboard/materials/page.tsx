import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RedeemKey } from '@/components/materials/redeem-key';
import { getViewer } from '@/lib/auth';
import { myMaterials } from '@/lib/dashboard';
import { fmtDate } from '@/lib/labels';

/** FR-20/23: tukar enrollment key dan daftar materi yang sudah dibuka */
export default async function MyMaterialsPage() {
  const { user } = await getViewer();
  const materials = await myMaterials(user!.id);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {materials.length === 0 && <p className="note-box text-sm">Belum ada materi yang dibuka. Masukkan enrollment key dari pengajar.</p>}
        {materials.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <p className="eyebrow">{e.materials!.courses?.title}</p>
              <CardTitle className="text-lg"><Link href={`/courses/${e.materials!.courses?.slug}/${e.materials!.slug}`} className="text-foreground">{e.materials!.title}</Link></CardTitle>
              {e.materials!.description && <CardDescription>{e.materials!.description}</CardDescription>}
            </CardHeader>
            <CardContent className="font-heading text-xs text-muted-foreground">Dibuka sejak {fmtDate(e.created_at)}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-lg">Punya enrollment key?</CardTitle><CardDescription>Satu key membuka satu materi.</CardDescription></CardHeader>
        <CardContent><RedeemKey /></CardContent>
      </Card>
    </div>
  );
}
