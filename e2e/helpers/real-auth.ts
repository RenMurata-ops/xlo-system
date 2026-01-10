import { Page, expect } from '@playwright/test';

/**
 * Real Authentication Helper for E2E Tests
 *
 * This helper performs actual authentication and FAILS tests if authentication doesn't work.
 * Unlike the previous helper that skipped tests on auth failure, this one properly validates
 * that authentication is working.
 *
 * Prerequisites:
 * - Test user must exist in database (run seed_test_data.sql)
 * - Email: test@xlo-system.com
 * - Password: TestPassword123!
 */

export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Authenticate via API and inject session into browser
 * This uses the actual login form to ensure proper cookie handling
 */
export async function authenticateViaAPI(page: Page): Promise<AuthResult> {
  const testEmail = process.env.TEST_USER_EMAIL || 'test@xlo-system.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  try {
    // Navigate to login page
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Check if already authenticated (should redirect to dashboard)
    if (page.url().includes('/dashboard')) {
      return { success: true };
    }

    // Wait for and fill login form
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const submitButton = page.locator('button[type="submit"]').first();

    // Ensure elements are visible and ready
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    // Fill the form by clicking and typing (more reliable than .fill())
    await emailInput.click();
    await emailInput.press('Control+A'); // Select all
    await emailInput.type(testEmail);

    await passwordInput.click();
    await passwordInput.press('Control+A'); // Select all
    await passwordInput.type(testPassword);

    // Wait a bit for React state to update
    await page.waitForTimeout(500);

    // Verify fields are filled
    const emailValue = await emailInput.inputValue();
    const passwordValue = await passwordInput.inputValue();

    if (emailValue !== testEmail || passwordValue !== testPassword) {
      return {
        success: false,
        error: `Form fields not filled correctly. Email: "${emailValue}", Password length: ${passwordValue.length}`,
      };
    }

    // Submit the form
    await submitButton.click();

    // Wait for authentication and automatic redirect to dashboard
    // The login page uses window.location.href which causes full page reload
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      return { success: true };
    } catch (timeoutError) {
      const currentUrl = page.url();

      // Check if we ended up on dashboard anyway
      if (currentUrl.includes('/dashboard')) {
        return { success: true };
      }

      // Check for authentication error
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('Invalid') || bodyText?.includes('エラー') || bodyText?.includes('失敗')) {
        return {
          success: false,
          error: `Login failed - invalid credentials`,
        };
      }

      return {
        success: false,
        error: `Login timeout - stuck at ${currentUrl}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Authentication error: ${error.message}`,
    };
  }
}

/**
 * Authenticate test user and verify success
 * @throws Error if authentication fails
 */
export async function authenticateRealUser(page: Page): Promise<AuthResult> {
  const testEmail = process.env.TEST_USER_EMAIL || 'test@xlo-system.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  try {
    // Navigate to login page
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Check if already authenticated
    if (page.url().includes('/dashboard')) {
      return { success: true };
    }

    // Find form elements
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Verify form elements exist
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    // Fill credentials
    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);

    // Submit form
    await submitButton.click();

    // Wait for success toast to appear
    await page.waitForTimeout(1000);

    // Wait for the page redirect (login page uses window.location.href)
    // This will cause a full page reload to dashboard
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      // Successfully redirected to dashboard
      return { success: true };
    } catch (error) {
      // Timeout or navigation failed, continue to error checking
    }

    // Check authentication result
    const currentUrl = page.url();

    if (currentUrl.includes('/dashboard')) {
      // Success - authenticated
      return { success: true };
    } else if (currentUrl.includes('/auth/login')) {
      // Still on login page - check for error message
      const bodyText = await page.textContent('body');

      if (bodyText?.includes('Invalid login credentials') ||
          bodyText?.includes('Invalid email or password')) {
        throw new Error(
          `Authentication failed: Invalid credentials.\n` +
          `Please ensure test user exists in database.\n` +
          `Run: psql -f supabase/seed_test_data.sql`
        );
      } else if (bodyText?.includes('Email not confirmed')) {
        throw new Error(
          `Authentication failed: Email not confirmed.\n` +
          `Test user email must be confirmed in database.`
        );
      } else {
        throw new Error(
          `Authentication failed: Still on login page after submission.\n` +
          `URL: ${currentUrl}\n` +
          `Page content: ${bodyText?.substring(0, 500)}`
        );
      }
    } else {
      // Unexpected redirect
      throw new Error(
        `Authentication failed: Unexpected redirect to ${currentUrl}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message
      };
    }
    throw error;
  }
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Try to access a protected page
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // If redirected to login, not authenticated
  return !page.url().includes('/auth/login');
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  try {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout")').first();

    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForURL(/\/auth\/login/, { timeout: 5000 });
    } else {
      // Manually clear session by navigating to logout endpoint
      await page.goto('/auth/logout');
      await page.waitForLoadState('networkidle');
    }
  } catch (error) {
    console.warn('Logout failed:', error);
    // Continue anyway - logout is best effort
  }
}

/**
 * Get current user session data
 */
export async function getUserSession(page: Page): Promise<any> {
  try {
    // Get session from localStorage or cookies
    const session = await page.evaluate(() => {
      return localStorage.getItem('supabase.auth.token');
    });

    if (session) {
      return JSON.parse(session);
    }

    return null;
  } catch (error) {
    console.warn('Failed to get user session:', error);
    return null;
  }
}

/**
 * Ensure test user is authenticated before running test
 * This should be used in beforeEach hooks
 *
 * Now uses API authentication to bypass browser context issues
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  // Try API authentication first (more reliable)
  const result = await authenticateViaAPI(page);

  if (!result.success) {
    throw new Error(
      `Test cannot proceed: Authentication failed.\n` +
      `Error: ${result.error}\n\n` +
      `Please ensure:\n` +
      `1. Test database is seeded: psql -f supabase/seed_test_data.sql\n` +
      `2. Test user exists: test@xlo-system.com\n` +
      `3. Supabase is running: npm run supabase:start\n` +
      `4. Environment variables are set correctly\n`
    );
  }
}
