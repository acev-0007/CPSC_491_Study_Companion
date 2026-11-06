import { chromium } from 'playwright';

// SCRUM-225: non-mutating staging deployment verification (apart from session creation).
// This script must ONLY run against isolated staging targets and a staging-only test user.
const required = [
  'STAGING_FRONTEND_URL',
  'STAGING_BACKEND_URL',
  'STAGING_TEST_EMAIL',
  'STAGING_TEST_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing staging configuration: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.STAGING_SMOKE_ISOLATED !== 'true') {
  console.error('Refusing to run without STAGING_SMOKE_ISOLATED=true. Confirm URLs, Supabase project and test account are staging-only.');
  process.exit(1);
}
const frontend = new URL(process.env.STAGING_FRONTEND_URL);
const backend = new URL(process.env.STAGING_BACKEND_URL);
for (const [name, url] of [['frontend', frontend], ['backend', backend]]) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`Invalid ${name} URL`);
  }
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }
}
const join = (base, pathname) => new URL(pathname.replace(/^\//, ''), `${base.origin}/`).toString();
const timeout = 15_000;
let browser;
async function check(name, action) {
  try {
    await action();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}
async function request(url, options = {}) {
  return fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'manual', ...options });
}
function getStatus(response) {
  // Node fetch exposes a number; Playwright APIResponse exposes status().
  return typeof response.status === 'function' ? response.status() : response.status;
}
function expectStatus(response, expected, label) {
  const actual = getStatus(response);
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}; received HTTP ${actual}`);
  }
}

try {
  await check('Frontend serves HTML', async () => {
    const response = await request(frontend.toString());
    expectStatus(response, 200, 'frontend');
    if (!(await response.text()).includes('<div id="root"')) {
      throw new Error('Frontend response does not look like the Vite/React app');
    }
  });
  await check('Backend /api/health', async () => {
    const response = await request(join(backend, '/api/health'));
    expectStatus(response, 200, 'health');
    if ((await response.json()).status !== 'ok') throw new Error('Unexpected health response');
  });
  await check('Anonymous backend /api/auth/me is rejected', async () => {
    const response = await request(join(backend, '/api/auth/me'));
    expectStatus(response, 401, 'backend anonymous auth');
  });
  await check('Frontend /api/auth proxy rejects anonymous access', async () => {
    const response = await request(join(frontend, '/api/auth/me'));
    expectStatus(response, 401, 'frontend anonymous auth');
  });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await check('Anonymous dashboard redirects to login', async () => {
    await page.goto(join(frontend, '/dashboard'), { waitUntil: 'domcontentloaded', timeout });
    await page.waitForURL('**/login', { timeout });
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout });
  });
  await check('Staging account can login via deployed API', async () => {
    const response = await context.request.post(join(frontend, '/api/auth/login'), {
      data: { email: process.env.STAGING_TEST_EMAIL, password: process.env.STAGING_TEST_PASSWORD },
      timeout,
    });
    if (getStatus(response) !== 200) {
      // Only display a recognized, server-supplied error string; never credentials/cookies.
      let detail = '';
      try {
        const payload = await response.json();
        if (typeof payload?.error === 'string') detail = `; server error: ${payload.error.slice(0, 160)}`;
      } catch { /* Non-JSON errors will still show their HTTP status. */ }
      throw new Error(`login: expected HTTP 200; received HTTP ${getStatus(response)}${detail}`);
    }
    const body = await response.json();
    if (!body.user) throw new Error('Login response has no user');
    const me = await context.request.get(join(frontend, '/api/auth/me'), { timeout });
    expectStatus(me, 200, 'authenticated current user');
    const current = await me.json();
    if (!current.user) throw new Error('Authenticated session did not persist');
  });
  await check('Authenticated staging dashboard renders', async () => {
    await page.goto(join(frontend, '/dashboard'), { waitUntil: 'domcontentloaded', timeout });
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor({ timeout });
    if (new URL(page.url()).pathname !== '/dashboard') throw new Error('Unexpected dashboard redirect');
  });
  console.log('All staging authentication smoke checks passed.');
} catch {
  process.exitCode = 1;
} finally {
  await browser?.close();
}
