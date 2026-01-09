import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

/**
 * Database Views - Schema Validation E2E Tests
 *
 * These tests verify that database views can be queried without errors:
 * - v_account_overview
 * - v_dashboard_summary
 * - v_rule_performance
 *
 * IMPORTANT: These tests check for schema-related errors that would appear
 * in the UI when database views are queried.
 */

test.describe('Database Views - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('dashboard page queries v_dashboard_summary without errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Wait for dashboard data to load
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // CRITICAL: v_dashboard_summary should not reference non-existent tables
    expect(bodyText).not.toContain('relation "follow_relationships" does not exist');
    expect(bodyText).not.toContain('relation "cta_executions" does not exist');
    expect(bodyText).not.toContain('relation "cta_triggers" does not exist');

    // Should not have other schema errors
    expect(bodyText).not.toContain('column "account_handle" does not exist');
    expect(bodyText).not.toContain('column "like_count" does not exist');

    // No fatal errors
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('dashboard displays statistics', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Dashboard should be functional
    const bodyText = await body.textContent();
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Database Views - Account Overview', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('account pages query v_account_overview with correct column names', async ({ page }) => {
    const accountPages = [
      '/accounts/main',
      '/accounts/follow',
      '/accounts/spam',
    ];

    for (const pagePath of accountPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/auth/login')) {
        continue; // Skip if not authenticated
      }

      await page.waitForTimeout(1500);

      const bodyText = await page.textContent('body');

      // CRITICAL: After migration, these errors should NOT appear
      expect(bodyText).not.toContain('column "account_handle" does not exist');
      expect(bodyText).not.toContain('column "account_name" does not exist');

      // View should exist
      expect(bodyText).not.toContain('relation "v_account_overview" does not exist');

      // No other errors
      expect(bodyText).not.toContain('Application error');
    }
  });
});

test.describe('Database Views - Post Performance', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('posts page does not query non-existent engagement columns', async ({ page }) => {
    await page.goto('/posts');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // CRITICAL: After dropping v_post_performance, these should not appear
    expect(bodyText).not.toContain('column "like_count" does not exist');
    expect(bodyText).not.toContain('column "retweet_count" does not exist');
    expect(bodyText).not.toContain('column "reply_count" does not exist');
    expect(bodyText).not.toContain('column "quote_count" does not exist');
    expect(bodyText).not.toContain('column "impression_count" does not exist');

    // No errors
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Database Views - Engagement Rules', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('engagement pages query v_rule_performance without errors', async ({ page }) => {
    const engagementPages = [
      '/engagement',
      '/engagement/targeted',
    ];

    for (const pagePath of engagementPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/auth/login')) {
        continue;
      }

      await page.waitForTimeout(1500);

      const bodyText = await page.textContent('body');

      // CRITICAL: v_rule_performance should use "handle" not "account_handle"
      expect(bodyText).not.toContain('column "account_handle" does not exist');

      // No errors
      expect(bodyText).not.toContain('Application error');
      expect(bodyText).not.toContain('TypeError');
    }
  });
});

test.describe('Database Views - All Pages Stability', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('all main pages load without database schema errors', async ({ page }) => {
    const allPages = [
      '/dashboard',
      '/accounts/main',
      '/accounts/follow',
      '/accounts/spam',
      '/posts',
      '/engagement',
      '/engagement/targeted',
      '/loops',
      '/templates',
      '/dm-rules',
      '/proxies',
      '/settings/tags',
      '/twitter-apps',
    ];

    const schemaErrors: string[] = [];

    for (const pagePath of allPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/auth/login')) {
        continue;
      }

      await page.waitForTimeout(1000);

      const bodyText = await page.textContent('body');

      // Collect any schema errors
      const errorPatterns = [
        'does not exist',
        'column "account_handle"',
        'column "like_count"',
        'relation "follow_relationships"',
        'relation "cta_executions"',
        'Application error',
      ];

      for (const pattern of errorPatterns) {
        if (bodyText && bodyText.includes(pattern)) {
          schemaErrors.push(`${pagePath}: ${pattern}`);
        }
      }
    }

    // Report all schema errors found
    if (schemaErrors.length > 0) {
      console.error('Schema errors found:', schemaErrors);
    }

    expect(schemaErrors).toHaveLength(0);
  });
});
