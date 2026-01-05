import { test, expect } from '@playwright/test';
import {
    login, navigateTo, createNote, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Delete Note', () => {

    test('should delete and restore note', async ({ page, isMobile }) => {
        const noteTitle = `Del ${uniqueId()}`;
        const noteContent = 'Content';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Delete note using 3-dots menu
        if (!isMobile) {
            await noteCard.hover();
        }
        await noteCard.locator('[title="More options"]').click();
        await page.waitForTimeout(300);
        await page.locator('.mantine-Menu-item:has-text("Move to trash")').click();

        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash using helper (handles mobile sidebar)
        await navigateTo(page, isMobile, '/trash');

        // 5. Verify note exists in trash
        const trashedCard = getNoteCard(page, noteTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await expect(trashedCard).toContainText(noteContent);

        // 6. Restore note
        await trashedCard.locator('[title="Restore"]').click({ force: true });
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify restored
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(noteContent);

        // 8. Cleanup - move to trash again
        if (!isMobile) {
            await restoredCard.hover();
        }
        await restoredCard.locator('[title="More options"]').click();
        await page.waitForTimeout(300);
        await page.locator('.mantine-Menu-item:has-text("Move to trash")').click();
        await expect(restoredCard).not.toBeVisible({ timeout: 5000 });

        // 9. Permanently delete from trash
        await navigateTo(page, isMobile, '/trash');
        const cleanupCard = getNoteCard(page, noteTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });
        await cleanupCard.locator('[title="Delete forever"]').click({ force: true });

        // 10. Verify permanent deletion
        await expect(cleanupCard).not.toBeVisible({ timeout: 5000 });
    });
});
