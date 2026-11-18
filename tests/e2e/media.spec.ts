import { test, expect } from '@playwright/test';

test.describe('Media Asset Management & Resume Download (E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('Unauthorized requests to media endpoints should be blocked with 401', async ({ request }) => {
    // 1. List media without session
    const listRes = await request.get('/api/admin/media');
    expect(listRes.status()).toBe(401);

    // 2. Upload without session
    const uploadRes = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from('unauthorized-buffer-content'),
        },
      },
    });
    expect(uploadRes.status()).toBe(401);
  });

  test('Admin can upload image and PDF, view optimized URLs, update alt text, and delete', async ({
    request,
  }) => {
    // 1. Log in as admin
    const loginRes = await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);

    // 2. Upload an image file
    const fakeImageBuffer = Buffer.from('fake-image-binary-stream-for-e2e-testing');
    const imageUploadRes = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'e2e-project-thumbnail.png',
          mimeType: 'image/png',
          buffer: fakeImageBuffer,
        },
        altText: 'Portfolio Project Thumbnail Preview',
      },
    });

    expect(imageUploadRes.status()).toBe(201);
    const uploadedImage = (await imageUploadRes.json()).data;
    expect(uploadedImage.id).toBeDefined();
    expect(uploadedImage.resourceType).toBe('image');
    expect(uploadedImage.altText).toBe('Portfolio Project Thumbnail Preview');
    expect(uploadedImage.optimizedUrl).toContain('f_auto');

    const imageId = uploadedImage.id;

    // 3. Upload a PDF resume document
    const fakePdfBuffer = Buffer.from('%PDF-1.4 simulated resume binary data');
    const pdfUploadRes = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'e2e-saidkhan-resume.pdf',
          mimeType: 'application/pdf',
          buffer: fakePdfBuffer,
        },
        altText: 'Said Khan Senior Software Engineer Resume',
      },
    });

    expect(pdfUploadRes.status()).toBe(201);
    const uploadedPdf = (await pdfUploadRes.json()).data;
    expect(uploadedPdf.resourceType).toBe('raw');
    expect(uploadedPdf.format).toBe('pdf');
    expect(uploadedPdf.optimizedUrl).toContain('raw/upload');

    // 4. List media files (GET /api/admin/media)
    const listRes = await request.get('/api/admin/media?page=1&limit=20');
    expect(listRes.status()).toBe(200);
    const listData = (await listRes.json()).data;
    expect(listData.items.some((item: any) => item.id === imageId)).toBe(true);

    // 5. Get single media with responsive transformations
    const getRes = await request.get(`/api/admin/media/${imageId}?width=800&height=600`);
    expect(getRes.status()).toBe(200);
    const fetchedItem = (await getRes.json()).data;
    expect(fetchedItem.optimizedUrl).toContain('w_800');
    expect(fetchedItem.optimizedUrl).toContain('h_600');

    // 6. Update alt text (PATCH /api/admin/media/[id])
    const patchRes = await request.patch(`/api/admin/media/${imageId}`, {
      data: { altText: 'Updated High-Resolution Project Showcase' },
    });
    expect(patchRes.status()).toBe(200);
    const patchedData = (await patchRes.json()).data;
    expect(patchedData.altText).toBe('Updated High-Resolution Project Showcase');

    // 7. Delete media asset (DELETE /api/admin/media/[id])
    const deleteRes = await request.delete(`/api/admin/media/${imageId}`);
    expect(deleteRes.status()).toBe(200);

    // Verify asset is deleted from database
    const verifyGetRes = await request.get(`/api/admin/media/${imageId}`);
    expect(verifyGetRes.status()).toBe(404);
  });

  test('Upload should reject unsupported file formats with 400', async ({ request }) => {
    // 1. Log in as admin
    await request.post('/api/admin/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });

    // 2. Attempt to upload an executable script
    const badUploadRes = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'malicious.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('MZ executable code'),
        },
      },
    });

    expect(badUploadRes.status()).toBe(400);
    const body = await badUploadRes.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('Public Resume Download endpoint should track download and redirect with 302', async ({
    request,
  }) => {
    const response = await request.get('/api/resume/download', {
      maxRedirects: 0, // Catch 302 redirect directly
      headers: {
        'x-forwarded-for': '198.51.100.99',
        referer: 'https://linkedin.com/in/saidkhan',
      },
    });

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toBeDefined();
    expect(location).toContain('.pdf');

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.resumeUrl).toBe(location);
  });
});
