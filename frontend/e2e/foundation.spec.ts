import { test } from './fixtures';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('built app loads, stays within narrow viewports, and has accessible content', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Less noise. More doing.' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});

test('deep links fall back to the router and keyboard users can return home', async ({
  page,
}) => {
  await page.goto('/not-a-real-page');
  await expect(
    page.getByRole('heading', { name: 'Nothing here. Not just yet.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to Donee' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/login');
  await expect(
    page.getByRole('heading', { name: 'Less noise. More doing.' }),
  ).toBeVisible();
});

test('living themes migrate legacy preferences and keep motion optional', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('theme-migration-seeded')) {
      localStorage.setItem(
        'donee-appearance',
        JSON.stringify({ theme: 'dracula', font: 'fira' }),
      );
      sessionStorage.setItem('theme-migration-seeded', '1');
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'abyss');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'fira');
  await expect
    .poll(() =>
      page
        .locator('.ambient-background')
        .evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Pause background animation' })
    .check();
  await page.getByRole('button', { name: 'Paper Sky', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sky');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Pause background animation' }),
  ).toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Matrix', exact: true }),
  ).toHaveCount(0);
});
