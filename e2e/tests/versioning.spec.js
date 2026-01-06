import { test, expect } from '@playwright/test';


import {
    login, logout, navigateTo, createNote,
    openNoteModal, closeNoteModal, getNoteCard, uniqueId
} from './helpers.js';



test.describe('Note Versioning', () => {

    test('should create versions and restore old version', async ({ page, isMobile }) => {
        test.setTimeout(120000);
        const noteTitle = `Versioning Test ${uniqueId()}`;
        const initialContent = 'Initial content v1';
        const editedContent = 'Edited content v2';

        // 1. Login
        await login(page);

        // 2. Create note with initial text - Capture ID from response
        const createResponsePromise = page.waitForResponse(response =>
            response.url().includes('/api/notes') && response.request().method() === 'POST'
        );
        const noteCard = await createNote(page, noteTitle, initialContent);
        const createResponse = await createResponsePromise;
        const noteData = await createResponse.json();
        const noteId = noteData.id;

        // 3. Edit note to create version 2
        // 3. Edit note to create version 2
        await openNoteModal(page, noteCard);

        const modal = page.locator('.mantine-Modal-content');
        const contentTextarea = modal.locator('.ProseMirror');
        // Wait for sync batch request containing our update
        const updateResponsePromise = page.waitForResponse(async response => {
            if (response.url().includes('/api/notes/sync/batch') && response.request().method() === 'POST') {
                try {
                    const body = await response.request().postDataJSON();
                    return body.operations && body.operations.some(op => op.id === noteId && op.op === 'update');
                } catch (e) { return false; }
            }
            return false;
        });

        await contentTextarea.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(editedContent);

        await closeNoteModal(page);
        await updateResponsePromise;

        // Verify content updated
        await expect(noteCard).toContainText(editedContent);

        // 4. Open version history menu
        await noteCard.hover();
        const menuBtn = noteCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
        await menuBtn.click();
        await expect(page.locator('.mantine-Menu-dropdown')).toBeVisible();
        await page.getByRole('menuitem', { name: /version history/i }).click();

        // 5. Verify version history modal
        // Use specific selector for modal title to avoid matching menu item
        // Use specific selector for modal title to avoid matching menu item
        const modalTitle = page.locator('.mantine-Modal-title').getByText(/Version History/i);
        await expect(modalTitle).toBeVisible({ timeout: 5000 });

        // Wait for loader to disappear
        await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });

        // Wait for at least one restore button to appear
        // Use specific selector ensuring we target the buttons inside the modal
        const restoreButtons = page.locator('.mantine-Modal-content').getByRole('button', { name: /Restore/i });
        await expect(restoreButtons.first()).toBeVisible({ timeout: 10000 });

        const restoreCount = await restoreButtons.count();
        expect(restoreCount).toBeGreaterThanOrEqual(1);

        // Accept confirmation dialog
        page.once('dialog', async dialog => {
            await dialog.accept();
        });

        // Restore first version
        await restoreButtons.first().click();

        // Wait for loader during restore
        await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });

        // 6. Verify version restored
        // The content should revert to "Initial content v1"
        await expect(noteCard).toContainText(initialContent);

        // 7. Open version history again to verify 3 versions exist
        // Reload page to ensure fresh state and avoid stale elements after store update
        await page.reload();
        await page.waitForLoadState('networkidle');

        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        await restoredCard.scrollIntoViewIfNeeded();
        await restoredCard.hover();

        const menuBtnReopen = restoredCard.locator('[title="More options"]');
        await expect(menuBtnReopen).toBeVisible();
        await menuBtnReopen.click();

        // Explicitly wait for menu dropdown
        await expect(page.locator('.mantine-Menu-dropdown')).toBeVisible();
        await page.getByRole('menuitem', { name: /version history/i }).click();

        // Use specific selector for modal title to avoid matching menu item
        const modalTitleReopened = page.locator('.mantine-Modal-title').getByText(/Version History/i);
        await expect(modalTitleReopened).toBeVisible({ timeout: 5000 });

        // Wait for loader
        await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });

        // Find versions
        const restoreButtonsReopened = page.locator('.mantine-Modal-content').getByRole('button', { name: /Restore/i });
        await expect(restoreButtonsReopened.first()).toBeVisible({ timeout: 10000 });

        const countReopened = await restoreButtonsReopened.count();
        expect(countReopened).toBeGreaterThanOrEqual(2);
    });
});
