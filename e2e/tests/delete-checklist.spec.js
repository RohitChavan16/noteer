import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createChecklist,
    openNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Delete Checklist', () => {

    test('should delete and restore checklist', async ({ page, isMobile }) => {
        const checklistTitle = `Delete Checklist ${uniqueId()}`;
        const items = ['Delete Item 1', 'Delete Item 2'];

        // 1. Login
        await login(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Delete using overview button (in 3-dots menu)
        // On mobile, hover is not needed/possible
        if (!isMobile) {
            await noteCard.hover();
        }

        await noteCard.locator('[title="More options"]').click();
        await page.locator('.mantine-Menu-item:has-text("Move to trash")').click();

        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash
        await navigateTo(page, isMobile, '/trash');
        if (isMobile) await page.reload();

        // 5. Verify checklist in trash
        const trashedCard = getNoteCard(page, checklistTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await expect(trashedCard).toContainText('Delete Item 1');

        // 6. Restore checklist (Restore button is directly visible in trash)
        if (!isMobile) {
            await trashedCard.hover();
        }
        await trashedCard.locator('[title="Restore"]').click({ force: true });
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // Test complete - delete/restore flow verified
    });
});
