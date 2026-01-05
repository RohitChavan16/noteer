const { test, expect } = require('@playwright/test');
const { logout, navigateTo, uniqueId, handleEncryptionSetup } = require('./helpers.js');

test.describe('Account Update', () => {

    test('should update account details and verify changes', async ({ page, isMobile }) => {
        test.setTimeout(60000);
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

        const createAccountBtn = page.getByRole('button', { name: 'Create account' });
        await expect(createAccountBtn).toBeEnabled({ timeout: 5000 });

        // Wait for registration request to complete
        const registerPromise = page.waitForResponse(response =>
            response.url().includes('/auth/register') && response.status() === 201
        );
        await createAccountBtn.click();
        await registerPromise;


        // Handle encryption setup for new user
        const mnemonic = await handleEncryptionSetup(page);

        // Wait for dashboard
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });

        // 2. Navigate to settings
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
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

        // Unlock with the mnemonic we saved earlier if present
        if (mnemonic) {
            const unlockModal = page.getByRole('heading', { name: 'Unlock Notes' }).first();
            await expect(unlockModal).toBeVisible({ timeout: 10000 });

            // Simulating paste of full mnemonic into first field didn't work reliably
            // Fill all inputs individually
            const inputs = page.locator('.mantine-Autocomplete-input');
            const words = mnemonic.split(' ');
            for (let i = 0; i < words.length; i++) {
                await inputs.nth(i).fill(words[i]);
            }

            const unlockBtn = page.getByRole('button', { name: 'Unlock' });
            await expect(unlockBtn).toBeEnabled();
            await unlockBtn.click({ force: true });
        }

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

        // Check for updated name
        await expect(page.locator(`text=${newFirstName}`)).toBeVisible({ timeout: 5000 });

        // Test complete - changes verified successfully
    });
});
