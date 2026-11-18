import type { APIRoute } from 'astro';
import { db } from '../lib/db';
import { env } from '../lib/env';
import { escapeXml } from '../lib/seo';
import { Status } from '@prisma/client';
import { logger } from '../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const siteSetting = await db.siteSetting.findFirst();
    const siteName = siteSetting?.siteName || 'Said Khan';
    const siteDescription =
      siteSetting?.bio ||
      siteSetting?.tagline ||
      'Senior Software Engineer & Distributed Systems Architect';

    const cleanSiteUrl = env.SITE_URL.replace(/\/$/, '');

    // Fetch published blog posts
    const publishedPosts = await db.blogPost.findMany({
      where: {
        status: Status.PUBLISHED,
        deletedAt: null,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20,
      include: {
        tags: {
          select: { name: true },
        },
      },
    });

    const itemsXml = publishedPosts
      .map((post) => {
        const postUrl = `${cleanSiteUrl}/blog/${post.slug}`;
        const pubDate = new Date(post.publishedAt || post.createdAt).toUTCString();
        const categories = post.tags
          .map((tag) => `<category>${escapeXml(tag.name)}</category>`)
          .join('\n      ');

        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt || post.title)}</description>
      ${categories}
    </item>`;
      })
      .join('\n');

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)} Technical Blog</title>
    <link>${cleanSiteUrl}/blog</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${cleanSiteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

    return new Response(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to generate dynamic rss.xml');
    return new Response('Error generating RSS feed', { status: 500 });
  }
};
