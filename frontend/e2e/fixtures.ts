import { test as base, expect } from '@playwright/test';
export const test = base.extend<{ isolatedRateLimits: void }>({
  isolatedRateLimits: [
    async ({ request }, use) => {
      expect((await request.post('/api/__test/reset-rate-limits')).ok()).toBe(
        true,
      );
      await use();
    },
    { auto: true },
  ],
});
