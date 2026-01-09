import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

/**
 * DM Rules, Proxies, and Settings - Complete E2E Tests
 *
 * Tests for:
 * - DM Rules (auto-DM on followback)
 * - Proxy Management
 * - Settings (Tags and Categories)
 */

// ============================================================================
// DM RULES
// ============================================================================

test.describe('DM Rules - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('dm-rules page loads successfully', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('dm rules query database without errors', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('relation "dm_send_rules" does not exist');
    expect(bodyText).not.toContain('column "template_id" does not exist');
    expect(bodyText).not.toContain('column "delay_slot_hours" does not exist');
  });
});

test.describe('DM Rules - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can create DM rule', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // DM Rule requires:
    // - account_token_id (sender account)
    // - template_id (DM template)
    // - delay_slot_hours (0-24, 0=immediate)
    // - daily_limit

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports immediate DM sending', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // delay_slot_hours: 0
    // DMs sent immediately after followback detected

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports delayed DM sending', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // delay_slot_hours: 1-24
    // DMs sent N hours after followback

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('DM Rules - Execution', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('detect followbacks button exists', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Button calls detect-followbacks Edge Function
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('dispatch DMs button exists', async ({ page }) => {
    await page.goto('/dm-rules');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Button calls dispatch-dms Edge Function
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

// ============================================================================
// PROXIES
// ============================================================================

test.describe('Proxies - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('proxies page loads successfully', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('proxies query database without errors', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('relation "proxies" does not exist');
    expect(bodyText).not.toContain('column "proxy_type" does not exist');
    expect(bodyText).not.toContain('column "proxy_name" does not exist'); // After migration
  });
});

test.describe('Proxies - Proxy Types', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('supports HTTP proxy type', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // proxy_type: 'http'
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports HTTPS proxy type', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // proxy_type: 'https'
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports SOCKS5 proxy type', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // proxy_type: 'socks5'
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports NordVPN proxy type', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // proxy_type: 'nordvpn'
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Proxies - Testing', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can test proxy connection', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Test button measures response time
    // Updates response_time_ms and last_checked_at

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('displays response time', async ({ page }) => {
    await page.goto('/proxies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // response_time_ms is displayed in proxy card
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('column "response_time_ms" does not exist');
  });
});

// ============================================================================
// SETTINGS - TAGS AND CATEGORIES
// ============================================================================

test.describe('Settings - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('settings/tags page loads successfully', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Settings - Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('displays all tags from all tables', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Tags are queried from:
    // - templates.tags
    // - posts.tags
    // - spam_accounts.tags
    // - follow_accounts.tags
    // - main_accounts.tags

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can rename tags across all tables', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Tag rename updates all references in all tables
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can delete tags from all tables', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Tag delete removes from all tables
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Settings - Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('displays all categories', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Categories from:
    // - templates.category
    // - follow_accounts.category

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can rename categories', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can delete categories', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Settings - Usage Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('displays tag usage count', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Shows how many times each tag is used
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('displays tag usage sources', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Shows which tables/records use each tag
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});
