import { test, expect } from '@playwright/test';
import { assertLoginRedirect, login } from './fixtures/auth.js';

// Each Playwright test receives a fresh browser context (no shared cookies/storage).
test('SCRUM-270/01: verified account logs in and sees the dashboard', async ({ page }) => {
  await login(page);
  const session = await page.request.get('/api/auth/me');
  expect(session.ok()).toBeTruthy();
  expect((await session.json()).user).toBeTruthy();
});

test('SCRUM-270/02: an anonymous user cannot directly open the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await assertLoginRedirect(page);
  const session = await page.request.get('/api/auth/me');
  expect(session.status()).toBe(401);
});

test('SCRUM-270/03: reloading the dashboard preserves an active session', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  const session = await page.request.get('/api/auth/me');
  expect(session.ok()).toBeTruthy();
});

test('SCRUM-270/04: logout revokes access to the dashboard', async ({ page }) => {
  await login(page);
  // The logout control belongs to the global sidebar or Settings navigation.
  const logout = page.getByRole('button', { name: /^(log\s*out|sign\s*out)$/i });
  await expect(logout).toBeVisible();
  await logout.click();
  await assertLoginRedirect(page);
  await page.goto('/dashboard');
  await assertLoginRedirect(page);
  const session = await page.request.get('/api/auth/me');
  expect(session.status()).toBe(401);
});
