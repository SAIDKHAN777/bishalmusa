import { test, expect } from '@playwright/test';

test.describe('Privacy-First Analytics Engine & Admin Metrics (E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('Client analytics.js script must be publicly accessible and under 1 KB', async ({
    request,
  }) => {
    const response = await request.get('/analytics.js');
    expect(response.status()).toBe(200);

    const bodyText = await response.text();
    const byteLength = Buffer.byteLength(bodyText, 'utf8');

    // Strict constraint: Must be under 1 KB (1024 bytes)
    expect(byteLength).toBeLessThan(1024);
    expect(bodyText).toContain('sendBeacon');
    expect(bodyText).toContain('/api/analytics/pageview');
    expect(bodyText).toContain('/api/analytics/project-click');
  });

  test('Public pageview endpoint should record legitimate browser views and ignore crawlers', async ({
    request,
  }) => {
    // 1. Human visitor page view
    const humanResponse = await request.post('/api/analytics/pageview', {
      headers: {
        'x-forwarded-for': '198.51.100.22',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      data: {
        path: '/e2e-analytics-test-page',
        referrer: 'https://github.com',
      },
    });

    expect(humanResponse.status()).toBe(200);
    const humanBody = await humanResponse.json();
    expect(humanBody.success).toBe(true);
    expect(humanBody.data.recorded).toBe(true);
    expect(humanBody.data.id).toBeDefined();

    // 2. Crawler / Bot page view (Googlebot)
    const botResponse = await request.post('/api/analytics/pageview', {
      headers: {
        'x-forwarded-for': '66.249.66.1',
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      data: {
        path: '/e2e-analytics-test-page',
      },
    });

    expect(botResponse.status()).toBe(200);
    const botBody = await botResponse.json();
    expect(botBody.success).toBe(true);
    expect(botBody.data.recorded).toBe(false);
    expect(botBody.data.ignored).toBe(true);
  });

  test('Project click tracking should record interactions and reject missing projects', async ({
    request,
  }) => {
    // 1. First log in as admin to create a test project
    await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });

    const createProjRes = await request.post('/api/admin/projects', {
      data: {
        title: 'E2E Analytics Clickable Project',
        slug: 'e2e-analytics-click-proj-' + Date.now(),
        summary: 'Testing click delegation tracking',
        description: 'Comprehensive project description for E2E click analytics',
        demoUrl: 'https://demo.example.com',
        githubUrl: 'https://github.com/saidkhan/demo',
        status: 'PUBLISHED',
      },
    });
    expect(createProjRes.status()).toBe(201);
    const projectId = (await createProjRes.json()).data.id;

    // 2. Record DEMO click
    const demoClickRes = await request.post('/api/analytics/project-click', {
      headers: {
        'x-forwarded-for': '198.51.100.33',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      data: {
        projectId,
        type: 'DEMO',
      },
    });

    expect(demoClickRes.status()).toBe(200);
    const demoBody = await demoClickRes.json();
    expect(demoBody.success).toBe(true);
    expect(demoBody.data.recorded).toBe(true);

    // 3. Record GITHUB click
    const ghClickRes = await request.post('/api/analytics/project-click', {
      headers: {
        'x-forwarded-for': '198.51.100.34',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      data: {
        projectId,
        type: 'GITHUB',
      },
    });

    expect(ghClickRes.status()).toBe(200);
    const ghBody = await ghClickRes.json();
    expect(ghBody.success).toBe(true);
    expect(ghBody.data.recorded).toBe(true);

    // 4. Invalid project ID should return 404
    const notFoundRes = await request.post('/api/analytics/project-click', {
      data: {
        projectId: 'cmw-invalid-project-id-99999',
        type: 'DEMO',
      },
    });
    expect(notFoundRes.status()).toBe(404);
  });

  test('Admin Stats endpoint should require auth and return aggregated metrics', async ({
    request,
  }) => {
    // 1. Unauthorized request must be rejected with 401
    const unauthRes = await request.get('/api/admin/analytics/stats');
    expect(unauthRes.status()).toBe(401);

    // 2. Log in as admin
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);

    // 3. Request stats with range=30d
    const statsRes = await request.get('/api/admin/analytics/stats?range=30d');
    expect(statsRes.status()).toBe(200);
    const body = await statsRes.json();

    expect(body.success).toBe(true);
    const data = body.data;

    expect(data.range).toBe('30d');
    expect(typeof data.totalPageViews).toBe('number');
    expect(typeof data.uniqueVisitors).toBe('number');
    expect(typeof data.totalResumeDownloads).toBe('number');
    expect(Array.isArray(data.topPages)).toBe(true);
    expect(Array.isArray(data.topProjects)).toBe(true);
    expect(Array.isArray(data.viewsPerDay)).toBe(true);
    expect(data.viewsPerDay.length).toBe(30);

    // Check viewsPerDay structure
    expect(data.viewsPerDay[0]).toHaveProperty('date');
    expect(data.viewsPerDay[0]).toHaveProperty('views');
  });
});
