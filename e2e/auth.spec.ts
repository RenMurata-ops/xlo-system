import { test, expect } from '@playwright/test';

/**
 * Authentication Flow E2E Tests
 * Tests the critical login → dashboard flow
 *
 * Note: Currently the app does NOT have server-side auth middleware.
 * Pages load without authentication and handle auth client-side.
 * TODO: Add Next.js middleware for server-side auth protection
 */
test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at login page
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
  });

  test('login page has all required elements', async ({ page }) => {
    // Check page title (use more specific selector to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'XLO', exact: true })).toBeVisible();
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();

    // Check email input
    const emailInput = page.locator('input[type="email"]#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'your@email.com');

    // Check password input
    const passwordInput = page.locator('input[type="password"]#password');
    await expect(passwordInput).toBeVisible();

    // Check login button
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('ログイン');
  });

  test('login button shows loading state when clicked', async ({ page }) => {
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const loginButton = page.locator('button[type="submit"]');

    // Fill in test credentials (will fail auth, but that's OK)
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword123');

    // Button should not be disabled initially
    await expect(loginButton).not.toBeDisabled();

    // Click login button (note: will fail auth, but we're testing UI state)
    await loginButton.click();

    // Button should show loading state
    await expect(loginButton).toBeDisabled();
  });

  test('email field validation works', async ({ page }) => {
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const loginButton = page.locator('button[type="submit"]');

    // Try to submit with invalid email
    await emailInput.fill('invalid-email');
    await passwordInput.fill('password123');
    await loginButton.click();

    // HTML5 validation should prevent submission
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('empty fields are required', async ({ page }) => {
    const loginButton = page.locator('button[type="submit"]');

    // Try to submit empty form
    await loginButton.click();

    // Should not navigate away from login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login page does not crash', async ({ page }) => {
    // Check for fatal errors
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Uncaught');
    expect(bodyText).not.toContain('TypeError');
  });

  test('homepage has login link', async ({ page }) => {
    await page.goto('/');

    // Homepage should have login button
    const loginLink = page.locator('text=ログイン');
    await expect(loginLink).toBeVisible();

    // Click login link
    await loginLink.click();

    // Should navigate to login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

/**
 * Route Access Tests (With Auth Middleware)
 * Verifies that protected routes redirect to login when accessed without authentication
 */
test.describe('Protected Route Access Control', () => {
  test('dashboard redirects to login without auth', async ({ page }) => {
    // Attempt to access dashboard without authentication
    await page.goto('/dashboard');

    // Should redirect to login page with redirect parameter
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fdashboard/);

    // Login page should be visible
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();
  });

  test('accounts page redirects to login without auth', async ({ page }) => {
    await page.goto('/accounts/main');

    // Should redirect to login page with redirect parameter
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Faccounts%2Fmain/);

    // Login page should be visible
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();
  });

  test('posts page redirects to login without auth', async ({ page }) => {
    await page.goto('/posts');

    // Should redirect to login page with redirect parameter
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fposts/);

    // Login page should be visible
    await expect(page.locator('text=アカウントにログイン')).toBeVisible();
  });
});
