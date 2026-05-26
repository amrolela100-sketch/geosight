import type { MetadataRoute } from 'next';

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/ar/dashboard', '/en/dashboard', '/api'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
