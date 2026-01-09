import { test, expect } from '@playwright/test';

/**
 * Posts Management Flow E2E Tests
 * Tests post creation and management UI
 *
 * Note: Tests verify UI structure and page stability without authentication
 */
test.describe('Posts Management Page', () => {
  test('posts page loads without crashing', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    // Page should load (no server-side auth redirect currently)
    await expect(page).toHaveURL('http://localhost:3000/posts');

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();

    // Check for no fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Uncaught');
  });

  test('posts page renders without errors', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    // Check for no TypeScript or React errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('ReferenceError');
    expect(bodyText).not.toContain('is not defined');
  });
});

/**
 * Related Content Management Pages
 */
test.describe('Content Management Pages', () => {
  test('engagement page loads', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('targeted engagement page loads', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('loops page loads', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('templates page loads', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('dm-rules page loads', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('proxies page loads', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('settings/tags page loads', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

/**
 * Application Stability Tests
 * Ensures the app doesn't crash when navigating between pages
 */
test.describe('Application Stability', () => {
  test('app handles navigation between protected routes', async ({ page }) => {
    const routes = [
      '/dashboard',
      '/posts',
      '/accounts/main',
      '/engagement',
      '/loops',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Should load successfully
      await expect(page.locator('body')).toBeVisible();

      // No crashes
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');
    }
  });

  test('app handles rapid page transitions', async ({ page }) => {
    // Navigate rapidly between pages
    await page.goto('/dashboard');
    await page.goto('/posts');
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    // Should end up stable
    await expect(page.locator('body')).toBeVisible();

    // No errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});
