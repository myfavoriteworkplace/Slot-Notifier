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
});
