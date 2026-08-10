import { expect, test } from '@playwright/test';

import {
  collectAllowedOrigins,
  isAllowedPlaywrightRequestUrl,
  resolvePlaywrightBaseUrl,
} from './allowed-origins';

const allowedOrigins = collectAllowedOrigins(resolvePlaywrightBaseUrl());

test.beforeEach(async ({ context, page }) => {
  // The public suite is intentionally signed out. This observes the real app's
  // 401 handling without introducing an Entra bypass or test credential.
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated Playwright fixture' }),
    }),
  );

  // Keep navigation on the configured application origin (local export or
  // PLAYWRIGHT_BASE_URL). Abort production, telemetry, token, and other hosts.
  await context.route('**/*', (route) => {
    if (isAllowedPlaywrightRequestUrl(route.request().url(), allowedOrigins)) {
      return route.continue();
    }
    return route.abort('blockedbyclient');
  });
});

test('boots the signed-out application as an installable web app', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Platform Kit');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeEnabled();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.getByTestId('app-footer')).toContainText('Platform Kit.');
});

test('lets a signed-out user review product updates and return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'What’s new' }).click();

  await expect(page).toHaveURL(/\/changelog\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible();
  await expect(page.locator('article')).not.toHaveCount(0);

  await page.getByRole('link', { name: 'Back to the app' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('login-page')).toBeVisible();
});

test('preserves the legacy login route redirect', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('login-page')).toBeVisible();
});
