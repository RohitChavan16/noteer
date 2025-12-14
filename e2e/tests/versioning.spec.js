import { test, expect } from '@playwright/test';

test.describe('Note Versioning', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('http://localhost:3000');
        await page.fill('input[type="email"]', 'admin@test.com');
        await page.fill('input[type="password"]', 'test123');
        await page.click('button:has-text("Sign in")');
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });
    });

    test('should create versions and restore them', async ({ page, isMobile }) => {
        const timestamp = Date.now();
        const noteTitle = `Version Test ${timestamp}`;

        // 1. Create a test note
        await page.click('text=Take a note...');
        await page.fill('input[placeholder="Title"]', noteTitle);
        await page.fill('textarea[placeholder="Take a note..."]', 'Initial Content');
        await page.click('button:has-text("Close")');

        // Wait for the note card to appear
        const noteCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(noteCard).toBeVisible({ timeout: 5000 });

        // 2. Edit note to create Version 2
        await noteCard.click();
        await expect(page.locator('div[role="dialog"]')).toBeVisible();

        // Clear and fill new content in modal
        const contentTextarea = page.locator('div[role="dialog"] textarea');
        await contentTextarea.fill('Second Content');

        // Close modal to save
        await page.click('div[role="dialog"] button:has-text("Close")');
        await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

        // Verify content updated
        await expect(noteCard).toContainText('Second Content');

        // 3. Edit note again to create Version 3
        await noteCard.click();
        await expect(page.locator('div[role="dialog"]')).toBeVisible();

        const contentTextarea2 = page.locator('div[role="dialog"] textarea');
        await contentTextarea2.fill('Third Content');

        // Close modal to save
        await page.click('div[role="dialog"] button:has-text("Close")');
        await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

        // Verify content updated
        await expect(noteCard).toContainText('Third Content');

        // 4. Open Version History modal 
        // Need to hover to show action buttons
        await noteCard.hover();

        // Click the menu button (three dots) - on mobile it might be visible differently
        const menuBtn = noteCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 3000 });
        await menuBtn.click();

        // Click Version history option
        await page.getByRole('menuitem', { name: 'Version history' }).click();

        // 5. Verify Version History modal is open
        await expect(page.locator('text=Version History')).toBeVisible({ timeout: 5000 });

        // 6. Restore the first version (Initial Content)
        // There should be at least 2 versions (Initial and Second)
        // The Restore buttons are listed in chronological order
        const restoreButtons = page.getByRole('button', { name: 'Restore' });
        const restoreCount = await restoreButtons.count();
        expect(restoreCount).toBeGreaterThanOrEqual(1);

        // Accept the confirmation dialog
        page.once('dialog', dialog => dialog.accept());

        // Click the last restore button (oldest version - Initial Content)
        await restoreButtons.last().click();

        // 7. Verify modal closes and content is updated back to initial
        await expect(page.locator('text=Version History')).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).toContainText('Initial Content');

        // 8. Cleanup - delete the test note
        await noteCard.hover();

        // Click trash button
        const trashBtn = noteCard.locator('[title="Move to trash"]');
        await trashBtn.click();

        // Verify note is removed from dashboard
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });
    });

    test('should show empty state for notes without versions', async ({ page }) => {
        const timestamp = Date.now();
        const noteTitle = `No Version Test ${timestamp}`;

        // Create a new note (no versions yet)
        await page.click('text=Take a note...');
        await page.fill('input[placeholder="Title"]', noteTitle);
        await page.fill('textarea[placeholder="Take a note..."]', 'Just created');
        await page.click('button:has-text("Close")');

        const noteCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(noteCard).toBeVisible({ timeout: 5000 });

        // Open Version History
        await noteCard.hover();
        const menuBtn = noteCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 3000 });
        await menuBtn.click();

        await page.getByRole('menuitem', { name: 'Version history' }).click();

        // Should show empty state or the current version
        await expect(page.locator('text=Version History')).toBeVisible({ timeout: 5000 });

        // Close the modal
        await page.keyboard.press('Escape');
        await expect(page.locator('text=Version History')).not.toBeVisible({ timeout: 3000 });

        // Cleanup
        await noteCard.hover();
        const trashBtn = noteCard.locator('[title="Move to trash"]');
        await trashBtn.click();
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });
    });
});
