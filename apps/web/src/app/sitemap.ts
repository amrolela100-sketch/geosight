import type { MetadataRoute } from 'next';

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          ar: appUrl,
          en: `${appUrl}/en`,
        },
      },
    },
    {
      url: `${appUrl}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: {
        languages: {
          ar: appUrl,
          en: `${appUrl}/en`,
        },
      },
    },
  ];
}
