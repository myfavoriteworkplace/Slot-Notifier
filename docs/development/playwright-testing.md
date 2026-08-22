# Playwright E2E Testing

This document explains how to install, configure, and run Playwright for runtime verification of BookMySlot.

## 1. Install Playwright

From the project root:

```bash
npm install
npm install -D @playwright/test
npx playwright install
```

> `npx playwright install` downloads browser dependencies for Chromium, Firefox, and WebKit. Only Chromium is used by the sample tests in this repo.

## 2. What was added

- `playwright.config.ts`
- `tests/clinic-dashboard.spec.ts`
- `package.json` scripts:
  - `npm run test:e2e`
  - `npm run test:e2e:headed`
  - `npm run test:e2e:ui`

## 3. How Playwright works for this repo

Playwright starts the local dev server using `npm run dev` and runs tests against `http://localhost:5000`.

The sample smoke test:

- navigates to `/clinic-login`
- enters the demo clinic credentials
- signs in
- waits for `/clinic-dashboard`
- refreshes the page
- asserts the bookings panel is visible
- fails if any browser console errors or uncaught page errors occur

## 4. Demo credentials

The app seeds demo data on startup, including demo login credentials:

- Username: `demo_clinic`
- Password: `demo_password123`

If the app does not use demo seeds, use a valid clinic account with the same login flow.

## 5. Running Playwright tests

### Run a headless smoke test

```bash
npm run test:e2e
```

### Run tests with a visible browser window

```bash
npm run test:e2e:headed
```

### Launch the Playwright UI to inspect tests

```bash
npm run test:e2e:ui
```

## 6. Debugging test failures

### a. Check the browser logs

The sample test captures `pageerror` and `console.error` messages. Any runtime exception will fail the test.

### b. Confirm the app is available

Ensure the local app is running at `http://localhost:5000` or update `playwright.config.ts` if your app uses a different local URL.

### c. Verify environment configuration

- `VITE_API_URL` should point to the backend API URL
- `FRONTEND_URL` should allow `http://localhost:5000` in the backend CORS config

## 7. Adjusting for your environment

If your app uses a different port, edit `playwright.config.ts`:

```ts
use: {
  baseURL: 'http://localhost:5173',
},
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
}
```

If the backend and frontend are on separate URLs, make sure `client/src/lib/queryClient.ts` has the correct `VITE_API_URL`, and set it in `.env`.

## 8. Add more tests

Create new files under `tests/` with the `.spec.ts` extension.

Example paths for future coverage:

- `tests/clinic-login.spec.ts`
- `tests/clinic-booking-flow.spec.ts`
- `tests/clinic-notifications.spec.ts`
- `tests/doctor-dashboard.spec.ts`

Each test should capture:

- page navigation
- element visibility
- network stability
- console errors
- uncaught page exceptions

## 9. CI integration

Add the Playwright test command to your CI pipeline once it is stable.

Example:

```yaml
- name: Run E2E tests
  run: npm run test:e2e
```

If you need, I can also help add GitHub Actions integration for this E2E test suite.
