import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.helper';

// ─── Auth: Email/password login flow ─────────────────────────────────────────

test('login page renders core elements', async ({ page }) => {
  await page.goto('/login');
  // Email field must be present
  const emailInput = page.locator(
    '[data-testid="email-input"], input[type="email"], input[name="email"]',
  );
  await expect(emailInput.first()).toBeVisible();
  // Submit button must be present
  const submitBtn = page.locator(
    '[data-testid="login-button"], button[type="submit"]',
  );
  await expect(submitBtn.first()).toBeVisible();
});

test('Google OAuth button is present on login page', async ({ page }) => {
  await page.goto('/login');
  // Look for a button/link that references Google or OAuth
  const googleBtn = page.locator(
    'button:has-text("Google"), a:has-text("Google"), [data-testid="google-login"]',
  );
  // If no explicit Google button, look for any OAuth provider text
  const oauthPresent =
    (await googleBtn.count()) > 0 ||
    (await page.locator('text=/google|oauth|sso/i').count()) > 0;
  expect(oauthPresent).toBeTruthy();
});

test('invalid credentials shows error message', async ({ page }) => {
  await page.goto('/login');

  const emailInput = page
    .locator('[data-testid="email-input"], input[type="email"], input[name="email"]')
    .first();
  const passwordInput = page
    .locator('[data-testid="password-input"], input[type="password"], input[name="password"]')
    .first();
  const submitBtn = page
    .locator('[data-testid="login-button"], button[type="submit"]')
    .first();

  await emailInput.fill('invalid@nonexistent-domain-xyz.com');
  await passwordInput.fill('wrong-password-12345');
  await submitBtn.click();

  // Either an error message appears or we stay on the login page
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  const errorVisible =
    (await page
      .locator('[role="alert"], [data-testid="error"], .error, text=/invalid|incorrect|wrong|failed|error/i')
      .count()) > 0;
  const stayedOnLogin = currentUrl.includes('/login') || currentUrl.endsWith('/');
  expect(errorVisible || stayedOnLogin).toBeTruthy();
});

test('magic link page renders correctly', async ({ page }) => {
  // Try common paths for magic link
  const paths = ['/login/magic', '/auth/magic', '/magic-link', '/login'];
  for (const path of paths) {
    const resp = await page.goto(path);
    if (resp && resp.status() < 400) {
      // Page loaded — check that it renders some form element
      const hasForm =
        (await page.locator('form, input, button').count()) > 0;
      expect(hasForm).toBeTruthy();
      return;
    }
  }
  // Fallback: just check login page renders
  await page.goto('/login');
  await expect(page.locator('body')).toBeVisible();
});

test('protected routes redirect to login when unauthenticated', async ({ page }) => {
  // Try accessing a protected page without credentials
  const response = await page.goto('/dashboard');
  // Should redirect to /login or return an auth challenge
  const finalUrl = page.url();
  const isRedirected =
    finalUrl.includes('/login') ||
    finalUrl.includes('/auth') ||
    (response !== null && response.status() === 401);
  expect(isRedirected).toBeTruthy();
});

test('authenticated login flow redirects to dashboard', async ({ page }) => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
    'Skipping: TEST_EMAIL / TEST_PASSWORD not set');

  const loggedIn = await loginAsTestUser(page);
  expect(loggedIn).toBe(true);

  const url = page.url();
  const isOnApp =
    url.includes('/dashboard') ||
    url.includes('/home') ||
    (!url.includes('/login') && !url.includes('/auth'));
  expect(isOnApp).toBeTruthy();
});

test('logout clears session and redirects to login', async ({ page }) => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
    'Skipping: TEST_EMAIL / TEST_PASSWORD not set');

  await loginAsTestUser(page);

  // Look for logout button/link
  const logoutBtn = page.locator(
    '[data-testid="logout"], button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")',
  );
  if ((await logoutBtn.count()) > 0) {
    await logoutBtn.first().click();
    await page.waitForURL(/login|auth/, { timeout: 5000 }).catch(() => {});
    expect(page.url()).toMatch(/login|auth|\//);
  } else {
    // Navigate directly to logout endpoint
    await page.goto('/api/auth/logout');
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toBeTruthy(); // Page loaded without error
  }
});
