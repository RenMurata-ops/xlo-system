import { test } from '@playwright/test';

test('Check cookies after login', async ({ page, context }) => {
  // Navigate to login
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  // Fill and submit
  await page.locator('input#email').fill('test@xlo-system.com');
  await page.locator('input#password').fill('TestPassword123!');
  await page.locator('button[type="submit"]').click();

  // Wait for auth
  await page.waitForTimeout(3000);

  // Get all cookies
  const cookies = await context.cookies();

  console.log('=== ALL COOKIES ===');
  for (const cookie of cookies) {
    console.log(`\nName: ${cookie.name}`);
    console.log(`Value (first 100 chars): ${cookie.value.substring(0, 100)}`);
    console.log(`Domain: ${cookie.domain}`);
    console.log(`Path: ${cookie.path}`);
    console.log(`HttpOnly: ${cookie.httpOnly}`);
    console.log(`Secure: ${cookie.secure}`);
    console.log(`SameSite: ${cookie.sameSite}`);
  }

  console.log(`\n\n=== TOTAL COOKIES: ${cookies.length} ===`);
});
