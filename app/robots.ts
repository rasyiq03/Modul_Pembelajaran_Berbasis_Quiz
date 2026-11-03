import type { MetadataRoute } from 'next';

/* Katalog boleh diindeks; area akun, admin, hasil kuis, dan isi materi bertoken tidak */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/attempts', '/play', '/m/', '/auth'],
    },
  };
}
