import { expect, test, type Page, type Route } from '@playwright/test';

const LEADS_URL = 'https://api.singletonsd.com/v1/leads';

async function stubTurnstile(page: Page) {
  await page.addInitScript(() => {
    let lastCallback: ((token: string) => void) | undefined;
    const api = {
      render(_el: unknown, opts: { callback?: (token: string) => void }) {
        lastCallback = opts.callback;
        queueMicrotask(() => opts.callback?.('e2e-turnstile-token'));
        return 'e2e-widget';
      },
      reset() {
        lastCallback?.('e2e-turnstile-token');
      },
    };
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      writable: true,
      value: api,
    });
  });
}

async function mockLeads(page: Page, handler: (route: Route) => Promise<void> | void) {
  await page.route('https://api.singletonsd.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type,accept',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
      });
      return;
    }
    if (route.request().url().startsWith(LEADS_URL) && route.request().method() === 'POST') {
      await handler(route);
      return;
    }
    await route.abort('blockedbyclient');
  });
}

test.describe('lead forms with JavaScript', () => {
  test.beforeEach(async ({ page }) => {
    await stubTurnstile(page);
  });

  test('contact form posts a job-kit contact payload', async ({ page }) => {
    let body: Record<string, unknown> | undefined;
    await mockLeads(page, async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ id: body.submissionId }),
      });
    });

    await page.goto('/contact');
    await page.getByLabel('First & Last Name').fill('Ada Lovelace');
    await page.getByLabel('Email Address').fill('ada@example.com');
    await page.getByLabel('Subject').selectOption('sales');
    await page.getByLabel('Message').fill('Please get in touch about a demo.');
    await page.getByLabel(/I agree to the processing/).check();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.locator('#contact-success')).toContainText('your message was sent');
    expect(body).toMatchObject({
      sourceSite: 'https://plattform-kit.poc.singletonsd.com',
      formType: 'contact',
      product: 'platform_kit',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      consent: true,
      marketingOptIn: false,
      turnstileToken: 'e2e-turnstile-token',
      consentTextVersion: 'platform-kit-privacy-v1',
    });
    expect(String(body?.message)).toContain('Please get in touch about a demo.');
    expect(body).not.toHaveProperty('source');
    expect(typeof body?.submissionId).toBe('string');
  });

  test('waitlist form posts product platform_kit and a feature', async ({ page }) => {
    let body: Record<string, unknown> | undefined;
    await mockLeads(page, async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ id: body.submissionId }),
      });
    });

    await page.goto('/waitlist');
    await page.getByLabel('First & Last Name').fill('Ada Lovelace');
    await page.getByLabel('Email Address').fill('ada@example.com');
    await page.getByLabel('What are you waiting for?').selectOption('early_access');
    await page.getByLabel(/I agree to the processing/).check();
    await expect(page.getByRole('button', { name: 'Join waitlist' })).toBeEnabled();
    await page.getByRole('button', { name: 'Join waitlist' }).click();

    await expect(page.locator('#waitlist-success')).toContainText('You’re on the list');
    expect(body).toMatchObject({
      sourceSite: 'https://plattform-kit.poc.singletonsd.com',
      formType: 'waitlist',
      product: 'platform_kit',
      feature: 'early_access',
      consent: true,
      marketingOptIn: false,
    });
  });

  test('contact form shows 400 field errors and 404 unavailable', async ({ page }) => {
    let calls = 0;
    let firstId: string | undefined;
    await mockLeads(page, async (route) => {
      calls += 1;
      const sent = route.request().postDataJSON() as Record<string, unknown>;
      if (calls === 1) {
        firstId = String(sent.submissionId);
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'payload_invalid',
            message: 'body does not match the lead schema',
            details: ['email'],
          }),
        });
        return;
      }
      expect(sent.submissionId).toBe(firstId);
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'function_disabled',
          message: 'function lead-intake is disabled',
        }),
      });
    });

    await page.goto('/contact');
    await page.getByLabel('First & Last Name').fill('Ada Lovelace');
    await page.getByLabel('Email Address').fill('ada@example.com');
    await page.getByLabel('Subject').selectOption('general');
    await page.getByLabel('Message').fill('Please get in touch about a demo.');
    await page.getByLabel(/I agree to the processing/).check();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#contact-form-error')).toContainText(
      'Please fix the highlighted fields and try again.',
    );
    await expect(page.locator('#contact-email-error')).toHaveText('Enter a valid email address.');

    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#contact-form-error')).toContainText(
      'Lead intake is temporarily unavailable. Please try again later.',
    );
  });

  test('404 request error stays visible after Turnstile reset and field edit', async ({ page }) => {
    await mockLeads(page, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'function_disabled',
          message: 'function lead-intake is disabled',
        }),
      });
    });

    await page.goto('/contact');
    await page.getByLabel('First & Last Name').fill('Ada Lovelace');
    await page.getByLabel('Email Address').fill('ada@example.com');
    await page.getByLabel('Subject').selectOption('general');
    await page.getByLabel('Message').fill('Please get in touch about a demo.');
    await page.getByLabel(/I agree to the processing/).check();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send message' }).click();

    const formError = page.locator('#contact-form-error');
    await expect(formError).toContainText(
      'Lead intake is temporarily unavailable. Please try again later.',
    );
    await expect(formError).not.toHaveClass(/hidden/);
    await expect(page.locator('#contact-success')).toBeHidden();

    await page.getByLabel('Message').fill('Please get in touch about a demo. Updated.');
    await expect(formError).toContainText(
      'Lead intake is temporarily unavailable. Please try again later.',
    );
    await expect(formError).not.toHaveClass(/hidden/);
  });
});

test.describe('lead forms without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('contact submit is disabled in the initial HTML', async ({ page }) => {
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    const html = await page.content();
    expect(html).toContain('<noscript>');
    expect(html).toContain('support@singletonsd.com');
  });

  test('waitlist submit is disabled in the initial HTML', async ({ page }) => {
    await page.goto('/waitlist');
    const form = page.locator('#waitlist-form');
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(page.getByRole('button', { name: 'Join waitlist' })).toBeDisabled();
    const html = await page.content();
    expect(html).toContain('<noscript>');
    expect(html).toContain('support@singletonsd.com');
  });
});
