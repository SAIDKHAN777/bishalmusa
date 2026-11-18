import { test, expect } from '@playwright/test';

test.describe('Security Hardening & Production Protection (E2E)', () => {
  test('HTTP response must include all strict enterprise security headers', async ({
    request,
  }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);

    const headers = response.headers();

    // 1. Content Security Policy (CSP)
    expect(headers['content-security-policy']).toBeDefined();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");

    // 2. Strict Transport Security (HSTS)
    expect(headers['strict-transport-security']).toBeDefined();
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
    expect(headers['strict-transport-security']).toContain('includeSubDomains');

    // 3. X-Frame-Options
    expect(headers['x-frame-options']).toBe('DENY');

    // 4. X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // 5. Referrer Policy
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

    // 6. Permissions Policy
    expect(headers['permissions-policy']).toBeDefined();
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['permissions-policy']).toContain('microphone=()');
    expect(headers['permissions-policy']).toContain('geolocation=()');
  });

  test('Unauthorized write operations to admin APIs must be rejected with 401', async ({
    request,
  }) => {
    // 1. Unauthorized Project Creation
    const projRes = await request.post('/api/admin/projects', {
      data: {
        title: 'Hacked Project',
        slug: 'hacked-project',
        description: 'Should never be created',
        summary: 'Hack attempt',
      },
    });
    expect(projRes.status()).toBe(401);

    // 2. Unauthorized Message Deletion
    const msgRes = await request.delete('/api/admin/messages/fake-id');
    expect(msgRes.status()).toBe(401);

    // 3. Unauthorized Media Upload
    const mediaRes = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'hack.png',
          mimeType: 'image/png',
          buffer: Buffer.from('unauthorized'),
        },
      },
    });
    expect(mediaRes.status()).toBe(401);
  });

  test('Malformed JSON payloads must return 400 without crashing or leaking stack traces', async ({
    request,
  }) => {
    const response = await request.post('/api/contact', {
      headers: {
        'content-type': 'application/json',
      },
      data: '{"broken_json_string: missing_quotes_and_braces',
    });

    expect(response.status()).toBe(400);
    const bodyText = await response.text();

    // Verify clean JSON structure without stack traces
    expect(bodyText).toContain('INVALID_PAYLOAD');
    expect(bodyText).not.toContain('at ');
    expect(bodyText).not.toContain('node_modules');
    expect(bodyText).not.toContain('/home/');
  });

  test('Oversized JSON payload exceeding 1MB must be rejected with 413 Payload Too Large', async ({
    request,
  }) => {
    // Generate ~1.2MB payload
    const oversizedString = 'x'.repeat(1.2 * 1024 * 1024);

    const response = await request.post('/api/contact', {
      headers: {
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Normal Subject',
        message: oversizedString,
      }),
    });

    expect(response.status()).toBe(413);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('Cross-site state-changing request from untrusted origin must be blocked with 403', async ({
    request,
  }) => {
    const maliciousOrigin = 'https://evil-hacker-site.com';

    const response = await request.post('/api/contact', {
      headers: {
        origin: maliciousOrigin,
      },
      data: {
        name: 'Attacker',
        email: 'attacker@evil.com',
        subject: 'CSRF Attack Attempt',
        message: 'This request originated from an untrusted third party domain.',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('Cross-origin request blocked');
  });
});
