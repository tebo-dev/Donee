import { expect } from '@playwright/test';
import { test } from './fixtures';
import { registrationAgreement } from './legal-agreement';
import { installSession, rememberSession } from './session';

test('task loading overlaps workspace detail and fresh navigation reuses the cache', async ({
  page,
  request,
}) => {
  const id = crypto.randomUUID().slice(0, 8);
  const credentials = {
    email: `perf_${id}@example.com`,
    username: `perf_${id}`,
    password: 'performance-test-123',
  };
  expect(
    (
      await request.post('/api/auth/register', {
        data: { ...credentials, ...registrationAgreement },
      })
    ).status(),
  ).toBe(201);
  const login = await request.post('/api/auth/login', {
    data: { email: credentials.email, password: credentials.password },
  });
  expect(login.status()).toBe(200);
  const token = rememberSession(await login.json());
  const headers = { Authorization: `Bearer ${token}` };
  const { workspaces } = await (
    await request.get('/api/workspaces', { headers })
  ).json();
  const workspaceId = workspaces[0].id as string;
  await request.post('/api/tasks', {
    headers,
    data: {
      workspace_id: workspaceId,
      title: 'Cache regression task',
      description: '',
      priority: 'normal',
      due_at: '2026-12-01',
    },
  });
  await page.goto('/login');
  await installSession(page, token);
  let tasks = 0;
  let tags = 0;
  let taskStarted!: () => void;
  let tagStarted!: () => void;
  const taskRequest = new Promise<void>((resolve) => {
    taskStarted = resolve;
  });
  const tagRequest = new Promise<void>((resolve) => {
    tagStarted = resolve;
  });
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname;
    if (path === '/api/tasks') {
      tasks++;
      taskStarted();
    }
    if (path === '/api/tags') {
      tags++;
      tagStarted();
    }
  });
  // A serial implementation cannot finish this route: both independent
  // requests must start before workspace detail is allowed to respond.
  await page.route(`**/api/workspaces/${workspaceId}`, async (route) => {
    await Promise.all([taskRequest, tagRequest]);
    await route.continue();
  });
  await page.goto(`/workspaces/${workspaceId}`);
  await expect(
    page.getByText('Cache regression task', { exact: true }),
  ).toBeVisible();
  expect(tasks).toBe(1);
  expect(tags).toBe(1);
  await page.getByRole('link', { name: /^All spaces/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Your corners' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'My Space', exact: true }).click();
  await expect(
    page.getByText('Cache regression task', { exact: true }),
  ).toBeVisible();
  expect(tasks).toBe(1);
  expect(tags).toBe(1);
});
