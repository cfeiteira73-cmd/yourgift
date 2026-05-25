import { Page } from '@playwright/test';

export async function loginAsTestUser(page: Page): Promise<boolean> {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) return false;

  await page.goto('/login');
  await page.fill(
    '[data-testid="email-input"], input[type="email"], input[name="email"]',
    email,
  );
  await page.fill(
    '[data-testid="password-input"], input[type="password"], input[name="password"]',
    password,
  );
  await page.click('[data-testid="login-button"], button[type="submit"]');
  await page.waitForURL(/dashboard|home|\/$/, { timeout: 10_000 }).catch(() => {});
  return true;
}
