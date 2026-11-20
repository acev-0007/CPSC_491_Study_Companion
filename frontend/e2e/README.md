# SCRUM-270 — authentication browser workflows

These are four real-browser Chromium tests of the existing React, Express, and Supabase Auth integration. They do not mock authentication. They do not create/delete accounts or touch study materials.

## Setup

1. Install dependencies in `frontend` with `npm ci` and install Chromium with `npx playwright install chromium`.
2. Install backend dependencies with `npm ci` in the sibling `backend` folder. Keep backend `.env` configured locally (not in Git); use an isolated Supabase test environment where possible.
3. Create a **verified, disposable** Supabase Auth test account. Set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in your shell (not in source code).
4. From `frontend`, run `npm run test:e2e`. The Playwright config launches Express on port 3001 and Vite on port 5173, with `VITE_ENABLE_ROUTE_PROTECTION=true`.
5. To test an already-running isolated environment instead, set `E2E_BASE_URL` to its frontend URL; this skips local server startup. That deployment must enforce route protection and use the matching test-account backend.

The tests verify login, anonymous redirect, refresh session restoration, and logout rejection. Each test gets a fresh isolated browser context. Failed tests save traces/screenshots/video under `test-results`; HTML reports go to `playwright-report`. Review with `npx playwright show-report`.

**Important:** Never commit `.env`, real test credentials, browser artifacts, or production account information. Login/email verification is not part of these four tests; the E2E account must be confirmed beforehand. Existing CI/CD workflow wiring is out of scope for SCRUM-270.

**Source archive limitation:** The provided `frontend.zip` omits the implementations of `src/components/Sidebar` and `src/components/Account/SettingsSidebar` (and may omit other files). Restore those files from the team's current `main` before running; the logout test expects an accessible button labeled `Log out` or `Sign out`. If the real sidebar uses another accessible label, update that one selector to match the UI rather than weakening the test.
