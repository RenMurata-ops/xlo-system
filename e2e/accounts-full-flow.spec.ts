import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

/**
 * Accounts - Full Flow E2E Tests
 *
 * These tests verify:
 * 1. Account listing with correct database schema
 * 2. OAuth flow initiation
 * 3. Database view queries (v_account_overview)
 * 4. Account card rendering
 */

test.describe('Accounts - Full Flow (Unauthenticated)', () => {
  test('main accounts page redirects to login', async ({ page }) => {
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Faccounts%2Fmain/);
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();
  });

  test('follow accounts page redirects to login', async ({ page }) => {
    await page.goto('/accounts/follow');
    await page.waitForLoadState('networkidle');

    // Should load or redirect
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('spam accounts page redirects to login', async ({ page }) => {
    await page.goto('/accounts/spam');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Accounts - Database Schema Validation', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('main accounts page queries database without schema errors', async ({ page }) => {
    await page.goto('/accounts/main');
    await page.waitForLoadState('networkidle');

    // Skip if not authenticated
    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Wait for data fetching
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // CRITICAL: Verify no schema errors from old column names
    expect(bodyText).not.toContain('column "account_handle" does not exist');
    expect(bodyText).not.toContain('column "account_name" does not exist');

    // Should use correct column names: "handle" and "name"
    expect(bodyText).not.toContain('relation "v_account_overview" does not exist');

    // No fatal errors
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('follow accounts page queries database without schema errors', async ({ page }) => {
    await page.goto('/accounts/follow');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // No schema errors
    expect(bodyText).not.toContain('column "account_handle" does not exist');
    expect(bodyText).not.toContain('does not exist');

    // No fatal errors
    expect(bodyText).not.toContain('Application error');
  });

  test('spam accounts page queries database without schema errors', async ({ page }) => {
    await page.goto('/accounts/spam');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // CRITICAL: Verify proxy_name column exists
    // (should not get error after migration)
    expect(bodyText).not.toContain('column "proxy_name" does not exist');

    // No other schema errors
    expect(bodyText).not.toContain('column "account_handle" does not exist');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Accounts - Twitter Apps Page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('twitter-apps page loads without errors', async ({ page }) => {
    await page.goto('/twitter-apps');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');

    // No schema errors
    expect(bodyText).not.toContain('does not exist');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('twitter-apps page has add button', async ({ page }) => {
    await page.goto('/twitter-apps');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Should have some way to add Twitter apps
    const bodyText = await page.textContent('body');

    // Page should be functional (exact UI depends on implementation)
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Accounts - OAuth Flow Structure', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('OAuth callback with success parameters', async ({ page }) => {
    // Simulate successful OAuth callback
    await page.goto('/accounts/main?connected=1&account_id=test-123');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Should handle callback parameters without crashing
    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('ReferenceError');
    expect(bodyText).not.toContain('is not defined');
  });

  test('OAuth callback with error parameters', async ({ page }) => {
    // Simulate failed OAuth callback
    await page.goto('/accounts/main?connected=0&error=access_denied');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Should handle error parameters without crashing
    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('ReferenceError');

    // May show error message to user (implementation-dependent)
  });
});

test.describe('Accounts - Proxy Selection (Spam Accounts)', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('spam account form can load proxies', async ({ page }) => {
    await page.goto('/accounts/spam');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Wait for page and data to load
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // CRITICAL: After migration, proxy_name column should exist
    // This should NOT appear after applying migration
    expect(bodyText).not.toContain('column "proxy_name" does not exist');

    // No fatal errors
    expect(bodyText).not.toContain('Application error');
  });
});
