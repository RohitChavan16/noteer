import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should show login page', async ({ page }) => {
        await page.goto('/login');

        await expect(page.locator('h2')).toContainText('Welcome back');
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
        await page.goto('/login');
        await page.click('a[href="/register"]');

        await expect(page).toHaveURL('/register');
        await expect(page.locator('h2')).toContainText('Create account');
    });

    test('should show validation errors', async ({ page }) => {
        await page.goto('/login');

        // Try to submit with invalid data
        await page.fill('input[type="email"]', 'invalid-email');
        await page.fill('input[type="password"]', '123');
        await page.click('button[type="submit"]');

        // Form should not submit (HTML5 validation)
        await expect(page).toHaveURL('/login');
    });
});

test.describe('Theme', () => {
    test('should default to dark mode', async ({ page }) => {
        await page.goto('/login');

        // Check that dark theme is applied
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');
    });
});

test.describe('Responsive Design', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/login');

        // Auth form should be visible and properly sized
        const form = page.locator('.auth-form');
        await expect(form).toBeVisible();

        const box = await form.boundingBox();
        expect(box?.width).toBeLessThan(400);
    });
});
