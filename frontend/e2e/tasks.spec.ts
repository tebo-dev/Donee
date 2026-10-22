import { test } from './fixtures';
import { rememberSession, installSession } from './session';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function seed(request: APIRequestContext) {
  const id = crypto.randomUUID().slice(0, 8);
  const account = {
    email: `tasks_${id}@example.com`,
    username: `tasks_${id}`,
    password: 'tasks-test-123',
  };
  expect(
    (await request.post('/api/auth/register', { data: account })).status(),
  ).toBe(201);
  const login = await request.post('/api/auth/login', {
    data: { email: account.email, password: account.password },
  });
  expect(login.status()).toBe(200);
  const token = rememberSession(await login.json());
  const headers = { Authorization: `Bearer ${token}` };
  const { workspaces } = (await (
    await request.get('/api/workspaces', { headers })
  ).json()) as { workspaces: { id: string }[] };
  return { token, headers, workspace: workspaces[0]!.id };
}
async function open(
  page: Page,
  account: Awaited<ReturnType<typeof seed>>,
  suffix = '',
) {
  await page.goto('/login');
  await installSession(page, account.token);
  await page.goto(`/workspaces/${account.workspace}${suffix}`);
  await expect(
    page.getByRole('heading', { name: 'Things to do' }),
  ).toBeVisible();
}
async function create(
  request: APIRequestContext,
  account: Awaited<ReturnType<typeof seed>>,
  title: string,
) {
  const response = await request.post('/api/tasks', {
    headers: account.headers,
    data: {
      workspace_id: account.workspace,
      title,
      description: 'A real persisted description.',
      priority: 'normal',
      due_at: '2026-10-20',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as {
    id: string;
    title: string;
    status: string;
    description: string;
  };
}

test('create, edit, complete, reopen, archive and delete persisted tasks', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await open(page, account);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task title').fill('x');
  await dialog
    .getByRole('button', { name: 'Create task', exact: true })
    .click();
  await expect(dialog.getByText('Use at least 2 characters.')).toBeVisible();
  await dialog.getByLabel('Task title').fill('Ship a small thing');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Keep the real details here.');
  await dialog.getByLabel('Due date').fill('2026-10-25');
  await dialog
    .getByRole('button', { name: 'Create task', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /Ship a small thing.*To do/ }).click();
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
    'Keep the real details here.',
  );
  await dialog
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('in_progress');
  await dialog
    .getByRole('combobox', { name: 'Priority', exact: true })
    .selectOption('high');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Ship a small thing.*In progress.*High/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Complete Ship a small thing', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('done');
  await expect(
    page.getByRole('button', {
      name: 'Reopen Ship a small thing',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Reopen Ship a small thing', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('all');
  await page.getByRole('button', { name: /Ship a small thing.*To do/ }).click();
  await dialog
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('archived');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await page
    .getByRole('button', { name: /Ship a small thing.*Archived/ })
    .click();
  await dialog
    .getByRole('button', { name: 'Delete task', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await dialog
    .getByRole('button', { name: 'Delete task', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(dialog).not.toBeVisible();
  const list = await (
    await request.get(`/api/tasks?workspace_id=${account.workspace}`, {
      headers: account.headers,
    })
  ).json();
  expect(list.total).toBe(0);
});

test('tags and link attachments persist; rename and removal use real routes', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const task = await create(request, account, 'Research a small idea');
  await open(page, account);
  await page.getByRole('button', { name: 'Manage tags' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tag name').fill('Research');
  await dialog.getByRole('button', { name: 'Create tag' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Edit Research' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit Research' }).click();
  await dialog.getByLabel('Tag name').fill('Ideas');
  await dialog.getByRole('button', { name: 'Save tag' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Edit Ideas' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page
    .getByRole('button', { name: /Research a small idea.*To do/ })
    .click();
  await dialog.getByRole('checkbox', { name: 'Ideas' }).check();
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await page
    .getByRole('button', { name: /Research a small idea.*Ideas/ })
    .click();
  await dialog.getByLabel('Attachment name', { exact: true }).fill('Reference');
  await dialog.getByLabel('Link address').fill('https://example.com/research');
  await dialog.getByRole('button', { name: 'Add link', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Reference' })).toHaveAttribute(
    'href',
    'https://example.com/research',
  );
  await dialog.getByRole('button', { name: 'Rename Reference' }).click();
  await dialog.getByLabel('Attachment name', { exact: true }).fill('Reading');
  await dialog
    .getByRole('button', { name: 'Rename attachment', exact: true })
    .click();
  await expect(dialog.getByRole('link', { name: 'Reading' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove Reading' }).click();
  await dialog
    .getByRole('button', { name: 'Remove attachment', exact: true })
    .click();
  await expect(dialog.getByRole('link', { name: 'Reading' })).not.toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Ideas' }).uncheck();
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  const persisted = await (
    await request.get(`/api/tasks/${task.id}`, { headers: account.headers })
  ).json();
  expect(persisted.tags.total).toBe(0);
  await page.getByRole('button', { name: 'Manage tags' }).click();
  await dialog.getByRole('button', { name: 'Delete Ideas' }).click();
  await dialog.getByRole('button', { name: 'Delete tag', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Edit Ideas' }),
  ).not.toBeVisible();
});

test('keyboard navigation, dirty-close confirmation and failed saves preserve drafts', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await create(request, account, 'Alpha task');
  await create(request, account, 'Beta task');
  await open(page, account);
  await page.getByLabel('Sort by').selectOption('title');
  const first = page.getByRole('button', { name: /Alpha task.*To do/ });
  await first.focus();
  await page.keyboard.press('j');
  await expect(
    page.getByRole('button', { name: /Beta task.*To do/ }),
  ).toBeFocused();
  await page.keyboard.press('k');
  await page.keyboard.press('l');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task title').fill('Draft xja/k');
  await page.keyboard.press('Escape');
  await expect(
    dialog.getByRole('heading', { name: 'Discard your changes?' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(dialog.getByLabel('Task title')).toHaveValue('Draft xja/k');
  await page.route('**/api/tasks/*', (route) =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Cannot reach Donee');
  await expect(dialog.getByLabel('Task title')).toHaveValue('Draft xja/k');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(first).toBeFocused();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search tasks')).toBeFocused();
  await page.getByLabel('Search tasks').fill('Beta');
  await expect(first).not.toBeVisible();
});

test('search includes tasks after first API page and filters reset', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  for (let i = 0; i < 102; i++)
    await create(request, account, `Item ${String(i).padStart(3, '0')}`);
  await open(page, account);
  await expect(page.getByText('50 of 102 tasks · page 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('50 of 102 tasks · page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('2 of 102 tasks · page 3 of 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.getByLabel('Search tasks').fill('Item 101');
  await expect(
    page.getByRole('button', { name: /Item 101.*To do/ }),
  ).toBeVisible();
  await page.getByLabel('Search tasks').fill('nothing matches');
  await page.getByRole('button', { name: 'Show all tasks' }).click();
  await expect(page.getByText('50 of 102 tasks · page 1 of 3')).toBeVisible();
});

test('failed loading, invalid links and foreign task IDs do not expose task data', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const other = await seed(request);
  const task = await create(request, other, 'Private other task');
  await page.route('**/api/tasks?**', (route) => route.abort());
  await open(page, account);
  await expect(page.getByRole('alert')).toContainText('Cannot reach Donee');
  await page.unroute('**/api/tasks?**');
  await page.getByRole('button', { name: 'Retry tasks' }).click();
  await expect(page.getByText('A clear screen. A fresh start.')).toBeVisible();
  await page.goto(`/workspaces/${account.workspace}?task=${task.id}`);
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByText('Private other task')).not.toBeVisible();
  await page.goto(`/workspaces/${account.workspace}?task=invalid`);
  await expect(page.getByRole('alert')).toHaveText(
    'This task address is invalid.',
  );
});

test('task views fit mobile and every theme passes accessibility checks', async ({
  page,
  request,
}, testInfo) => {
  const account = await seed(request);
  await create(
    request,
    account,
    'Make room for a really long task title that wraps on a small screen',
  );
  await open(page, account);
  for (const theme of ['matrix', 'terminal', 'dracula', 'akira']) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`tasks-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: /Make room.*To do/ }).click();
  await expect(page.getByLabel('Task title')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('editor-320.png'),
    fullPage: true,
  });
});

test('file upload, download, transfer failure and deletion use attachment lifecycle', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const task = await create(request, account, 'Keep a useful file');
  await open(page, account, `?task=${task.id}`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Upload file').setInputFiles({
    name: 'reference.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Real test file contents'),
  });
  await expect(dialog.getByText('uploaded · 1 KB')).toBeVisible();
  await dialog.getByRole('button', { name: 'Download', exact: true }).click();
  const download = dialog.getByRole('link', {
    name: 'Download file',
    exact: true,
  });
  await expect(download).toBeVisible();
  expect(
    await (await request.get((await download.getAttribute('href'))!)).text(),
  ).toBe('Real test file contents');
  await page.route('**/api/__test/storage', (route) => route.abort());
  await dialog.getByLabel('Upload file').setInputFiles({
    name: 'failed.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Failure fixture'),
  });
  await expect(dialog.getByText('failed · 1 KB')).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText(
    'Upload could not finish',
  );
  await dialog
    .getByRole('button', { name: 'Remove failed.txt', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Remove attachment', exact: true })
    .click();
  await expect(dialog.getByText('failed · 1 KB')).not.toBeVisible();
  await dialog
    .getByRole('button', { name: 'Remove reference.txt', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Remove attachment', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Download', exact: true }),
  ).not.toBeVisible();
});

test('editing completed task details preserves status and completion metadata', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const task = await create(request, account, 'Already finished');
  const completed = await (
    await request.patch(`/api/tasks/${task.id}`, {
      headers: account.headers,
      data: { status: 'done' },
    })
  ).json();
  await open(page, account, `?task=${task.id}`);
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Clarified after completion.');
  const patch = page.waitForRequest(
    (r) => r.url().endsWith(`/tasks/${task.id}`) && r.method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  expect((await patch).postDataJSON()).not.toHaveProperty('status');
  await expect(dialog).not.toBeVisible();
  const after = await (
    await request.get(`/api/tasks/${task.id}`, { headers: account.headers })
  ).json();
  expect(after.status).toBe('done');
  expect(after.completed_at).toBe(completed.completed_at);
  expect(after.description).toBe('Clarified after completion.');
});

test('pending uploads can be verified after a confirmation outage', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const task = await create(request, account, 'Verify a pending file');
  await open(page, account, `?task=${task.id}`);
  await page.route('**/attachments/*/uploaded', (route) => route.abort());
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Upload file').setInputFiles({
    name: 'pending.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Pending verification'),
  });
  await expect(dialog.getByText('pending · 1 KB')).toBeVisible();
  await page.unroute('**/attachments/*/uploaded');
  await dialog.getByRole('button', { name: 'Verify upload' }).click();
  await expect(dialog.getByText('uploaded · 1 KB')).toBeVisible();
});

test('task shortcuts work on arrival, outside the list, and after leaving search', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await create(request, account, 'Alpha shortcut task');
  await create(request, account, 'Beta shortcut task');
  await open(page, account);
  await page.getByLabel('Sort by').selectOption('title');
  const alpha = page.getByRole('button', {
    name: /Alpha shortcut task.*To do/,
  });
  const beta = page.getByRole('button', { name: /Beta shortcut task.*To do/ });
  await expect(alpha).toBeVisible();
  await page.locator('#main-content').focus();
  await page.keyboard.press('j');
  await expect(alpha).toBeFocused();
  await page.keyboard.press('j');
  await expect(beta).toBeFocused();
  await page.keyboard.press('k');
  await expect(alpha).toBeFocused();
  await page.getByRole('heading', { name: 'My Space', exact: true }).click();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search tasks')).toBeFocused();
  await page.keyboard.type('Beta');
  await page.keyboard.press('Escape');
  await expect(beta).toBeFocused();
  await page.keyboard.press('l');
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue(
    'Beta shortcut task',
  );
  await page.keyboard.press('Escape');
  await expect(beta).toBeFocused();
  await page.getByRole('heading', { name: 'My Space', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue(
    '',
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Keep your hands on the keys.' }),
  ).toBeVisible();
});

test('task shortcuts respect other dialogs, editable fields, modifiers and route cleanup', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await create(request, account, 'Keyboard guard task');
  await open(page, account);
  await expect(
    page.getByRole('button', { name: /Keyboard guard task.*To do/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.keyboard.press('a');
  await page.keyboard.press('/');
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Task title')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByLabel('Search tasks').fill('ajkx/?');
  await expect(page.getByLabel('Search tasks')).toHaveValue('ajkx/?');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search tasks').fill('');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('x');
  await expect(page.getByText('0 open', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '~/spaces', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('server filters keep workspace counts and honor literal search, due ranges and priority order', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  const literal = await create(request, account, 'Literal %_ task');
  const other = await create(request, account, 'Other task');
  await request.patch(`/api/tasks/${literal.id}`, {
    headers: account.headers,
    data: { priority: 'low', due_at: '2026-11-03' },
  });
  await request.patch(`/api/tasks/${other.id}`, {
    headers: account.headers,
    data: { priority: 'high', due_at: '2026-11-01', status: 'done' },
  });
  const queries: URL[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/api/tasks') queries.push(url);
  });
  await open(page, account);
  await expect(page.getByText('1 open', { exact: true })).toBeVisible();
  await expect(page.getByText('1 done', { exact: true })).toBeVisible();
  expect(queries.at(-1)!.searchParams.getAll('statuses')).toEqual([
    'to do',
    'in_progress',
    'blocked',
  ]);
  await page
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('all');
  await page.getByLabel('Sort by').selectOption('priority');
  await expect(page.locator('[data-open-task]').first()).toContainText(
    'Other task',
  );
  await page.getByLabel('Direction').selectOption('desc');
  await expect(page.locator('[data-open-task]').first()).toContainText(
    'Literal %_ task',
  );
  await page.getByLabel('Search tasks').fill('%_');
  await expect(page.getByText('1 of 1 tasks', { exact: true })).toBeVisible();
  await expect(page.getByText('1 done', { exact: true })).toBeVisible();
  await page.getByLabel('Search tasks').fill('');
  await page.getByLabel('Due from', { exact: true }).fill('2026-11-02');
  await page.getByLabel('Due through', { exact: true }).fill('2026-11-03');
  await expect(page.getByText('1 of 1 tasks', { exact: true })).toBeVisible();
  await expect(page.locator('[data-open-task]').first()).toContainText(
    'Literal %_ task',
  );
  expect(queries.at(-1)!.searchParams.get('due_to')).toBe('2026-11-03');
});

test('workspace deletion waits for an in-flight file transfer after navigating away', async ({
  page,
  request,
}) => {
  const account = await seed(request);
  await create(request, account, 'Task with a file');
  await open(page, account);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: /Task with a file.*To do/ }).click();
  let release!: () => void;
  let uploading = false;
  await page.route('**/api/__test/storage', async (route) => {
    uploading = true;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.continue();
  });
  await page.getByLabel('Upload file').setInputFiles({
    name: 'kept.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Attachment fixture'),
  });
  await expect.poll(() => uploading).toBe(true);
  // The task dialog has its own history entry; return through overview to settings.
  await page.goBack();
  await page.goBack();
  const remove = page.getByRole('button', {
    name: 'Delete workspace',
    exact: true,
  });
  await expect(remove).toBeDisabled();
  release();
  await expect(remove).toBeEnabled();
  await remove.click();
  await page.getByLabel('Type the workspace name to confirm').fill('My Space');
  await page
    .getByRole('button', { name: 'Permanently delete workspace', exact: true })
    .click();
  await expect(page).toHaveURL('/workspaces');
  expect(
    (
      await request.get(`/api/workspaces/${account.workspace}`, {
        headers: account.headers,
      })
    ).status(),
  ).toBe(404);
});
