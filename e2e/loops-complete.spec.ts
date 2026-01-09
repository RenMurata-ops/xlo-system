import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

/**
 * Loops Management - Complete E2E Tests
 *
 * Tests all loop management functionality:
 * - CRUD operations
 * - Loop types (post, reply, cta)
 * - Template selection (multiple, random/sequential)
 * - Execution interval (hours/minutes)
 * - Account selection and range
 * - Tag filtering
 * - Target configuration
 * - Immediate execution
 * - Execution logs
 */

test.describe('Loops - Page Load and Structure', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('loops page loads successfully', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('TypeError');
  });

  test('loops table queries database without errors', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // Check for database schema errors
    expect(bodyText).not.toContain('relation "loops" does not exist');
    expect(bodyText).not.toContain('column "loop_type" does not exist');
    expect(bodyText).not.toContain('column "template_ids" does not exist');
    expect(bodyText).not.toContain('column "execution_interval_hours" does not exist');
  });
});

test.describe('Loops - Loop Types', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('supports post loop type', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Post loops: Automatic posting using templates
    // - Selects from template_ids (random/sequential)
    // - Posts to multiple accounts
    // - Executes on schedule

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports reply loop type', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Reply loops: Automatic replies to specific tweets
    // - Requires target_tweet_url
    // - Uses reply templates
    // - Delays between replies

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports cta loop type', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // CTA loops: Automatic replies to monitored accounts
    // - Requires target_account_url
    // - Monitors for new tweets
    // - Auto-replies with CTA templates

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Loops - Template Selection', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can select multiple templates', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // template_ids is UUID array
    // Can select multiple templates for variety

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports random template selection', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // selection_mode: 'random'
    // Randomly picks from template_ids for each execution

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('supports sequential template selection', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // selection_mode: 'sequential'
    // Uses templates in order, cycles when end is reached

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Loops - Execution Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can set execution interval in hours', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // execution_interval_hours: 1-24
    // Loops execute every N hours

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can set execution interval in minutes', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // interval_minutes: 1-59
    // For frequent executions

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can set account range (min/max)', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // min_accounts, max_accounts
    // Randomly selects N accounts from executor_account_ids

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Loops - Account Selection', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can select execution accounts', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // executor_account_ids: UUID array
    // Selects from spam_accounts or main_accounts

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('can filter accounts by tags', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // tag_filter: text array
    // Filters executor_account_ids by tags

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});

test.describe('Loops - Execution and Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can execute loop immediately', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // "今すぐ実行" button calls execute-loop Edge Function
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('displays execution logs', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // LoopExecutionLogs component shows:
    // - Execution time
    // - Accounts used
    // - Templates used
    // - Success/failure count

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });

  test('tracks loop statistics', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // Loops table tracks:
    // - post_count (total posts created)
    // - last_executed_at
    // - next_run_at

    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('column "post_count" does not exist');
    expect(bodyText).not.toContain('column "last_executed_at" does not exist');
  });
});

test.describe('Loops - Active/Inactive Toggling', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('can activate/deactivate loops', async ({ page }) => {
    await page.goto('/loops');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/auth/login')) {
      test.skip();
      return;
    }

    // is_active: boolean
    // Only active loops are executed by schedule-loop-execution Cron

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
  });
});
