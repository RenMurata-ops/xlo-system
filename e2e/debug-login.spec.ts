import { test, expect } from '@playwright/test';

test('Debug login flow', async ({ page }) => {
  // Collect console logs
  const logs: string[] = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));

  // Collect errors
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  // Navigate to login
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  console.log('=== Initial page load ===');
  console.log('Console logs:', logs);
  console.log('Errors:', errors);

  // Fill form
  await page.locator('input#email').fill('test@xlo-system.com');
  await page.locator('input#password').fill('TestPassword123!');

  console.log('=== Form filled ===');

  // Click submit and wait a bit
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log('=== After submit (3s) ===');
  console.log('Current URL:', page.url());
  console.log('Console logs:', logs);
  console.log('Errors:', errors);

  // Check localStorage
  const localStorage = await page.evaluate(() => {
    const keys = Object.keys(window.localStorage);
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = window.localStorage.getItem(key) || '';
    }
    return result;
  });

  console.log('=== LocalStorage ===');
  console.log(JSON.stringify(localStorage, null, 2));

  // Wait longer
  await page.waitForTimeout(5000);

  console.log('=== After 8s total ===');
  console.log('Final URL:', page.url());
  console.log('All console logs:', logs);
  console.log('All errors:', errors);
});
