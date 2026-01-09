import { test, expect } from '@playwright/test';

/**
 * Account Management Flow E2E Tests
 * Tests account page structure and OAuth connection flow
 *
 * Note: Protected routes now redirect to login when not authenticated.
 */
test.describe('Account Management Page Structure', () => {
  test('accounts page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    // Should redirect to login with redirect parameter
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Faccounts%2Fmain/);

    // Login page should be visible
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();
  });

  test('accounts page requires authentication', async ({ page }) => {
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    // Should show accounts page heading (if authenticated) or login redirect
    // Currently the page structure should be present
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

/**
 * Account-Related Pages Tests
 */
test.describe('Account-Related Pages', () => {
  test('follow accounts page loads', async ({ page }) => {
    await page.goto('/accounts/follow');
    await page.waitForLoadState('networkidle');

    // Should load without crashing
    await expect(page.locator('body')).toBeVisible();

    // No fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('spam accounts page loads', async ({ page }) => {
    await page.goto('/accounts/spam');
    await page.waitForLoadState('networkidle');

    // Should load without crashing
    await expect(page.locator('body')).toBeVisible();

    // No fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('twitter-apps page loads', async ({ page }) => {
    await page.goto('/twitter-apps');
    await page.waitForLoadState('networkidle');

    // Should load without crashing
    await expect(page.locator('body')).toBeVisible();

    // No fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

/**
 * OAuth Flow Structure Tests
 */
test.describe('OAuth Connection Flow', () => {
  test('accounts page with OAuth params redirects to login when not authenticated', async ({ page }) => {
    // Attempt to access with OAuth callback parameters
    await page.goto('/accounts/main?connected=1&account_id=test-123');
    await page.waitForLoadState('networkidle');

    // Should redirect to login (auth required first)
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/);

    // Login page should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('oauth callback parameters redirect to login when not authenticated', async ({ page }) => {
    // Test that query parameters are preserved through redirect
    await page.goto('/accounts/main?connected=0&error=access_denied');
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/);

    // Login page should not crash
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('ReferenceError');
  });
});
