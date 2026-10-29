import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/site/page-parts';

export const metadata = { title: 'Not found · KuisKelas' };

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist, or you do not have access to it."
        action={<Button asChild><Link href="/courses">Browse courses</Link></Button>}
      />
    </div>
  );
}
