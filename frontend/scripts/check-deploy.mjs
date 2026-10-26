import { loadEnv } from 'vite';

// Validate public build configuration only. Never print environment values.
const env = {
  ...loadEnv('production', process.cwd(), 'VITE_'),
  ...process.env,
};
const problems = [];
try {
  const url = new URL(env.VITE_API_BASE_URL || '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.invalid') ||
    url.hostname === 'example.com' ||
    url.hostname.endsWith('.example.com')
  )
    throw new Error('Invalid public API URL');
} catch {
  problems.push(
    'Set VITE_API_BASE_URL to the real public HTTPS API URL. The local /api Vite proxy is not deployed with static assets.',
  );
}
if (
  !/^[a-zA-Z0-9.!+_-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(
    (env.VITE_LEGAL_CONTACT_EMAIL || '').trim(),
  )
) {
  problems.push(
    'Set VITE_LEGAL_CONTACT_EMAIL explicitly to a valid monitored public address.',
  );
}
if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  console.log(
    'Public build configuration passed. This does not verify DNS, CORS, vendor settings, legal readiness, or mailbox delivery.',
  );
}
