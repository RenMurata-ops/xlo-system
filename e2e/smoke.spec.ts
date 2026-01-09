import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login page if not authenticated
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page has expected elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the page is visible
    await expect(page.locator('body')).toBeVisible();

    // Should not crash or show fatal errors
    const errorText = await page.textContent('body');
    expect(errorText).not.toContain('Application error');
    expect(errorText).not.toContain('Uncaught');
  });

  test('dashboard page requires authentication', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
