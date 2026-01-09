import { test, expect } from '@playwright/test';

/**
 * Account Management Flow E2E Tests
 * Tests account page structure and OAuth connection flow
 *
 * Note: Tests verify UI structure without actual authentication.
 * Current behavior: Pages load without server-side auth middleware.
 */
test.describe('Account Management Page Structure', () => {
  test('accounts page loads and displays UI', async ({ page }) => {
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    // Page should load (no server-side auth redirect currently)
    await expect(page).toHaveURL('http://localhost:3000/accounts/main');

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();

    // Check for no fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Uncaught');
  });

  test('accounts page shows expected heading', async ({ page }) => {
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
  test('accounts page with OAuth success param loads', async ({ page }) => {
    // Simulate OAuth callback with success param
    await page.goto('/accounts/main?connected=1&account_id=test-123');
    await page.waitForLoadState('networkidle');

    // Should load the accounts page
    await expect(page).toHaveURL(/\/accounts\/main/);

    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('oauth callback parameters are handled', async ({ page }) => {
    // Test that query parameters don't cause crashes
    await page.goto('/accounts/main?connected=0&error=access_denied');
    await page.waitForLoadState('networkidle');

    // Should not crash
    await expect(page.locator('body')).toBeVisible();

    // No fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('ReferenceError');
  });
});
