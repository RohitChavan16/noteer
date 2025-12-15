import { test, expect } from '@playwright/test';
import { logout, navigateTo, uniqueId } from './helpers.js';

test.describe('Account Update', () => {

    test('should update account details and verify changes', async ({ page, isMobile }) => {
        const timestamp = uniqueId();

        // Initial account - we'll create a fresh user first
        const initialEmail = `account_test_${timestamp}@test.com`;
        const initialPassword = 'InitialPass123!';
        const initialFirstName = 'Initial';
        const initialLastName = 'User';

        // New values
        const newFirstName = 'Updated';
        const newLastName = 'Person';
        const newPassword = 'NewPassword456!';

        // 1. First register a new account for this test
        await page.goto('/register');
        await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 10000 });

        // Fill registration form using placeholder selectors
        await page.locator('input[placeholder="John"]').fill(initialFirstName);
        await page.locator('input[placeholder="Doe"]').fill(initialLastName);
        await page.locator('input[placeholder="you@example.com"]').fill(initialEmail);

        const regPasswordInputs = page.locator('input[type="password"]');
        await regPasswordInputs.nth(0).fill(initialPassword);
        await regPasswordInputs.nth(1).fill(initialPassword);

        await page.getByRole('button', { name: 'Create account' }).click();

        // Wait for dashboard
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });

        // 2. Navigate to settings
        await navigateTo(page, isMobile, '/settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

        // 3. Update first name - find by current placeholder
        const firstNameInput = page.locator('input[placeholder="John"]');
        await firstNameInput.clear();
        await firstNameInput.fill(newFirstName);

        // 4. Update last name
        const lastNameInput = page.locator('input[placeholder="Doe"]');
        await lastNameInput.clear();
        await lastNameInput.fill(newLastName);

        // 5. Update password (optional - just test name update)
        const settingsPasswordInputs = page.locator('input[type="password"]');
        if (await settingsPasswordInputs.count() > 0) {
            await settingsPasswordInputs.nth(0).fill(newPassword);
            await settingsPasswordInputs.nth(1).fill(newPassword);
        }

        // 6. Save changes
        await page.getByRole('button', { name: 'Save Changes' }).click();

        // Wait for success message
        await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 5000 });

        // 7. Logout
        await logout(page, isMobile);

        // 8. Login with initial email and new password
        await page.locator('input[type="email"]').fill(initialEmail);
        await page.locator('input[type="password"]').fill(newPassword);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // 9. Verify logged in
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });

        // 10. Verify name changed (check sidebar for updated name)
        if (isMobile) {
            const burger = page.locator('[class*="mantine-Burger"]').first();
            const isBurgerVisible = await burger.isVisible().catch(() => false);
            if (isBurgerVisible) {
                await burger.click();
                await page.waitForTimeout(300);
            }
        }

        // Check for updated name
        await expect(page.locator(`text=${newFirstName}`)).toBeVisible({ timeout: 5000 });

        // 11. Logout
        await logout(page, isMobile);
    });
});
