import { test, expect } from '@playwright/test';

test.describe('Admin Authentication Flow & Route Protection', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test('should redirect unauthorized visitors from /admin to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('h1')).toContainText('Admin Portal');
  });

  test('should reject unauthorized API calls to /api/admin/auth/me with 401', async ({ request }) => {
    const response = await request.get('/api/admin/auth/me');
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error?.code).toBe('UNAUTHORIZED');
  });

  test('should show error alert when submitting incorrect password', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    const errorAlert = page.locator('#errorAlert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('should successfully log in with valid credentials, access dashboard, and log out', async ({
    page,
    context,
  }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    // 1. Visit login page
    await page.goto('/admin/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', adminPassword);
    await page.click('button[type="submit"]');

    // 2. Expect redirection to /admin dashboard
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('h1')).toContainText('Portfolio Admin');
    await expect(page.locator('text=Active Admin')).toBeVisible();

    // 3. Verify session cookie is set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'admin_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);

    // 4. Test authenticated API access
    const meResponse = await page.request.get('/api/admin/auth/me');
    expect(meResponse.status()).toBe(200);
    const meData = await meResponse.json();
    expect(meData.success).toBe(true);
    expect(meData.data.user.email).toBe(adminEmail);

    // 5. Perform Logout
    const [logoutResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/admin/auth/logout')),
      page.click('#logoutBtn'),
    ]);
    expect(logoutResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/login/);

    // 6. Confirm /admin is locked again
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
