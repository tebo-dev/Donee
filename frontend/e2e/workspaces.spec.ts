import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Workspace = { id: string; name: string; created_at: string };
async function tokenFor(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { access_token: string }).access_token;
}
async function seed(request: APIRequestContext) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const account = {
    email: `spaces_${suffix}@example.com`,
    username: `spaces_${suffix}`,
    password: 'a-little-space-123',
  };
  expect(
    (await request.post('/api/auth/register', { data: account })).status(),
  ).toBe(201);
  const token = await tokenFor(request, account.email, account.password);
  const headers = { Authorization: `Bearer ${token}` };
  const list = await request.get('/api/workspaces', { headers });
  expect(list.status()).toBe(200);
  const spaces = (await list.json()) as { workspaces: Workspace[] };
  return { ...account, token, headers, workspace: spaces.workspaces[0]! };
}
async function openSpaces(page: Page, token: string, path = '/workspaces') {
  await page.goto('/login');
  await page.evaluate(
    (value) => sessionStorage.setItem('donee-session-token', value),
    token,
  );
  await page.goto(path);
}
async function create(
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
) {
  const response = await request.post('/api/workspaces', {
    headers,
    data: { name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Workspace;
}

test('default space, creation, rename conflicts, and persistence use the real API', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await openSpaces(page, account.token);
  await expect(
    page.getByRole('link', { name: 'Open My Space', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'New workspace', exact: true })
    .last()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Workspace name').fill(' x ');
  await dialog
    .getByRole('button', { name: 'Create workspace', exact: true })
    .click();
  await expect(dialog.getByText('Use at least 2 characters.')).toBeVisible();
  await dialog.getByLabel('Workspace name').fill('  Side quests  ');
  await dialog
    .getByRole('button', { name: 'Create workspace', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Side quests', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Your new workspace is ready.',
  );
  const workspaceId = page.url().split('/').at(-1)!;
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Workspace name').fill('My Space');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Workspace name already taken.',
  );
  await page.getByLabel('Workspace name').fill('After-hours ideas');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Name saved.');
  await expect(
    page.getByRole('heading', { name: 'After-hours ideas', exact: true }),
  ).toBeVisible();
  await page.route(`**/api/workspaces/${workspaceId}`, (route) =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await page.getByLabel('Workspace name').fill('An unsaved name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach Donee.');
  await expect(
    page.getByRole('heading', { name: 'After-hours ideas', exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/workspaces/${workspaceId}`);
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.reload();
  await expect(page.getByLabel('Workspace name')).toHaveValue(
    'After-hours ideas',
  );
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled();
  const result = await request.get(`/api/workspaces/${workspaceId}`, {
    headers: account.headers,
  });
  expect(((await result.json()) as Workspace).name).toBe('After-hours ideas');
  await page
    .getByRole('link', { name: 'Back to all spaces', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open After-hours ideas', exact: true }),
  ).toBeVisible();
});

test('search, keyboard switching, dialog cancellation, and duplicate creation preserve the list', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await create(request, account.headers, 'Weekend plans');
  await create(request, account.headers, 'A'.repeat(50));
  await openSpaces(page, account.token);
  const search = page.getByRole('searchbox', { name: 'Find a workspace' });
  await search.fill('nothing like this');
  await expect(
    page.getByRole('heading', { name: 'No space by that name.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  const rows = page
    .getByRole('region', { name: 'Your workspaces' })
    .getByRole('link');
  await expect(rows).toHaveCount(3);
  const firstAddress = await rows.first().getAttribute('href');
  await search.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press('j');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(rows.last()).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(firstAddress!);
  await page
    .getByRole('link', { name: 'Back to all spaces', exact: true })
    .click();
  const trigger = page
    .getByRole('button', { name: 'New workspace', exact: true })
    .last();
  await trigger.click();
  await page
    .getByRole('dialog')
    .getByLabel('Workspace name')
    .fill('Unsaved idea');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('dialog').getByLabel('Workspace name').fill('My Space');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create workspace', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveText(
    'Workspace name already taken.',
  );
  expect(
    (
      (await (
        await request.get('/api/workspaces', { headers: account.headers })
      ).json()) as { workspaces: Workspace[] }
    ).workspaces,
  ).toHaveLength(3);
});

test('loading and connection failures recover without showing fake workspace data', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/workspaces', async (route) => {
    await waiting;
    await route.continue();
  });
  await openSpaces(page, account.token);
  await expect(
    page.getByText('Finding your little corners…', { exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('link', { name: 'Open My Space', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/workspaces');
  await page.route('**/api/workspaces', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'A small pause.' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Cannot reach Donee.');
  await page.unroute('**/api/workspaces');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Open My Space', exact: true }),
  ).toBeVisible();
});

test('unauthorized, missing, and malformed workspace links do not disclose another space', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const other = await seed(request);
  await request.patch(`/api/workspaces/${other.workspace.id}`, {
    headers: other.headers,
    data: { name: 'A private corner' },
  });
  await openSpaces(page, account.token, `/workspaces/${other.workspace.id}`);
  await expect(
    page.getByRole('heading', { name: 'This corner is out of reach.' }),
  ).toBeVisible();
  await expect(page.getByText('A private corner', { exact: true })).toHaveCount(
    0,
  );
  expect(
    (
      await request.patch(`/api/workspaces/${other.workspace.id}`, {
        headers: account.headers,
        data: { name: 'Not allowed' },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/workspaces/${crypto.randomUUID()}`);
  await expect(
    page.getByRole('heading', { name: 'This corner is out of reach.' }),
  ).toBeVisible();
  await page.goto('/workspaces/not-a-valid-id/settings');
  await expect(
    page.getByRole('heading', { name: 'This corner is out of reach.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Workspace name' }),
  ).toHaveCount(0);
});

test('real viewer membership is read-only and shared spaces are not claimed as owned', async ({
  page,
  request,
}) => {
  const ownerToken = await tokenFor(
    request,
    'workspace-owner@example.com',
    'workspace-fixture-123',
  );
  const viewerToken = await tokenFor(
    request,
    'workspace-viewer@example.com',
    'workspace-fixture-123',
  );
  const ownerSpaces = (await (
    await request.get('/api/workspaces', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
  ).json()) as { workspaces: Workspace[] };
  const shared = ownerSpaces.workspaces[0]!;
  await openSpaces(page, viewerToken, `/workspaces/${shared.id}`);
  await expect(
    page.getByRole('heading', { name: 'My Space', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await page.goto(`/workspaces/${shared.id}/settings`);
  await expect(
    page.getByText(
      'You can view this workspace. Only its owner can change the name.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Workspace name', { exact: true })).toHaveCount(
    0,
  );
  expect(
    (
      await request.patch(`/api/workspaces/${shared.id}`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
        data: { name: 'Not my space' },
      })
    ).status(),
  ).toBe(403);
});

test('empty responses offer creation and a workspace 401 clears the session', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({ json: { workspaces: [] } }),
  );
  await openSpaces(page, account.token);
  await expect(
    page.getByRole('heading', { name: 'A fresh little start.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create your first workspace' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.unroute('**/api/workspaces');
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({
      status: 401,
      json: { detail: 'Could not verify credentials.' },
    }),
  );
  await page.reload();
  await expect(page).toHaveURL('/login');
  expect(
    await page.evaluate(() => sessionStorage.getItem('donee-session-token')),
  ).toBeNull();
});

test('workspace pages and dialogs are accessible, responsive, and theme-aware', async ({
  page,
  request,
}, testInfo) => {
  const account = await seed(request);
  const second = await create(
    request,
    account.headers,
    'Side quests & small victories',
  );
  await create(request, account.headers, 'Ideas for a slower Sunday');
  await openSpaces(page, account.token);
  await expect(
    page.getByRole('heading', { name: 'Your little corners.' }),
  ).toBeVisible();
  for (const theme of ['Matrix', 'Terminal', 'Dracula', 'Akira']) {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.keyboard.press('Escape');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Matrix', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const path of [
    '/workspaces',
    `/workspaces/${second.id}`,
    `/workspaces/${second.id}/settings`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width !== 768)
        await page.screenshot({
          path: testInfo.outputPath(
            `${path.endsWith('settings') ? 'settings' : path === '/workspaces' ? 'spaces' : 'overview'}-${width}.png`,
          ),
          fullPage: true,
        });
    }
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page
    .getByRole('button', { name: 'New workspace', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
});
