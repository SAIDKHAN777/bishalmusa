import type { APIRoute } from 'astro';
import { db } from '../lib/db';
import { env } from '../lib/env';
import { generateSitemapXml } from '../lib/seo';
import { Status } from '@prisma/client';
import { logger } from '../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const staticPages = [
      { path: '/', changefreq: 'daily', priority: 1.0 },
      { path: '/projects', changefreq: 'weekly', priority: 0.9 },
      { path: '/blog', changefreq: 'weekly', priority: 0.9 },
      { path: '/about', changefreq: 'monthly', priority: 0.7 },
      { path: '/contact', changefreq: 'monthly', priority: 0.7 },
    ];

    // Query strictly published and non-deleted content
    const [publishedProjects, publishedPosts] = await Promise.all([
      db.project.findMany({
        where: {
          status: Status.PUBLISHED,
          deletedAt: null,
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      }),
      db.blogPost.findMany({
        where: {
          status: Status.PUBLISHED,
          deletedAt: null,
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      }),
    ]);

    const sitemapXml = generateSitemapXml(
      env.SITE_URL,
      staticPages,
      publishedProjects,
      publishedPosts
    );

    return new Response(sitemapXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to generate dynamic sitemap.xml');
    return new Response('Error generating sitemap', { status: 500 });
  }
};
