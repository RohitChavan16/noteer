import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createChecklist,
    openNoteModal, closeNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Archive Checklist', () => {

    test('should archive and unarchive checklist using overview buttons', async ({ page, isMobile }) => {
        const checklistTitle = `Archive Checklist ${uniqueId()}`;
        const items = ['Item 1', 'Item 2', 'Item 3'];
        const editedItem = 'Edited Item 1';

        // 1. Login
        await login(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Archive checklist using overview button
        await noteCard.hover();
        await noteCard.locator('[title="Archive"]').click();
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 5. Edit checklist in archive
        const archivedCard = getNoteCard(page, checklistTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });

        await openNoteModal(page, archivedCard);

        // Edit first item - Mantine modal selector
        const modal = page.locator('.mantine-Modal-content');
        const firstItemInput = modal.locator('input[type="text"]').first();
        await firstItemInput.fill(editedItem);
        await closeNoteModal(page);

        // 6. Verify text changed
        await expect(archivedCard).toContainText(editedItem);

        // 7. Unarchive checklist
        await archivedCard.hover();
        await archivedCard.locator('[title="Unarchive"]').click();
        await expect(archivedCard).not.toBeVisible({ timeout: 5000 });

        // 8. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(editedItem);

        // 9. Cleanup
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();

        // 10. Logout
        await logout(page, isMobile);
    });

    test('should archive and unarchive checklist using modal buttons', async ({ page, isMobile }) => {
        const checklistTitle = `Archive Checklist Modal ${uniqueId()}`;
        const items = ['Task A', 'Task B'];
        const editedItem = 'Edited Task A';

        // 1. Login
        await login(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Open modal and archive using modal button
        await openNoteModal(page, noteCard);
        const modal = page.locator('.mantine-Modal-content');
        await modal.locator('[title="Archive"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 5. Edit checklist
        const archivedCard = getNoteCard(page, checklistTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });

        await openNoteModal(page, archivedCard);
        const firstItemInput = modal.locator('input[type="text"]').first();
        await firstItemInput.fill(editedItem);
        await closeNoteModal(page);

        // 6. Verify changes
        await expect(archivedCard).toContainText(editedItem);

        // 7. Unarchive using modal
        await openNoteModal(page, archivedCard);
        await modal.locator('[title="Unarchive"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });

        // 8. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // 9. Cleanup
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();

        // 10. Logout
        await logout(page, isMobile);
    });
});
