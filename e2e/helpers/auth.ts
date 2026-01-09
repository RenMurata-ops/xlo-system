import { Page } from '@playwright/test';

/**
 * Authentication helper for E2E tests
 *
 * Note: This is a mock authentication for testing purposes.
 * In a real production environment, you would need to:
 * 1. Create a test user in the database
 * 2. Use valid credentials
 * 3. Handle Supabase authentication flow properly
 */

export async function authenticateUser(page: Page, email?: string, password?: string) {
  // Default test credentials
  const testEmail = email || process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = password || process.env.TEST_USER_PASSWORD || 'test-password';

  // Navigate to login page
  await page.goto('/auth/login');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Check if already authenticated (redirect to dashboard)
  if (page.url().includes('/dashboard')) {
    return; // Already logged in
  }

  // Fill in login form
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  // Check if form elements exist
  const emailExists = await emailInput.count() > 0;
  const passwordExists = await passwordInput.count() > 0;

  if (!emailExists || !passwordExists) {
    console.warn('Login form not found - authentication may not be possible');
    return;
  }

  // Fill and submit
  await emailInput.fill(testEmail);
  await passwordInput.fill(testPassword);
  await submitButton.click();

  // Wait for authentication to complete (either redirect or error)
  await page.waitForURL(/\/(dashboard|auth\/login)/, { timeout: 10000 }).catch(() => {
    console.warn('Authentication redirect did not occur as expected');
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Navigate to a protected route
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // If redirected to login, user is not authenticated
  return !page.url().includes('/auth/login');
}

/**
 * Logout user
 */
export async function logoutUser(page: Page) {
  // Look for logout button (adjust selector based on your UI)
  const logoutButton = page.locator('button:has-text("ログアウト"), a:has-text("ログアウト")').first();

  if (await logoutButton.count() > 0) {
    await logoutButton.click();
    await page.waitForURL(/\/auth\/login/, { timeout: 5000 }).catch(() => {
      console.warn('Logout redirect did not occur');
    });
  }
}
