import process from "node:process";
import { expect } from '@playwright/test';

/** Only verified, disposable test credentials may be used for browser E2E. */
export function testCredentials() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('SCRUM-270: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to a verified disposable Supabase test account.');
  }
  return { email, password };
}

export async function login(page) {
  const { email, password } = testCredentials();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}

export async function assertLoginRedirect(page) {
  // The application may send unauthenticated users to the public landing
  // page or the login screen. Neither should expose protected content.
  await expect(page).toHaveURL(/\/(?:login\/?)?$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
}
