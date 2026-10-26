import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('public legal contact configuration', () => {
  it('uses the configured contact throughout document text and links', async () => {
    vi.stubEnv('VITE_LEGAL_CONTACT_EMAIL', 'privacy@example.org');
    const { legalContactEmail, renderLegalText } = await import('./contact');
    expect(legalContactEmail).toBe('privacy@example.org');
    expect(
      renderLegalText('[{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})'),
    ).toBe('[privacy@example.org](mailto:privacy@example.org)');
  });

  it('rejects configuration that could inject Markdown or extra mail fields', async () => {
    vi.stubEnv(
      'VITE_LEGAL_CONTACT_EMAIL',
      'privacy@example.org?bcc=other@example.org',
    );
    await expect(import('./contact')).rejects.toThrow(
      'valid public contact address',
    );
  });
});
