import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createNote,
    openNoteModal, closeNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Note Versioning', () => {

    test('should create versions and restore old version', async ({ page, isMobile }) => {
        const noteTitle = `Versioning Test ${uniqueId()}`;
        const initialContent = 'Initial content v1';
        const editedContent = 'Edited content v2';

        // 1. Login
        await login(page);

        // 2. Create note with initial text
        const noteCard = await createNote(page, noteTitle, initialContent);

        // 3. Edit note to create version 2
        await openNoteModal(page, noteCard);
        const modal = page.locator('.mantine-Modal-content');
        const contentTextarea = modal.locator('textarea');
        await contentTextarea.fill(editedContent);
        await closeNoteModal(page);

        // Verify content updated
        await expect(noteCard).toContainText(editedContent);

        // 4. Open version history menu
        await noteCard.hover();
        const menuBtn = noteCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
        await menuBtn.click();

        await page.getByRole('menuitem', { name: 'Version history' }).click();

        // 5. Verify version history modal
        await expect(page.locator('text=Version History')).toBeVisible({ timeout: 5000 });

        // Get restore buttons - oldest version is last
        const restoreButtons = page.getByRole('button', { name: 'Restore' });
        const restoreCount = await restoreButtons.count();
        expect(restoreCount).toBeGreaterThanOrEqual(1);

        // Accept confirmation dialog
        page.once('dialog', dialog => dialog.accept());

        // Click last restore button (oldest version - initial content)
        await restoreButtons.last().click();

        // 6. Verify modal closes and content restored
        await expect(page.locator('text=Version History')).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).toContainText(initialContent);

        // 7. Open version history again to verify 3 versions exist
        await noteCard.hover();
        await menuBtn.click();
        await page.getByRole('menuitem', { name: 'Version history' }).click();
        await expect(page.locator('text=Version History')).toBeVisible({ timeout: 5000 });

        // Should have 3 versions now: initial, edited, restored
        const versionsAfterRestore = await restoreButtons.count();
        expect(versionsAfterRestore).toBeGreaterThanOrEqual(2);

        // Close modal
        await page.keyboard.press('Escape');
        await expect(page.locator('text=Version History')).not.toBeVisible({ timeout: 5000 });

        // 8. Cleanup
        await noteCard.hover();
        await noteCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const trashedCard = getNoteCard(page, noteTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await trashedCard.hover();
        await trashedCard.locator('[title="Delete forever"]').click();

        // 9. Logout
        await logout(page, isMobile);
    });
});
