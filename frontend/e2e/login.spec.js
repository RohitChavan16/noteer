import { test, expect } from '@playwright/test';

test('Login Smoke', async ({ page }) => {
    console.log('Navigating to login...');
    await page.goto('/login');
    console.log('Filling credentials...');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    console.log('Waiting for redirect...');
    await expect(page).toHaveURL('/');
    console.log('Login successful');
});
