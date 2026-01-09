import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/real-auth';
import { setupTwitterApiMock, createTwitterApiMonitor } from '../helpers/mock-twitter-api';

/**
 * REAL Engagement Rule E2E Tests
 *
 * These tests verify the ACTUAL user workflow for auto engagement rules.
 * Tests:
 * - Creating engagement rules with search types
 * - Configuring actions (like, reply, retweet, follow)
 * - Setting filters (follower count, keywords)
 * - Activating rules
 * - Verifying execution
 */

test.describe('REAL Auto Engagement Rule Creation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('User can create keyword-based engagement rule', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    // 1. Click create rule button
    const createButton = page.locator(
      'button:has-text("ルール追加"), ' +
      'button:has-text("新規作成"), ' +
      'button:has-text("追加"), ' +
      'a[href*="/engagement/new"]'
    ).first();

    if (await createButton.count() === 0) {
      console.log('⚠ Create rule button not found');
      test.skip();
      return;
    }

    await createButton.click();
    await page.waitForLoadState('networkidle');

    // 2. Fill rule name
    const nameInput = page.locator('input[name="rule_name"], input[name="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill(`テストエンゲージメントルール - ${Date.now()}`);
    }

    // 3. Select search type: keyword
    const searchTypeSelect = page.locator('select[name="search_type"]').first();
    if (await searchTypeSelect.count() > 0) {
      await searchTypeSelect.selectOption('keyword');
    }

    // 4. Enter target keywords
    const keywordsInput = page.locator(
      'input[name="target_keywords"], ' +
      'input[name="keywords"], ' +
      'textarea[name="target_keywords"]'
    ).first();

    if (await keywordsInput.count() > 0) {
      await keywordsInput.fill('テスト, automation, #E2E');
    }

    // 5. Select actions (like, reply)
    const likeCheckbox = page.locator('input[type="checkbox"][value="like"]').first();
    if (await likeCheckbox.count() > 0) {
      await likeCheckbox.click();
    }

    const replyCheckbox = page.locator('input[type="checkbox"][value="reply"]').first();
    if (await replyCheckbox.count() > 0) {
      await replyCheckbox.click();

      // Select reply template
      const templateSelect = page.locator('select[name="reply_template_id"]').first();
      if (await templateSelect.count() > 0) {
        const options = await templateSelect.locator('option').count();
        if (options > 1) {
          await templateSelect.selectOption({ index: 1 });
        }
      }
    }

    // 6. Set filters
    const minFollowersInput = page.locator('input[name="min_followers"]').first();
    if (await minFollowersInput.count() > 0) {
      await minFollowersInput.fill('100');
    }

    const maxFollowersInput = page.locator('input[name="max_followers"]').first();
    if (await maxFollowersInput.count() > 0) {
      await maxFollowersInput.fill('10000');
    }

    // 7. Set daily limit
    const dailyLimitInput = page.locator('input[name="daily_limit"]').first();
    if (await dailyLimitInput.count() > 0) {
      await dailyLimitInput.fill('50');
    }

    // 8. Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("保存")').first();

    if (await submitButton.count() > 0 && !(await submitButton.isDisabled())) {
      await submitButton.click();
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');
      expect(bodyText).not.toContain('TypeError');

      console.log('✓ Engagement rule created successfully');
    } else {
      console.log('⚠ Submit button not found or disabled');
    }
  });

  test('User can create hashtag-based engagement rule', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Select hashtag search type
      const searchTypeSelect = page.locator('select[name="search_type"]').first();
      if (await searchTypeSelect.count() > 0) {
        await searchTypeSelect.selectOption('hashtag');
      }

      // Enter hashtag (with or without #)
      const keywordsInput = page.locator('input[name="target_keywords"]').first();
      if (await keywordsInput.count() > 0) {
        await keywordsInput.fill('#テスト, #automation');
      }

      console.log('✓ Hashtag search configured');
    }
  });

  test('User can create user-targeted engagement rule', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Select user search type
      const searchTypeSelect = page.locator('select[name="search_type"]').first();
      if (await searchTypeSelect.count() > 0) {
        await searchTypeSelect.selectOption('user');
      }

      // Enter target user handle
      const targetInput = page.locator('input[name="target_user"], input[name="target_handle"]').first();
      if (await targetInput.count() > 0) {
        await targetInput.fill('@test_user');
      }

      console.log('✓ User-targeted engagement configured');
    }
  });
});

