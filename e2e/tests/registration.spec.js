import { test, expect } from '@playwright/test';
import { logout, uniqueId, handleEncryptionSetup } from './helpers.js';

test.describe('Registration', () => {

    test('should create new account and verify user role', async ({ page, isMobile }) => {
        const uniqueEmail = `testuser_${uniqueId()}@test.com`;
        const password = 'TestPassword123!';
        const firstName = 'Test';
        const lastName = 'User';

        // 1. Go to register page
        await page.goto('/register');
        await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 10000 });

        // 2. Fill registration form
        // Use placeholder selectors for reliable field targeting
        await page.locator('input[placeholder="John"]').fill(firstName);
        await page.locator('input[placeholder="Doe"]').fill(lastName);
        await page.locator('input[placeholder="you@example.com"]').fill(uniqueEmail);

        // Password fields - use nth() to differentiate
        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).fill(password);  // Password
        await passwordInputs.nth(1).fill(password);  // Confirm password

        // 3. Submit registration - wait for response
        const registerPromise = page.waitForResponse(response =>
            response.url().includes('/auth/register') && response.status() === 201
        );
        await page.getByRole('button', { name: 'Create account' }).click();
        await registerPromise;

        // 4. Handle encryption setup for new user
        await handleEncryptionSetup(page);

        // 5. Wait for redirect to dashboard
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });

        // 5. Verify logged in with correct name
        if (isMobile) {
            const burger = page.locator('[class*="mantine-Burger"]').first();
            const isBurgerVisible = await burger.isVisible().catch(() => false);
            if (isBurgerVisible) {
                await burger.click();
                await page.waitForTimeout(300);
            }
        }

        // Check that user name is visible
        await expect(page.locator(`text=${firstName}`)).toBeVisible({ timeout: 5000 });

        // 6. Verify user role is "user" (not admin)
        const adminLink = page.locator('a[href="/admin"]');
        const isAdminVisible = await adminLink.isVisible().catch(() => false);
        expect(isAdminVisible).toBe(false);
    });
});
