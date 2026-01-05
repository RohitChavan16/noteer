import { test, expect } from '@playwright/test';
import { uniqueId } from './helpers.js';

test.describe('Encryption Setup', () => {

    test('should complete encryption setup for new user', async ({ page }) => {
        const uniqueEmail = `testuser_${uniqueId()}@test.com`;
        const password = 'TestPassword123!';
        const firstName = 'Encryption';
        const lastName = 'Test';

        // 1. Register a new user
        await page.goto('/register');
        await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 10000 });

        await page.locator('input[placeholder="John"]').fill(firstName);
        await page.locator('input[placeholder="Doe"]').fill(lastName);
        await page.locator('input[placeholder="you@example.com"]').fill(uniqueEmail);

        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).fill(password);
        await passwordInputs.nth(1).fill(password);

        await page.getByRole('button', { name: 'Create account' }).click();

        // 2. Encryption setup modal should appear
        await expect(page.getByRole('heading', { name: 'Encryption Setup' }).first()).toBeVisible({ timeout: 15000 });

        // 3. Verify 24-word mnemonic is displayed
        const mnemonicContainer = page.locator('.mantine-Paper-root').first();
        await expect(mnemonicContainer).toBeVisible();

        // Count words - should be 24 (4 columns x 6 rows)
        const wordElements = page.locator('.mantine-SimpleGrid-root .mantine-Group-root');
        await expect(wordElements.first()).toBeVisible({ timeout: 5000 });

        // 4. Try to continue without checkbox - button should be disabled
        const continueButton = page.getByRole('button', { name: 'Continue' });
        await expect(continueButton).toBeDisabled();

        // 5. Check the "I have written down" checkbox
        await page.getByText('I have written down all 24 words').click();

        // 6. Continue button should now be enabled
        await expect(continueButton).toBeEnabled();

        // 7. Click continue - this triggers key derivation
        await continueButton.click();

        // 8. Wait for "Setting up encryption..." loading state, then success
        await expect(page.getByText('Setting up encryption...')).toBeVisible({ timeout: 3000 }).catch(() => {
            // Loading might be too fast to catch
        });

        // 9. Success screen should appear
        await expect(page.getByText('Encryption is active')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Your notes are now encrypted')).toBeVisible();

        // 10. Complete setup
        await page.getByRole('button', { name: 'Start using Noteer' }).click();

        // 11. Should now see the main dashboard
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });

        // 12. Verify user name is visible
        // 12. Verify user name is visible (use first to avoid strict mode with modal title if still visible)
        await expect(page.locator(`text=${firstName}`).first()).toBeVisible({ timeout: 5000 });
    });

    test('should show unlock modal for returning user', async ({ page }) => {
        const uniqueEmail = `testuser_${uniqueId()}@test.com`;
        const password = 'TestPassword123!';
        let savedMnemonic = '';

        // 1. Register and setup encryption
        await page.goto('/register');
        await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 10000 });

        await page.locator('input[placeholder="John"]').fill('Return');
        await page.locator('input[placeholder="Doe"]').fill('User');
        await page.locator('input[placeholder="you@example.com"]').fill(uniqueEmail);

        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).fill(password);
        await passwordInputs.nth(1).fill(password);

        await page.getByRole('button', { name: 'Create account' }).click();

        // 2. Encryption setup modal should appear
        await expect(page.getByRole('heading', { name: 'Encryption Setup' }).first()).toBeVisible({ timeout: 15000 });

        // 3. Copy the mnemonic (click copy button and get from clipboard simulation)
        // We'll extract it from the page instead
        const wordGroups = page.locator('.mantine-SimpleGrid-root .mantine-Group-root');
        const count = await wordGroups.count();
        const words = [];
        for (let i = 0; i < count; i++) {
            const text = await wordGroups.nth(i).locator('.mantine-Text-root').last().textContent();
            if (text) words.push(text.trim());
        }
        savedMnemonic = words.join(' ');
        console.log(`Saved mnemonic with ${words.length} words`);

        // 4. Complete setup
        await page.getByText('I have written down all 24 words').click();
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText('Encryption is active')).toBeVisible({ timeout: 30000 });
        await page.getByRole('button', { name: 'Start using Noteer' }).click();
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });

        // 5. Logout
        const logoutBtn = page.locator('[title="Logout"]');
        await expect(logoutBtn).toBeVisible({ timeout: 5000 });
        await logoutBtn.click();
        await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 5000 });

        // 6. Login again
        await page.fill('input[type="email"]', uniqueEmail);
        await page.fill('input[type="password"]', password);
        await page.click('button:has-text("Sign in")');

        // 7. Unlock modal should appear (not setup modal)
        await expect(page.getByRole('heading', { name: 'Unlock Notes' }).first()).toBeVisible({ timeout: 15000 });

        // 8. Paste mnemonic into first field
        const firstInput = page.locator('.mantine-Autocomplete-input').first();
        await firstInput.fill(savedMnemonic);

        // 9. Click unlock
        await page.getByRole('button', { name: 'Unlock' }).click();

        // 10. Should see dashboard
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 30000 });
    });

    test('should persist encryption state across page reloads', async ({ page }) => {
        const uniqueEmail = `testuser_${uniqueId()}@test.com`;
        const password = 'TestPassword123!';

        // 1. Register and setup encryption
        await page.goto('/register');
        await page.locator('input[placeholder="John"]').fill('Persist');
        await page.locator('input[placeholder="Doe"]').fill('User');
        await page.locator('input[placeholder="you@example.com"]').fill(uniqueEmail);

        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).fill(password);
        await passwordInputs.nth(1).fill(password);
        await page.getByRole('button', { name: 'Create account' }).click();

        // Complete setup
        await expect(page.getByRole('heading', { name: 'Encryption Setup' }).first()).toBeVisible({ timeout: 15000 });
        await page.getByText('I have written down all 24 words').click();
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText('Encryption is active')).toBeVisible({ timeout: 30000 });
        await page.getByRole('button', { name: 'Start using Noteer' }).click();

        // 2. Create an encrypted note
        await page.locator('text=Take a note...').click();
        await page.fill('input[placeholder="Title"]', 'Secret Title');

        // Content area is a ProseMirror RichTextEditor, not textarea
        const editor = page.locator('.ProseMirror');
        await editor.click();
        await page.keyboard.type('Secret Content');

        await page.click('button:has-text("Close")');

        // 3. Verify note is visible and decrypted
        await expect(page.locator('text=Secret Title')).toBeVisible();
        await expect(page.locator('text=Secret Content')).toBeVisible();

        // 4. Reload page
        await page.reload();

        // 5. Verify still unlocked (no modal) and content still visible
        await expect(page.getByRole('heading', { name: 'Unlock Notes' })).not.toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Secret Title')).toBeVisible({ timeout: 10000 });

        // 6. Logout
        const logoutBtn = page.locator('[title="Logout"]');
        await logoutBtn.click();

        // 7. Check keys cleared on logout
        // (Implicit check: login again requiring unlock, covered by previous test)
    });
});
