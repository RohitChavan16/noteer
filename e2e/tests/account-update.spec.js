import { test, expect } from '@playwright/test';
import { registerAndSetupUser, loginWithCredentials, logout, uniqueId } from './helpers.js';

test.describe('Account Update', () => {

    test('should update account details and verify changes', async ({ page, isMobile }) => {
        test.setTimeout(60000);

        // New values
        const newFirstName = 'Updated';
        const newLastName = 'Person';
        const newPassword = 'NewPassword456!';

        // 1. Register a new account for this test
        const credentials = await registerAndSetupUser(page);

        // 2. Navigate to settings
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

        // 3. Update first name
        const firstNameInput = page.locator('input[placeholder="John"]');
        await firstNameInput.clear();
        await firstNameInput.fill(newFirstName);

        // 4. Update last name
        const lastNameInput = page.locator('input[placeholder="Doe"]');
        await lastNameInput.clear();
        await lastNameInput.fill(newLastName);

        // 5. Update password
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

        // 8. Login with new password
        await loginWithCredentials(page, {
            email: credentials.email,
            password: newPassword,
            mnemonic: credentials.mnemonic
        });

        // 9. Verify logged in
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 30000 });

        // 10. Verify name changed (check sidebar for updated name)
        if (isMobile) {
            const burger = page.locator('[class*="mantine-Burger"]').first();
            const isBurgerVisible = await burger.isVisible().catch(() => false);
            if (isBurgerVisible) {
                await burger.click();
                await page.waitForTimeout(300);
            }
        }

        await expect(page.locator(`text=${newFirstName}`)).toBeVisible({ timeout: 5000 });
    });
});
