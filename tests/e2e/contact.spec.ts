import { test, expect } from '@playwright/test';

test.describe('Contact Form, Spam Protection & Admin Inbox (E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';
  const getRandomIp = () => `198.51.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250) + 1}`;

  test('Valid contact form submission should succeed and store message', async ({ request }) => {
    const response = await request.post('/api/contact', {
      headers: {
        'x-forwarded-for': getRandomIp(),
      },
      data: {
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        subject: 'Engineering Consultation',
        message: 'Hello Said, we are interested in your backend development and DevOps consulting services.',
        website_url_check: '',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.message).toContain('received');
  });

  test('Invalid submission should return 400 with validation errors', async ({ request }) => {
    const response = await request.post('/api/contact', {
      headers: {
        'x-forwarded-for': getRandomIp(),
      },
      data: {
        name: 'A', // too short
        email: 'invalid-email-string',
        subject: '',
        message: 'short',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.length).toBeGreaterThanOrEqual(1);
  });

  test('Honeypot submission should silently flag message as spam and succeed without notifying', async ({
    request,
  }) => {
    // 1. Submit honeypot form (bot fills website_url_check)
    const spamResponse = await request.post('/api/contact', {
      headers: {
        'x-forwarded-for': getRandomIp(),
      },
      data: {
        name: 'Crypto Scammer',
        email: 'crypto.bot@spamnetwork.com',
        subject: 'Crypto investment opportunity',
        message: 'Invest now to make guaranteed 500% daily returns!',
        website_url_check: 'https://fakecrypto-promo.com', // Honeypot trap
      },
    });

    expect(spamResponse.status()).toBe(201);
    const spamBody = await spamResponse.json();
    expect(spamBody.success).toBe(true);
    const spamId = spamBody.data.id;

    // 2. Login as admin and verify message is marked as isSpam: true
    await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });

    const checkMsgRes = await request.get(`/api/admin/messages/${spamId}`);
    expect(checkMsgRes.status()).toBe(200);
    const msgData = (await checkMsgRes.json()).data;
    expect(msgData.isSpam).toBe(true);
  });

  test('IP Rate limiting should allow maximum 3 submissions per hour and return 429 on 4th', async ({
    request,
  }) => {
    const uniqueSegment = Math.floor(Date.now() / 1000) % 250;
    const randomSegment = Math.floor(Math.random() * 250) + 1;
    const rateLimitedIp = `203.0.${uniqueSegment}.${randomSegment}`;

    // Send 3 allowed submissions
    for (let i = 1; i <= 3; i++) {
      const res = await request.post('/api/contact', {
        headers: { 'x-forwarded-for': rateLimitedIp },
        data: {
          name: `Rate Test User ${i}`,
          email: `rate.test.${i}@example.com`,
          subject: `Rate Test Subject ${i}`,
          message: `This is a rate test message body number ${i} with enough length.`,
          website_url_check: '',
        },
      });
      expect(res.status()).toBe(201);
    }

    // 4th submission must be rejected with HTTP 429
    const blockedRes = await request.post('/api/contact', {
      headers: { 'x-forwarded-for': rateLimitedIp },
      data: {
        name: 'Rate Test User 4',
        email: 'rate.test.4@example.com',
        subject: 'Rate Test Subject 4',
        message: 'This is the 4th message from the same IP within an hour and should be blocked.',
        website_url_check: '',
      },
    });

    expect(blockedRes.status()).toBe(429);
    const blockedBody = await blockedRes.json();
    expect(blockedBody.success).toBe(false);
    expect(blockedBody.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  test('Admin can list, view, mark as read, and delete contact messages', async ({ request }) => {
    // 1. Submit a fresh contact message
    const submitRes = await request.post('/api/contact', {
      headers: { 'x-forwarded-for': getRandomIp() },
      data: {
        name: 'Prospective Client',
        email: 'client@company.org',
        subject: 'Full-stack Next.js and Fastify Architecture',
        message: 'We are seeking an expert for a 6-month contract on our enterprise platform.',
        website_url_check: '',
      },
    });
    expect(submitRes.status()).toBe(201);
    const messageId = (await submitRes.json()).data.id;

    // 2. Login as admin
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);

    // 3. List messages
    const listRes = await request.get('/api/admin/messages?page=1&limit=20');
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.items.some((m: any) => m.id === messageId)).toBe(true);

    // 4. View single message
    const viewRes = await request.get(`/api/admin/messages/${messageId}`);
    expect(viewRes.status()).toBe(200);
    const viewData = (await viewRes.json()).data;
    expect(viewData.name).toBe('Prospective Client');
    expect(viewData.isRead).toBe(false);

    // 5. Mark as read (PATCH)
    const patchRes = await request.patch(`/api/admin/messages/${messageId}`, {
      data: { isRead: true },
    });
    expect(patchRes.status()).toBe(200);
    const patchData = (await patchRes.json()).data;
    expect(patchData.isRead).toBe(true);

    // 6. Delete message (DELETE)
    const deleteRes = await request.delete(`/api/admin/messages/${messageId}`);
    expect(deleteRes.status()).toBe(200);

    // Verify it is no longer returned in active list
    const afterDeleteRes = await request.get(`/api/admin/messages`);
    const afterList = (await afterDeleteRes.json()).data.items;
    expect(afterList.some((m: any) => m.id === messageId)).toBe(false);
  });
});
