import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const password = 'a-little-room-123';
function identity() {
  const id = crypto.randomUUID().slice(0, 8);
  return {
    username: `human_${id}`,
    email: `human_${id}@example.com`,
    password,
  };
}
async function seed(request: APIRequestContext) {
  const user = identity();
  const response = await request.post('/api/auth/register', { data: user });
  expect(response.status()).toBe(201);
  return user;
}
async function signIn(page: Page, email: string, value = password) {
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Let me in' }).click();
}
async function startRecovery(page: Page, email: string) {
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send a reset code' }).click();
  await expect(page).toHaveURL('/verify-reset-code');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
}

test('registration validates confirmation, handles real sign-in, restores the session, and signs out', async ({
  page,
}) => {
  const user = identity();
  const requests: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/register'))
      requests.push(request.postDataJSON());
  });
  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('different-password');
  await page.getByRole('button', { name: 'Make it mine' }).click();
  await expect(page.getByText('Those passwords do not match.')).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Make it mine' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('status')).toContainText(
    'Your account is ready.',
  );
  expect(requests).toEqual([user]);
  await signIn(page, user.email, 'incorrect-password');
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials.');
  await signIn(page, user.email);
  await expect(page).toHaveURL('/account');
  await expect(
    page.getByRole('heading', { name: `You're home, ${user.username}.` }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out of this tab' }).click();
  await expect(page).toHaveURL('/login');
  expect(
    await page.evaluate(() => sessionStorage.getItem('donee-session-token')),
  ).toBeNull();
  await page.goto('/account');
  await expect(page).toHaveURL('/login');
});

test('password recovery verifies the code, changes the password, and invalidates older tokens', async ({
  page,
  request,
}) => {
  const user = await seed(request);
  const oldLogin = await request.post('/api/auth/login', {
    data: { email: user.email, password },
  });
  const oldToken = ((await oldLogin.json()) as { access_token: string })
    .access_token;
  await startRecovery(page, user.email);
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.getByLabel('Reset code').fill('000000');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Code is invalid or expired.',
  );
  await page.getByLabel('Reset code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/reset-password');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByLabel('New password', { exact: true })
    .fill('a-new-little-key-456');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('does-not-match');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page.getByText('Those passwords do not match.')).toBeVisible();
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('a-new-little-key-456');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('status')).toContainText(
    'Your password has been changed.',
  );
  expect(
    (
      await request.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${oldToken}` },
      })
    ).status(),
  ).toBe(401);
  await page.getByRole('button', { name: 'Sign out of this tab' }).click();
  await signIn(page, user.email);
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials.');
  await signIn(page, user.email, 'a-new-little-key-456');
  await expect(page).toHaveURL('/account');
});

test('unknown accounts receive the same recovery response and resend can be used after the cooldown', async ({
  page,
}) => {
  await startRecovery(page, identity().email);
  await page.clock.install();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Send a new code' }).click();
  await expect(page.getByRole('status')).toContainText(
    'If the account exists, a fresh code is on its way.',
  );
  await page.getByLabel('Reset code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Code is invalid or expired.',
  );
  await page.reload();
  await expect(page).toHaveURL('/forgot-password');
  expect(await page.evaluate(() => location.search)).toBe('');
});

test('duplicate registration is reported without losing the form', async ({
  page,
  request,
}) => {
  const user = await seed(request);
  await page.goto('/register');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Make it mine' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email already registered.');
  await expect(page.getByLabel('Email address')).toHaveValue(user.email);
});

test('network failures and rate limits show recoverable feedback without signing in', async ({
  page,
}) => {
  await page.goto('/login');
  await page.route('**/api/auth/login', (route) => route.abort());
  await signIn(page, identity().email);
  await expect(page.getByRole('alert')).toContainText('Cannot reach Donee.');
  await page.unroute('**/api/auth/login');
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '900' },
      json: { detail: 'Too many attempts. Try again later.' },
    }),
  );
  await page.getByRole('button', { name: 'Let me in' }).click();
  await expect(page.getByRole('alert')).toContainText('Too many attempts.');
  await expect(page).toHaveURL('/login');
  expect(
    await page.evaluate(() => sessionStorage.getItem('donee-session-token')),
  ).toBeNull();
});

test('invalid stored tokens are removed and unavailable session checks offer retry', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.evaluate(() =>
    sessionStorage.setItem('donee-session-token', 'expired-or-invalid'),
  );
  await page.goto('/account');
  await expect(page).toHaveURL('/login');
  expect(
    await page.evaluate(() => sessionStorage.getItem('donee-session-token')),
  ).toBeNull();
  const user = await seed(request);
  await signIn(page, user.email);
  await expect(page).toHaveURL('/account');
  await page.route('**/api/auth/me', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'A small pause.' }),
  ).toBeVisible();
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
});

test('a completed password reset survives a failed profile fetch by offering sign-in', async ({
  page,
  request,
}) => {
  const user = await seed(request);
  await startRecovery(page, user.email);
  await page.getByLabel('Reset code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await page.route('**/api/auth/me', (route) => route.abort());
  await page
    .getByLabel('New password', { exact: true })
    .fill('yet-another-key-456');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('yet-another-key-456');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('status')).toContainText(
    'Your password has been changed.',
  );
  await page.unroute('**/api/auth/me');
  await signIn(page, user.email, 'yet-another-key-456');
  await expect(page).toHaveURL('/account');
});

test('appearance persists, password visibility is accessible, and all auth pages fit on a phone', async ({
  page,
}, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Password', { exact: true }).fill('a-private-password');
  await page
    .getByRole('button', { name: 'Show password', exact: true })
    .click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page
    .getByRole('button', { name: 'Hide password', exact: true })
    .click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  for (const theme of ['Matrix', 'Terminal', 'Dracula', 'Akira']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.keyboard.press('Escape');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${theme.toLowerCase()}-login.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  }
  await page.getByRole('button', { name: /Fira Code/ }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Appearance', exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'akira');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'fira');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Matrix', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 320)
        await page.screenshot({
          path: testInfo.outputPath(`${path.slice(1)}-mobile.png`),
          fullPage: true,
        });
    }
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${path.slice(1)}.png`),
      fullPage: true,
    });
  }
});