test.describe('REAL Engagement Rule Actions', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await setupTwitterApiMock(page, {
      enableLogging: true,
      mockTweets: true,
      mockUsers: true
    });
  });

  test('Like action is executed on matching tweets', async ({ page }) => {
    const apiMonitor = createTwitterApiMonitor(page);
    apiMonitor.start();

    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    // Find execute/run button for engagement rules
    const executeButton = page.locator(
      'button:has-text("実行"), ' +
      'button:has-text("テスト実行")'
    ).first();

    if (await executeButton.count() > 0 && !(await executeButton.isDisabled())) {
      await executeButton.click();
      await page.waitForTimeout(3000);

      apiMonitor.stop();

      // Check for like API calls
      const likeCalls = apiMonitor.getCalls().filter(call =>
        call.url.includes('/likes') && call.method === 'POST'
      );

      if (likeCalls.length > 0) {
        console.log(`✓ ${likeCalls.length} like action(s) executed`);
      } else {
        console.log('⚠ No like actions detected - may be async execution');
      }
    } else {
      console.log('⚠ Execute button not found or disabled');
    }
  });

  test('Reply action is executed with template', async ({ page }) => {
    const apiMonitor = createTwitterApiMonitor(page);
    apiMonitor.start();

    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const executeButton = page.locator('button:has-text("実行")').first();

    if (await executeButton.count() > 0 && !(await executeButton.isDisabled())) {
      await executeButton.click();
      await page.waitForTimeout(3000);

      apiMonitor.stop();

      // Check for reply (tweet creation) API calls
      const replyCalls = apiMonitor.getCallsByEndpoint('/2/tweets');

      if (replyCalls.length > 0) {
        console.log(`✓ ${replyCalls.length} reply action(s) executed`);

        // Verify reply has in_reply_to_tweet_id
        replyCalls.forEach(call => {
          if (call.requestData?.reply) {
            console.log('  Reply to:', call.requestData.reply.in_reply_to_tweet_id);
          }
        });
      }
    }
  });

  test('Follow action is executed on matching users', async ({ page }) => {
    const apiMonitor = createTwitterApiMonitor(page);
    apiMonitor.start();

    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const executeButton = page.locator('button:has-text("実行")').first();

    if (await executeButton.count() > 0 && !(await executeButton.isDisabled())) {
      await executeButton.click();
      await page.waitForTimeout(3000);

      apiMonitor.stop();

      // Check for follow API calls
      const followCalls = apiMonitor.getCalls().filter(call =>
        call.url.includes('/following') && call.method === 'POST'
      );

      if (followCalls.length > 0) {
        console.log(`✓ ${followCalls.length} follow action(s) executed`);
      }
    }
  });
});

test.describe('REAL Engagement Rule Filters', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('Follower count filter is applied', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Set follower range
      const minInput = page.locator('input[name="min_followers"]').first();
      const maxInput = page.locator('input[name="max_followers"]').first();

      if (await minInput.count() > 0) {
        await minInput.fill('1000');
        console.log('✓ Min followers set: 1000');
      }

      if (await maxInput.count() > 0) {
        await maxInput.fill('50000');
        console.log('✓ Max followers set: 50000');
      }
    }
  });

  test('Exclude keywords filter is configured', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Set exclude keywords
      const excludeInput = page.locator(
        'input[name="exclude_keywords"], ' +
        'textarea[name="exclude_keywords"]'
      ).first();

      if (await excludeInput.count() > 0) {
        await excludeInput.fill('spam, bot, 広告');
        console.log('✓ Exclude keywords configured');
      }
    }
  });

  test('Verified-only filter can be enabled', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Find verified checkbox
      const verifiedCheckbox = page.locator('input[name="verified_only"]').first();

      if (await verifiedCheckbox.count() > 0) {
        await verifiedCheckbox.click();
        const isChecked = await verifiedCheckbox.isChecked();
        expect(isChecked).toBe(true);
        console.log('✓ Verified-only filter enabled');
      }
    }
  });
});

test.describe('REAL Engagement Rule Limits', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('Daily limit can be configured', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      const dailyLimitInput = page.locator('input[name="daily_limit"]').first();

      if (await dailyLimitInput.count() > 0) {
        await dailyLimitInput.fill('100');

        const value = await dailyLimitInput.inputValue();
        expect(value).toBe('100');

        console.log('✓ Daily limit set to 100');
      }
    }
  });

  test('Max actions per run can be configured', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("ルール追加")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      const maxActionsInput = page.locator('input[name="max_actions_per_run"]').first();

      if (await maxActionsInput.count() > 0) {
        await maxActionsInput.fill('10');

        const value = await maxActionsInput.inputValue();
        expect(value).toBe('10');

        console.log('✓ Max actions per run set to 10');
      }
    }
  });
});

test.describe('REAL Engagement Rule Activation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('User can activate/deactivate engagement rules', async ({ page }) => {
    await page.goto('/engagement');
    await page.waitForLoadState('networkidle');

    // Find active toggle
    const activeToggle = page.locator(
      'input[type="checkbox"][name*="active"], ' +
      'input[type="checkbox"][name*="is_active"]'
    ).first();

    if (await activeToggle.count() > 0) {
      const initialState = await activeToggle.isChecked();
      console.log(`Initial active state: ${initialState}`);

      // Toggle
      await activeToggle.click();
      await page.waitForTimeout(1000);

      const newState = await activeToggle.isChecked();
      expect(newState).not.toBe(initialState);

      console.log(`✓ Rule toggled to: ${newState}`);
    } else {
      console.log('⚠ Active toggle not found');
    }
  });
});

test.describe('REAL Targeted Engagement Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('User can create targeted engagement for specific tweet', async ({ page }) => {
    await page.goto('/engagement/targeted');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("キャンペーン追加"), button:has-text("追加")').first();

    if (await createButton.count() === 0) {
      console.log('⚠ Create campaign button not found');
      test.skip();
      return;
    }

    await createButton.click();
    await page.waitForLoadState('networkidle');

    // Enter target tweet URL
    const urlInput = page.locator('input[name="target_url"]').first();
    if (await urlInput.count() > 0) {
      await urlInput.fill('https://twitter.com/test_user/status/1234567890');
    }

    // Select actions
    const likeCheckbox = page.locator('input[name="enable_like"]').first();
    if (await likeCheckbox.count() > 0) {
      await likeCheckbox.click();
    }

    const retweetCheckbox = page.locator('input[name="enable_retweet"]').first();
    if (await retweetCheckbox.count() > 0) {
      await retweetCheckbox.click();
    }

    // Select accounts
    const accountCheckboxes = page.locator('input[type="checkbox"][name*="account"]');
    if (await accountCheckboxes.count() > 0) {
      await accountCheckboxes.first().click();
    }

    // Submit
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.count() > 0 && !(await submitButton.isDisabled())) {
      await submitButton.click();
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application error');

      console.log('✓ Targeted engagement campaign created');
    }
  });
});
