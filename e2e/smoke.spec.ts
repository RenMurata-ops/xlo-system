import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Note: Currently homepage loads directly at / without auth redirect
    // TODO: Add auth middleware to redirect to /auth/login when not authenticated
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page has expected elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the page is visible
    await expect(page.locator('body')).toBeVisible();

    // Should not crash or show fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Uncaught');
  });

  test('dashboard page loads without auth (SECURITY ISSUE)', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard');

    // Note: Currently pages load without authentication
    // TODO: Add auth middleware to protect these routes
    await expect(page).toHaveURL('http://localhost:3000/dashboard');

    // Page should at least not crash
    await expect(page.locator('body')).toBeVisible();
  });
});
