import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createNote,
    openNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Delete Note', () => {

    test('should delete and restore note using overview buttons', async ({ page, isMobile }) => {
        const noteTitle = `Delete Test ${uniqueId()}`;
        const noteContent = 'Content to delete';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Delete note using overview button
        await noteCard.hover();
        await noteCard.locator('[title="Move to trash"]').click();
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash
        await navigateTo(page, isMobile, '/trash');

        // 5. Verify note exists in trash
        const trashedCard = getNoteCard(page, noteTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await expect(trashedCard).toContainText(noteContent);

        // 6. Restore note using overview button
        await trashedCard.hover();
        await trashedCard.locator('[title="Restore"]').click();
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(noteContent);

        // 8. Cleanup - permanently delete
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const cleanupCard = getNoteCard(page, noteTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });
        await cleanupCard.hover();
        await cleanupCard.locator('[title="Delete forever"]').click();

        // 9. Logout
        await logout(page, isMobile);
    });

    test('should delete and restore note using modal buttons', async ({ page, isMobile }) => {
        const noteTitle = `Delete Modal Test ${uniqueId()}`;
        const noteContent = 'Modal content to delete';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Open modal and delete using modal button (title="Trash" in modal)
        await openNoteModal(page, noteCard);
        const modal = page.locator('.mantine-Modal-content');
        await modal.locator('[title="Trash"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Trash
        await navigateTo(page, isMobile, '/trash');

        // 5. Verify note exists in trash
        const trashedCard = getNoteCard(page, noteTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });

        // 6. Restore note using overview button (notes in trash don't have modal edit)
        await trashedCard.hover();
        await trashedCard.locator('[title="Restore"]').click();
        await expect(trashedCard).not.toBeVisible({ timeout: 5000 });

        // 7. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // 8. Cleanup
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const cleanupCard = getNoteCard(page, noteTitle);
        await expect(cleanupCard).toBeVisible({ timeout: 10000 });
        await cleanupCard.hover();
        await cleanupCard.locator('[title="Delete forever"]').click();

        // 9. Logout
        await logout(page, isMobile);
    });
});
