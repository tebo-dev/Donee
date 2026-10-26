import { test } from './fixtures';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('legal documents are public, readable, linked and use the configured contact', async ({
  page,
}, testInfo) => {
  await page.goto('/legal');
  await expect(
    page.getByRole('heading', { name: 'A little clarity.' }),
  ).toBeVisible();
  const documents = [
    'privacy',
    'terms',
    'acceptable-use',
    'content-reports',
    'storage',
  ];
  for (const slug of documents) {
    await page.goto(`/legal/${slug}`);
    await expect(page.locator('article h1')).toBeVisible();
    await expect(page.locator('article')).toContainText(
      'Effective October 26, 2026',
    );
    await expect(page.locator('article')).not.toContainText(
      '{{CONTACT_EMAIL}}',
    );
    await expect(
      page.locator('article a[href="mailto:its.tebo0@gmail.com"]').first(),
    ).toBeVisible();
    const firstSection = page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link')
      .first();
    await firstSection.click();
    await expect(page).toHaveURL(/#/);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.goto('/legal/privacy');
  for (const theme of ['Matrix', 'Terminal', 'Dracula', 'Akira']) {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.keyboard.press('Escape');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`legal-${width}.png`),
      fullPage: true,
    });
  }
  await page.goto('/legal/not-a-document');
  await expect(
    page.getByRole('heading', { name: 'Nothing here. Not just yet.' }),
  ).toBeVisible();
});

test('report categories prepare email without submitting a report', async ({
  page,
}) => {
  await page.goto('/legal/content-reports');
  const reports = page.getByRole('navigation', { name: 'Email a report' });
  await expect(
    reports.getByRole('link', { name: 'Privacy request', exact: true }),
  ).toHaveAttribute(
    'href',
    'mailto:its.tebo0@gmail.com?subject=Privacy%20request',
  );
  await expect(
    reports.getByRole('link', { name: 'Intimate image removal', exact: true }),
  ).toHaveAttribute(
    'href',
    'mailto:its.tebo0@gmail.com?subject=Intimate%20image%20removal',
  );
  await expect(reports).toContainText(
    'Nothing is sent until you send the email',
  );
  await expect(reports).toContainText(
    'does not create a case number or confirm delivery',
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('appearance remembering is optional and can be removed without clearing sign-in storage', async ({
  page,
}) => {
  await page.goto('/legal');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const remember = page.getByRole('checkbox', {
    name: 'Remember appearance on this device',
  });
  await expect(remember).not.toBeChecked();
  await page.getByRole('button', { name: 'Dracula', exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem('donee-appearance')),
  ).toBeNull();
  await remember.check();
  await page.getByRole('button', { name: /Fira Code/ }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'fira');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  // Sentinel belongs to the test, not a mock login. Preference removal must not clear unrelated storage.
  await page.evaluate(() =>
    sessionStorage.setItem('appearance-test-sentinel', 'keep'),
  );
  await remember.uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  expect(
    await page.evaluate(() => localStorage.getItem('donee-appearance')),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('appearance-test-sentinel'),
    ),
  ).toBe('keep');
  await page.getByRole('button', { name: 'Akira', exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem('donee-appearance')),
  ).toBeNull();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'matrix');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(remember).not.toBeChecked();
});

test('registration requires explicit terms agreement without adding unsupported API fields', async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill(`legal_${suffix}`);
  await page
    .getByLabel('Email address', { exact: true })
    .fill(`legal_${suffix}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .fill('a-valid-password-123');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('a-valid-password-123');
  let payload: Record<string, unknown> | undefined;
  page.on('request', (req) => {
    if (req.url().endsWith('/auth/register')) payload = req.postDataJSON();
  });
  await page.getByRole('button', { name: 'Make it mine' }).click();
  await expect(
    page.getByText(
      'Agree to the Terms of service and Acceptable use policy to create an account.',
    ),
  ).toBeVisible();
  expect(payload).toBeUndefined();
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Make it mine' }).click();
  await expect(page).toHaveURL('/login');
  expect(Object.keys(payload!)).toEqual(['username', 'email', 'password']);
});
