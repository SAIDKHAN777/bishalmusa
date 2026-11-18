import { test, expect } from '@playwright/test';

test.describe('Technical Blog System (E2E & Access Control)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('Public Blog endpoints should serve published posts and hide drafts', async ({ request }) => {
    // 1. Log in as admin
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);

    // 2. Create a DRAFT post
    const draftSlug = 'e2e-draft-' + Date.now();
    const draftRes = await request.post('/api/admin/blog', {
      data: {
        title: 'E2E Draft Blog Post',
        slug: draftSlug,
        content: '# Draft Heading\nDraft body text with <script>alert(1)</script>',
        status: 'DRAFT',
        tags: ['DraftTag'],
      },
    });
    expect(draftRes.status()).toBe(201);
    const draftPost = (await draftRes.json()).data;

    // 3. Create a PUBLISHED post
    const pubSlug = 'e2e-published-' + Date.now();
    const pubRes = await request.post('/api/admin/blog', {
      data: {
        title: 'E2E Published Blog Post',
        slug: pubSlug,
        content: '# Safe Heading\n**Bold article text** with [Link](https://example.com)',
        status: 'PUBLISHED',
        tags: ['Architecture', 'DevOps'],
      },
    });
    expect(pubRes.status()).toBe(201);
    const pubPost = (await pubRes.json()).data;

    // 4. Verify public list (/api/blog) contains published, excludes draft
    const publicListRes = await request.get('/api/blog');
    expect(publicListRes.status()).toBe(200);
    const publicData = (await publicListRes.json()).data;

    expect(publicData.items.some((p: any) => p.id === pubPost.id)).toBe(true);
    expect(publicData.items.some((p: any) => p.id === draftPost.id)).toBe(false);

    // 5. Verify public slug endpoint (/api/blog/[slug])
    // Published post returns 200 with rendered sanitized HTML
    const pubSlugRes = await request.get(`/api/blog/${pubSlug}`);
    expect(pubSlugRes.status()).toBe(200);
    const pubSlugData = (await pubSlugRes.json()).data;
    expect(pubSlugData.renderedContent).toContain('<h1>Safe Heading</h1>');
    expect(pubSlugData.viewCount).toBeGreaterThanOrEqual(1);

    // Draft post slug returns 404 on public endpoint
    const draftSlugRes = await request.get(`/api/blog/${draftSlug}`);
    expect(draftSlugRes.status()).toBe(404);

    // 6. Public tag filter
    const tagFilteredRes = await request.get('/api/blog?tag=architecture');
    expect(tagFilteredRes.status()).toBe(200);
    const tagData = (await tagFilteredRes.json()).data;
    expect(tagData.items.some((p: any) => p.id === pubPost.id)).toBe(true);

    // 7. Public search query
    const searchRes = await request.get('/api/blog?search=Safe');
    expect(searchRes.status()).toBe(200);
    const searchData = (await searchRes.json()).data;
    expect(searchData.items.some((p: any) => p.id === pubPost.id)).toBe(true);

    // 8. Clean up created posts
    await request.delete(`/api/admin/blog/${draftPost.id}`);
    await request.delete(`/api/admin/blog/${pubPost.id}`);
  });
});
