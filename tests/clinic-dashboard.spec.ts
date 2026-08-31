import { test, expect } from '@playwright/test';

const CLINIC_USERNAME = 'demo_clinic';
const CLINIC_PASSWORD = 'demo_password123';

test.describe('Clinic dashboard runtime smoke', () => {
  test('should login, load dashboard, refresh, and have no runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto('/clinic-login');
    await expect(page).toHaveURL(/\/clinic-login/);

    await page.fill('[data-testid="input-clinic-username"]', CLINIC_USERNAME);
    await page.fill('[data-testid="input-clinic-password"]', CLINIC_PASSWORD);
    await page.click('[data-testid="button-clinic-login"]');

    await page.waitForURL('/clinic-dashboard', { timeout: 60000 });
    await expect(page.locator('text=Bookings')).toBeVisible({ timeout: 60000 });

    await page.reload();
    await expect(page.locator('text=Bookings')).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test('requires confirmation before sending a reminder digest', async ({ page }) => {
    await page.route('**/api/auth/clinic/reminders/digest-preview', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          recipients: [{
            email: 'doctor@example.com',
            reminders: { nextThreeDays: [], comingWeek: [], totalCount: 0 },
          }],
        }),
      });
    });
    await page.route('**/api/auth/clinic/reminders/digest/send', async route => {
      throw new Error('Manual send must not happen when confirmation is cancelled');
    });

    await page.goto('/clinic-login');
    await page.fill('[data-testid="input-clinic-username"]', CLINIC_USERNAME);
    await page.fill('[data-testid="input-clinic-password"]', CLINIC_PASSWORD);
    await page.click('[data-testid="button-clinic-login"]');
    await page.waitForURL('/clinic-dashboard', { timeout: 60000 });

    await page.click('[data-testid="nav-settings"]');
    await page.click('[data-testid="button-digest-preview"]');
    await expect(page.getByText('doctor@example.com')).toBeVisible();
    await page.click('[data-testid="button-digest-send"]');
    await expect(page.getByText('Send reminder digest now?')).toBeVisible();
    await page.click('[data-testid="button-digest-cancel"]');
    await expect(page.getByText('Send reminder digest now?')).not.toBeVisible();
  });
});
