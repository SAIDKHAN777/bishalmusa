import { env } from './env';

export interface PersonSchemaOptions {
  name?: string;
  url?: string;
  jobTitle?: string;
  bio?: string;
  email?: string;
  sameAs?: string[];
}

export interface WebSiteSchemaOptions {
  name?: string;
  url?: string;
  description?: string;
}

export interface ArticleSchemaOptions {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  updatedAt?: string;
  authorName?: string;
  tags?: string[];
  imageUrl?: string;
}

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Schema.org Person JSON-LD
 */
export function generatePersonSchema(options?: PersonSchemaOptions) {
  const siteUrl = options?.url || env.SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: options?.name || 'Said Khan',
    url: siteUrl,
    jobTitle: options?.jobTitle || 'Senior Software Engineer & Systems Architect',
    description:
      options?.bio ||
      'Experienced Full-Stack Software Engineer specializing in distributed backends, cloud architecture, and high-performance applications.',
    email: options?.email || 'contact@saidkhan.dev',
    sameAs: options?.sameAs || [
      'https://github.com/saidkhan',
      'https://linkedin.com/in/saidkhan',
      'https://twitter.com/saidkhan',
    ],
  };
}

/**
 * Generate Schema.org WebSite JSON-LD
 */
export function generateWebSiteSchema(options?: WebSiteSchemaOptions) {
  const siteUrl = options?.url || env.SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: options?.name || 'Said Khan Portfolio',
    url: siteUrl,
    description:
      options?.description ||
      'Portfolio, engineering articles, distributed systems projects, and technical showcase of Said Khan.',
  };
}

/**
 * Generate Schema.org BlogPosting / Article JSON-LD
 */
export function generateArticleSchema(options: ArticleSchemaOptions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: options.title,
    description: options.description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': options.url,
    },
    datePublished: options.publishedAt,
    dateModified: options.updatedAt || options.publishedAt,
    author: {
      '@type': 'Person',
      name: options.authorName || 'Said Khan',
      url: env.SITE_URL,
    },
    publisher: {
      '@type': 'Person',
      name: 'Said Khan',
      url: env.SITE_URL,
    },
    ...(options.tags && options.tags.length > 0 ? { keywords: options.tags.join(', ') } : {}),
    ...(options.imageUrl ? { image: [options.imageUrl] } : {}),
  };
}

/**
 * Generates standard compliant XML Sitemap
 */
export function generateSitemapXml(
  siteUrl: string,
  staticPages: Array<{ path: string; changefreq: string; priority: number }>,
  projects: Array<{ slug: string; updatedAt: Date }>,
  posts: Array<{ slug: string; updatedAt: Date }>
): string {
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');

  const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];

  // 1. Static Pages
  for (const page of staticPages) {
    urls.push({
      loc: `${cleanSiteUrl}${page.path.startsWith('/') ? page.path : '/' + page.path}`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: page.changefreq,
      priority: page.priority.toFixed(1),
    });
  }

  // 2. Published Projects
  for (const project of projects) {
    urls.push({
      loc: `${cleanSiteUrl}/projects/${project.slug}`,
      lastmod: project.updatedAt.toISOString().split('T')[0],
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  // 3. Published Blog Posts
  for (const post of posts) {
    urls.push({
      loc: `${cleanSiteUrl}/blog/${post.slug}`,
      lastmod: post.updatedAt.toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: '0.9',
    });
  }

  const xmlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;
}

/**
 * Generates standard robots.txt content
 */
export function generateRobotsTxt(siteUrl: string, disallowAll: boolean = false): string {
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');

  if (disallowAll) {
    return `User-agent: *
Disallow: /
`;
  }

  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/
Disallow: /api/
Allow: /api/resume/download

Sitemap: ${cleanSiteUrl}/sitemap.xml
`;
}
