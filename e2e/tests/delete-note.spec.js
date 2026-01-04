import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createNote,
    openNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Delete Note', () => {

    test('should delete and restore note', async ({ page, isMobile }) => {
        const noteTitle = `Del ${uniqueId()}`;
        const noteContent = 'Content';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Delete note using overview button (in 3-dots menu)
        // On mobile, hover is not needed/possible
        if (!isMobile) {
            await noteCard.hover();
        }
        await noteCard.locator('[title="More options"]').click();
        await page.waitForTimeout(500); // Wait for menu animation
        await page.locator('.mantine-Menu-item:has-text("Move to trash")').click();

        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        await page.waitForTimeout(3000); // Wait for sync

        // 4. Navigate to Trash
        await page.goto('/trash');

        if (isMobile) {
            await page.waitForTimeout(2000); // Allow sync/load to complete
            await page.reload();
            await page.waitForTimeout(1000);
        }

        // Take a debug screenshot to see what's in the trash
        await page.screenshot({ path: `test-results/debug-trash-load-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });

        // 5. Verify note exists in trash
        const trashedCard = getNoteCard(page, noteTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await expect(trashedCard).toContainText(noteContent);

        // 6. Restore note using overview button
        // Direct force click without hover to avoid detachment issues
        await trashedCard.locator('[title="Restore"]').click({ force: true });
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(noteContent);

        // 8. Cleanup - permanently delete
        if (!isMobile) {
            await restoredCard.hover();
        }
        await restoredCard.locator('[title="More options"]').click();
        await page.waitForTimeout(500);
        await page.locator('.mantine-Menu-item:has-text("Move to trash")').click();

        await page.goto('/trash');

        if (isMobile) {
            await page.waitForTimeout(1000);
            await page.reload();
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: `test-results/debug-trash-cleanup-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });

        const cleanupCard = getNoteCard(page, noteTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });

        // Direct force click without hover
        await cleanupCard.locator('[title="Delete forever"]').click({ force: true });
    });
});
