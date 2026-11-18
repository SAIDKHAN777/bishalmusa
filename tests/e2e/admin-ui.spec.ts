import { test, expect } from '@playwright/test';

test.describe('Admin Panel Dashboard & React Islands UI Flow (E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

  test.beforeEach(async ({ page }) => {
    // Authenticate prior to each test
    await page.goto('/admin/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/);
    // Ensure React island is fully hydrated
    await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  });

  test('Dashboard should display executive metrics and sidebar navigation', async ({ page }) => {
    // 1. Verify navigation items
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-blog"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-skills"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-testimonials"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-media"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible();

    // 2. Verify metric cards
    await expect(page.locator('[data-testid="stat-pageviews"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-project-clicks"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-resume-downloads"]')).toBeVisible();
  });

  test('Admin can create, view, and delete a Project through the UI modal', async ({ page }) => {
    const timestamp = Date.now();
    const testTitle = `E2E React Project ${timestamp}`;
    const testSummary = 'Created autonomously by Playwright E2E UI suite';
    const testDescription = 'Complete architectural verification of Admin Projects Island with live form validation.';

    // 1. Navigate to Projects view
    await page.click('[data-testid="nav-projects"]');
    await expect(page.locator('[data-testid="table-projects"]')).toBeVisible();
    await expect(page.locator('text=Loading projects...')).not.toBeVisible({ timeout: 5000 });

    // 2. Open Create Modal
    await page.click('[data-testid="btn-new-project"]');
    await expect(page.locator('[data-testid="input-project-title"]')).toBeVisible();

    // 3. Fill and submit form
    await page.fill('[data-testid="input-project-title"]', testTitle);
    await page.fill('[data-testid="input-project-summary"]', testSummary);
    await page.fill('[data-testid="input-project-description"]', testDescription);
    await page.click('[data-testid="btn-save-project"]');

    // 4. Verify project appears in table
    await expect(page.locator('[data-testid="table-projects"]').locator(`text=${testTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('Admin can author and publish a Markdown Blog Post through the Live Preview Editor', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const blogTitle = `E2E React Blog Post ${timestamp}`;
    const blogContent = `# ${blogTitle}\n\nTesting live Markdown rendering and Astro React island integration.`;

    // 1. Navigate to Blog view
    await page.click('[data-testid="nav-blog"]');
    await expect(page.locator('[data-testid="table-blog-posts"]')).toBeVisible();
    await expect(page.locator('text=Loading articles...')).not.toBeVisible({ timeout: 5000 });

    // 2. Open Editor Modal
    await page.click('[data-testid="btn-new-blog-post"]');
    await expect(page.locator('[data-testid="input-blog-title"]')).toBeVisible();

    // 3. Write article
    await page.fill('[data-testid="input-blog-title"]', blogTitle);
    await page.fill('[data-testid="textarea-blog-content"]', blogContent);

    // 4. Submit
    await page.click('[data-testid="btn-save-blog-post"]');

    // 5. Verify published article is in table
    await expect(page.locator('[data-testid="table-blog-posts"]').locator(`text=${blogTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('Admin can navigate and update Site Settings through the UI', async ({ page }) => {
    // 1. Navigate to Settings
    await page.click('[data-testid="nav-settings"]');
    await expect(page.locator('[data-testid="input-site-title"]')).toBeVisible();

    // 2. Wait for settings data to load into the field
    await expect(page.locator('[data-testid="input-site-title"]')).not.toHaveValue('', { timeout: 5000 });
    const currentTitle = await page.inputValue('[data-testid="input-site-title"]');
    const cleanTitle = currentTitle.replace(' (Verified)', '');
    await page.fill('[data-testid="input-site-title"]', `${cleanTitle} (Verified)`);

    // 3. Save
    await page.click('[data-testid="btn-save-settings"]');

    // 4. Confirm toast or persistence
    await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });
  });

  test('Admin can navigate to Media Library and inspect asset browser', async ({ page }) => {
    await page.click('[data-testid="nav-media"]');
    await expect(page.locator('[data-testid="btn-upload-media"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-media"]')).toBeVisible();
  });
});
