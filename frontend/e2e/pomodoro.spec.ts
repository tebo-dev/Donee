import { expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures';
import { registrationAgreement } from './legal-agreement';
import { installSession, rememberSession } from './session';

async function seed(request: APIRequestContext) {
  const id = crypto.randomUUID().slice(0, 8);
  const account = {
    email: `focus_${id}@example.com`,
    username: `focus_${id}`,
    password: 'pomodoro-test-123',
  };
  expect(
    (
      await request.post('/api/auth/register', {
        data: { ...account, ...registrationAgreement },
      })
    ).status(),
  ).toBe(201);
  const login = await request.post('/api/auth/login', {
    data: { email: account.email, password: account.password },
  });
  expect(login.ok()).toBe(true);
  const token = rememberSession(await login.json());
  const headers = { Authorization: `Bearer ${token}` };
  const { workspaces } = await (
    await request.get('/api/workspaces', { headers })
  ).json();
  return { ...account, token, headers, workspace: workspaces[0].id as string };
}
async function create(
  request: APIRequestContext,
  account: Awaited<ReturnType<typeof seed>>,
  title: string,
  status = 'to do',
  workspaceId = account.workspace,
) {
  const response = await request.post('/api/tasks', {
    headers: account.headers,
    data: {
      workspace_id: workspaceId,
      title,
      description: '',
      priority: 'normal',
      due_at: '2026-12-01',
    },
  });
  expect(response.status()).toBe(201);
  const task = await response.json();
  if (status !== 'to do')
    expect(
      (
        await request.patch(`/api/tasks/${task.id}`, {
          headers: account.headers,
          data: { status },
        })
      ).ok(),
    ).toBe(true);
}
async function open(page: Page, account: Awaited<ReturnType<typeof seed>>) {
  await page.goto('/login');
  await installSession(page, account.token);
  await page.goto(`/workspaces/${account.workspace}`);
  await expect(
    page.getByRole('heading', { name: 'Things to do' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Pomodoro', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute(
    'aria-label',
    '25:00 remaining',
  );
}

test('Pomodoro replaces the workspace, supports both presets and preserves the timer across navigation', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await open(page, account);
  await expect(
    page.getByRole('complementary', { name: 'Your spaces' }),
  ).toHaveCount(0);
  await page.clock.install();
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(
    page.getByRole('radio', { name: '50 / 10', exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await page.getByRole('timer').getAttribute('aria-label');
  expect(paused).not.toBe('25:00 remaining');
  await page.clock.fastForward(10_000);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', paused!);
  await page.getByRole('button', { name: 'Resume focus' }).click();
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Things to do' }),
  ).toBeVisible();
  await page.clock.fastForward(2000);
  await page.getByRole('link', { name: 'Pomodoro', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  expect(await page.getByRole('timer').getAttribute('aria-label')).not.toBe(
    paused,
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute(
    'aria-label',
    '25:00 remaining',
  );
  await page.getByRole('radio', { name: '50 / 10', exact: true }).check();
  await expect(page.getByRole('timer')).toHaveAttribute(
    'aria-label',
    '50:00 remaining',
  );
  await page.keyboard.press('a');
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Search tasks')).toHaveCount(0);
});

test('workspace selection lists only incomplete tasks and handles switching, empty and failed loads', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  for (const [title, status] of [
    ['Write the outline', 'to do'],
    ['Sketch the layout', 'in_progress'],
    ['Waiting for feedback', 'blocked'],
    ['Already finished', 'done'],
    ['Old archived task', 'archived'],
  ])
    await create(request, account, title, status);
  const response = await request.post('/api/workspaces', {
    headers: account.headers,
    data: { name: 'Quiet studio' },
  });
  expect(response.status()).toBe(201);
  const second = await response.json();
  await open(page, account);
  await page
    .getByLabel('Workspace', { exact: true })
    .selectOption(account.workspace);
  for (const title of [
    'Write the outline',
    'Sketch the layout',
    'Waiting for feedback',
  ])
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText('Already finished', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('Old archived task', { exact: true }),
  ).toHaveCount(0);
  await page.route('**/api/tasks?**', (route) => route.abort());
  await page.getByLabel('Workspace', { exact: true }).selectOption(second.id);
  await expect(page.getByRole('alert')).toHaveText(
    'Tasks could not be loaded.',
  );
  await expect(
    page.getByText('Write the outline', { exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/tasks?**');
  await page.getByRole('button', { name: 'Retry tasks' }).click();
  await expect(
    page.getByText('No incomplete tasks in this workspace.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await page.getByRole('link', { name: 'Pomodoro', exact: true }).click();
  await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue(
    second.id,
  );
});

test('Pomodoro remains accessible in every theme and fits small screens', async ({
  page,
  request,
}, testInfo) => {
  const account = await seed(request);
  await create(
    request,
    account,
    'Give the final draft one more careful read before publishing',
  );
  await create(request, account, 'Sketch tomorrow’s ideas', 'in_progress');
  await create(request, account, 'Finish the little details');
  await open(page, account);
  await page
    .getByLabel('Workspace', { exact: true })
    .selectOption(account.workspace);
  await expect(
    page.getByRole('heading', { name: 'Incomplete tasks' }),
  ).toBeVisible();
  for (const theme of [
    'Koi Garden',
    'Abyss',
    'Firefly Terminal',
    'Paper Sky',
  ]) {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.keyboard.press('Escape');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${theme}.png`),
      fullPage: true,
    });
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`pomodoro-${width}.png`),
      fullPage: true,
    });
  }
});

test('incomplete tasks beyond the first page remain reachable', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  for (let i = 0; i < 51; i++)
    await create(request, account, `Focus item ${String(i).padStart(2, '0')}`);
  await open(page, account);
  await page
    .getByLabel('Workspace', { exact: true })
    .selectOption(account.workspace);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  const first = await page
    .locator('.pomodoro-task-list li')
    .first()
    .textContent();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.locator('.pomodoro-task-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('.pomodoro-task-list li').first()).toHaveText(
    first!,
  );
});

test('Pomodoro requires a session and is absent from the guest header', async ({
  page,
}) => {
  await page.goto('/pomodoro');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('link', { name: 'Pomodoro', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('sign-out clears Pomodoro state without resetting the chosen appearance', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await open(page, account);
  await page.getByRole('radio', { name: '50 / 10', exact: true }).check();
  await page
    .getByLabel('Workspace', { exact: true })
    .selectOption(account.workspace);
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Abyss', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Pomodoro', exact: true }).click();
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${account.workspace}$`));
  await page.getByRole('button', { name: 'Sign out of this tab' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'abyss');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Let me in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your corners' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Pomodoro', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute(
    'aria-label',
    '25:00 remaining',
  );
  await expect(
    page.getByRole('button', { name: 'Start focus', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue('');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'abyss');
});
