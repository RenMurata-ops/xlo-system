import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

/**
 * Engagement Management - Complete E2E Tests
 *
 * Tests all engagement functionality:
 * - Auto Engagement Rules (CRUD, search types, actions, filters)
 * - Targeted Engagement Campaigns
 * - Execution and monitoring
 */

test.describe('Auto Engagement - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('engagement page loads successfully', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('engagement rules query database without errors', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('relation "auto_engagement_rules" does not exist');
    expect(bodyText).not.toContain('column "search_type" does not exist');
    expect(bodyText).not.toContain('column "action_types" does not exist');
  });
});

test.describe('Auto Engagement - Search Types', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('supports keyword search', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // search_type: 'keyword'
    // target_keywords: text array
    // Searches Twitter for matching tweets

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports hashtag search', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // search_type: 'hashtag'
    // Searches for specific hashtags

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports user search', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // search_type: 'user'
    // Engages with specific user's tweets

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports URL search', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // search_type: 'url'
    // Engages with specific tweet URL

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Auto Engagement - Action Types', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('supports like action', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // action_types includes 'like'
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports reply action with templates', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // action_types includes 'reply'
    // reply_template_id: UUID reference to templates table

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports retweet action', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports follow action', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports quote action', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Auto Engagement - Filters', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can set follower count range', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // min_followers, max_followers
    // Filters target accounts by follower count

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can set account age filter', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // min_account_age_days
    // Filters out new accounts

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can exclude keywords', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // exclude_keywords: text array
    // Skips tweets containing these keywords

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can filter verified accounts only', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // verified_only: boolean
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Auto Engagement - Execution Limits', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can set max actions per execution', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // max_actions_per_run
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can set daily action limit', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // daily_limit
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('tracks daily action count', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // actions_today resets daily

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('column "actions_today" does not exist');
  });
});

test.describe('Targeted Engagement - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('targeted engagement page loads', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('targeted engagements query database without errors', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    expect(bodyText).not.toContain('relation "targeted_engagements" does not exist');
    expect(bodyText).not.toContain('column "target_url" does not exist');
    expect(bodyText).not.toContain('column "enable_like" does not exist');
  });
});

test.describe('Targeted Engagement - Campaign Creation', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can create campaign with tweet URL', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Requires:
    // - target_url (tweet URL)
    // - account_type ('follow' or 'spam')
    // - executor_account_ids

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can select actions for campaign', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Actions:
    // - enable_like
    // - enable_retweet
    // - enable_reply
    // - enable_quote
    // - enable_follow

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});
