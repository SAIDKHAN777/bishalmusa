import { test, expect } from '@playwright/test';

test.describe('SEO Automation, Dynamic Sitemap, Robots & RSS (E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('GET /sitemap.xml should serve valid XML, include published content and exclude drafts', async ({
    request,
  }) => {
    // 1. Log in as admin
    await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });

    // 2. Create a PUBLISHED post
    const publishedSlug = 'e2e-seo-published-' + Date.now();
    const pubRes = await request.post('/api/admin/blog', {
      data: {
        title: 'E2E SEO Published Article',
        slug: publishedSlug,
        content: '# SEO Optimized Content\nThis is a published article.',
        status: 'PUBLISHED',
      },
    });
    expect(pubRes.status()).toBe(201);

    // 3. Create a DRAFT post
    const draftSlug = 'e2e-seo-draft-' + Date.now();
    const draftRes = await request.post('/api/admin/blog', {
      data: {
        title: 'E2E SEO Draft Article',
        slug: draftSlug,
        content: '# Secret Draft Content\nMust not be indexed.',
        status: 'DRAFT',
      },
    });
    expect(draftRes.status()).toBe(201);

    // 4. Fetch sitemap.xml
    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    const contentType = sitemapRes.headers()['content-type'];
    expect(contentType).toContain('xml');

    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemapXml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Core static routes must be listed
    expect(sitemapXml).toContain('/projects');
    expect(sitemapXml).toContain('/blog');

    // Published post must be included in sitemap
    expect(sitemapXml).toContain(`/blog/${publishedSlug}`);

    // DRAFT post MUST NEVER be in sitemap
    expect(sitemapXml).not.toContain(`/blog/${draftSlug}`);
  });

  test('GET /robots.txt should declare search engine directives and link to sitemap', async ({
    request,
  }) => {
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    const contentType = robotsRes.headers()['content-type'];
    expect(contentType).toContain('text/plain');

    const robotsTxt = await robotsRes.text();
    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Allow: /');
    expect(robotsTxt).toContain('Disallow: /admin/');
    expect(robotsTxt).toContain('Disallow: /api/admin/');
    expect(robotsTxt).toContain('Allow: /api/resume/download');
    expect(robotsTxt).toContain('Sitemap:');
    expect(robotsTxt).toContain('/sitemap.xml');
  });

  test('GET /rss.xml should provide valid RSS 2.0 feed with recent published articles', async ({
    request,
  }) => {
    const rssRes = await request.get('/rss.xml');
    expect(rssRes.status()).toBe(200);
    const contentType = rssRes.headers()['content-type'];
    expect(contentType).toContain('xml');

    const rssXml = await rssRes.text();
    expect(rssXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rssXml).toContain('<rss version="2.0"');
    expect(rssXml).toContain('<channel>');
    expect(rssXml).toContain('<title>');
    expect(rssXml).toContain('<link>');
    expect(rssXml).toContain('<description>');
  });

  test('Home page should render structured data (JSON-LD), Open Graph, and Twitter tags', async ({
    page,
  }) => {
    await page.goto('/');

    // Title and Meta Description
    await expect(page).toHaveTitle(/Said Khan/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();

    // Canonical link
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();

    // Open Graph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Said Khan');
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
    expect(ogType).toBe('website');

    // Twitter Card
    const twitterCard = await page.locator('meta[property="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');

    // JSON-LD Scripts
    const jsonLdScripts = await page.$$eval(
      'script[type="application/ld+json"]',
      (elements) => elements.map((el) => JSON.parse(el.textContent || '{}'))
    );

    expect(jsonLdScripts.length).toBeGreaterThanOrEqual(1);
    const hasPerson = jsonLdScripts.some((schema) => schema['@type'] === 'Person');
    const hasWebSite = jsonLdScripts.some((schema) => schema['@type'] === 'WebSite');

    expect(hasPerson).toBe(true);
    expect(hasWebSite).toBe(true);
  });
});
