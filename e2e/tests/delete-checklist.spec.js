import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createChecklist,
    openNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Delete Checklist', () => {

    test('should delete and restore checklist using overview buttons', async ({ page, isMobile }) => {
        const checklistTitle = `Delete Checklist ${uniqueId()}`;
        const items = ['Delete Item 1', 'Delete Item 2'];

        // 1. Login
        await login(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Delete using overview button
        await noteCard.hover();
        await noteCard.locator('[title="Move to trash"]').click();
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash
        await navigateTo(page, isMobile, '/trash');

        // 5. Verify checklist in trash
        const trashedCard = getNoteCard(page, checklistTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await expect(trashedCard).toContainText('Delete Item 1');

        // 6. Restore checklist
        await trashedCard.hover();
        await trashedCard.locator('[title="Restore"]').click();
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // 8. Cleanup - permanently delete
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const cleanupCard = getNoteCard(page, checklistTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });
        await cleanupCard.hover();
        await cleanupCard.locator('[title="Delete forever"]').click();

        // 9. Logout
        await logout(page, isMobile);
    });

    test('should delete and restore checklist using modal buttons', async ({ page, isMobile }) => {
        const checklistTitle = `Delete Checklist Modal ${uniqueId()}`;
        const items = ['Modal Item 1', 'Modal Item 2'];

        // 1. Login
        await login(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Open modal and delete (title="Trash" in modal)
        await openNoteModal(page, noteCard);
        const modal = page.locator('.mantine-Modal-content');
        await modal.locator('[title="Trash"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash
        await navigateTo(page, isMobile, '/trash');

        // 5. Verify in trash
        const trashedCard = getNoteCard(page, checklistTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });

        // 6. Restore using overview button (trash notes don't have modal edit)
        await trashedCard.hover();
        await trashedCard.locator('[title="Restore"]').click();
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // 8. Cleanup
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const cleanupCard = getNoteCard(page, checklistTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });
        await cleanupCard.hover();
        await cleanupCard.locator('[title="Delete forever"]').click();

        // 9. Logout
        await logout(page, isMobile);
    });
});
