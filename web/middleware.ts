import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Lewati aset statis dan isi materi (/m/... memakai token sendiri, tanpa cookie)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|m/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)'],
};
