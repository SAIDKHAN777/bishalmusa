import { test, expect } from '@playwright/test';

test.describe('Content APIs: Public Access & Protected Admin CRUD', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('Public Endpoints should return 200 without authentication', async ({ request }) => {
    const endpoints = [
      '/api/projects',
      '/api/categories',
      '/api/skills',
      '/api/services',
      '/api/experience',
      '/api/education',
      '/api/testimonials',
      '/api/settings',
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    }
  });

  test('Protected Admin Endpoints should reject unauthorized write operations with 401', async ({
    request,
  }) => {
    // 1. Unauthorized Project creation
    const postProj = await request.post('/api/admin/projects', {
      data: { title: 'Hacked Project', slug: 'hacked-project' },
    });
    expect(postProj.status()).toBe(401);
    expect((await postProj.json()).error.code).toBe('UNAUTHORIZED');

    // 2. Unauthorized Category creation
    const postCat = await request.post('/api/admin/categories', {
      data: { name: 'Hacked Category', slug: 'hacked-category' },
    });
    expect(postCat.status()).toBe(401);

    // 3. Unauthorized Settings update
    const putSettings = await request.put('/api/admin/settings', {
      data: { siteName: 'Defaced Site' },
    });
    expect(putSettings.status()).toBe(401);

    // 4. Unauthorized Delete
    const deleteProj = await request.delete('/api/admin/projects/fake-id-123');
    expect(deleteProj.status()).toBe(401);
  });

  test('Authenticated Admin can perform full CRUD lifecycle on Content entities', async ({
    request,
  }) => {
    // 1. Log in as admin to obtain session cookie
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);

    // 2. Create Category
    const timestamp = Date.now();
    const catSlug = 'e2e-cat-' + timestamp;
    const createCatRes = await request.post('/api/admin/categories', {
      data: {
        name: 'E2E Architecture ' + timestamp,
        slug: catSlug,
        description: 'End-to-end test category',
      },
    });
    expect(createCatRes.status()).toBe(201);
    const catData = (await createCatRes.json()).data;
    expect(catData.id).toBeDefined();

    // 3. Create Project as DRAFT
    const projSlug = 'e2e-project-' + Date.now();
    const createProjRes = await request.post('/api/admin/projects', {
      data: {
        title: 'E2E Test Project',
        slug: projSlug,
        summary: 'A project created via Playwright E2E test',
        description: 'Detailed description of E2E architecture project',
        status: 'DRAFT',
        featured: true,
        categoryId: catData.id,
        tags: ['E2E', 'Automation'],
      },
    });
    expect(createProjRes.status()).toBe(201);
    const projData = (await createProjRes.json()).data;
    expect(projData.id).toBeDefined();
    expect(projData.status).toBe('DRAFT');

    // 4. Public API should NOT list this project (since it is DRAFT)
    const publicList1 = await (await request.get('/api/projects')).json();
    expect(publicList1.data.items.some((p: any) => p.id === projData.id)).toBe(false);

    // 5. Update Project to PUBLISHED
    const updateProjRes = await request.put(`/api/admin/projects/${projData.id}`, {
      data: {
        status: 'PUBLISHED',
      },
    });
    expect(updateProjRes.status()).toBe(200);
    expect((await updateProjRes.json()).data.status).toBe('PUBLISHED');

    // 6. Public API should NOW list this project
    const publicList2 = await (await request.get('/api/projects')).json();
    expect(publicList2.data.items.some((p: any) => p.id === projData.id)).toBe(true);

    // 7. Get by Slug increments view count
    const getSlugRes = await request.get(`/api/projects/${projSlug}`);
    expect(getSlugRes.status()).toBe(200);
    const slugData = (await getSlugRes.json()).data;
    expect(slugData.slug).toBe(projSlug);
    expect(slugData.viewsCount).toBeGreaterThanOrEqual(1);

    // 8. Delete Project (soft delete)
    const deleteRes = await request.delete(`/api/admin/projects/${projData.id}`);
    expect(deleteRes.status()).toBe(200);

    // 9. Confirm Project no longer in public list
    const publicList3 = await (await request.get('/api/projects')).json();
    expect(publicList3.data.items.some((p: any) => p.id === projData.id)).toBe(false);

    // 10. Clean up Category
    await request.delete(`/api/admin/categories/${catData.id}`);
  });
});
