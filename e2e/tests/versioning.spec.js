import { test, expect } from '@playwright/test';
import { registerAndSetupUser, createNote, openNoteModal, closeNoteModal, getNoteCard, uniqueId } from './helpers.js';

test.describe('Note Versioning', () => {

    test('should create versions and restore old version', async ({ page, isMobile }) => {
        test.setTimeout(120000);
        const noteTitle = `Versioning Test ${uniqueId()}`;
        const initialContent = 'Initial content v1';
        const editedContent = 'Edited content v2';

        // 1. Register new user
        await registerAndSetupUser(page);

        // 2. Create note with initial text
        const noteCard = await createNote(page, noteTitle, initialContent);

        // Wait for initial sync to complete (note needs to be synced first)
        await page.waitForTimeout(3000);

        // 3. Edit note to create version 2
        await openNoteModal(page, noteCard);

        const modal = page.locator('.mantine-Modal-content');
        const contentTextarea = modal.locator('.ProseMirror');

        // Set up response listener BEFORE making changes
        const syncPromise = page.waitForResponse(
            response => response.url().includes('/api/notes/sync/batch') && response.status() === 200,
            { timeout: 30000 }
        );

        await contentTextarea.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(editedContent);

        await closeNoteModal(page);

        // Wait for the sync batch request to complete
        await syncPromise;

        // Extra wait for UI to update
        await page.waitForTimeout(1000);

        // Verify content updated - refresh the card reference
        const updatedCard = getNoteCard(page, noteTitle);
        await expect(updatedCard).toContainText(editedContent, { timeout: 10000 });

        // 4. Open version history menu
        await updatedCard.hover();
        const menuBtn = updatedCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
        await menuBtn.click();
        await expect(page.locator('.mantine-Menu-dropdown')).toBeVisible();
        await page.getByRole('menuitem', { name: /version history/i }).click();

        // 5. Verify version history modal
        const modalTitle = page.locator('.mantine-Modal-title').getByText(/Version History/i);
        await expect(modalTitle).toBeVisible({ timeout: 5000 });

        // Wait for loader to disappear
        await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 15000 });

        // Check if "No version history found" message appears
        const noHistoryMessage = page.getByText('No version history found');
        const hasNoHistory = await noHistoryMessage.isVisible().catch(() => false);

        if (hasNoHistory) {
            // Close and try again after waiting
            await page.keyboard.press('Escape');
            await page.waitForTimeout(2000);

            // Reopen version history
            await updatedCard.hover();
            await menuBtn.click();
            await expect(page.locator('.mantine-Menu-dropdown')).toBeVisible();
            await page.getByRole('menuitem', { name: /version history/i }).click();
            await expect(modalTitle).toBeVisible({ timeout: 5000 });
            await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 15000 });
        }

        // Wait for at least one restore button to appear
        const restoreButtons = page.locator('.mantine-Modal-content').getByRole('button', { name: /Restore/i });
        await expect(restoreButtons.first()).toBeVisible({ timeout: 15000 });

        const restoreCount = await restoreButtons.count();
        expect(restoreCount).toBeGreaterThanOrEqual(1);

        // Accept confirmation dialog
        page.once('dialog', async dialog => {
            await dialog.accept();
        });

        // Restore last version (oldest) to ensure we go back to initial content
        await restoreButtons.last().click();

        // Wait for modal to close or loader to finish
        await page.waitForTimeout(2000);

        // 6. Verify version restored
        const finalCard = getNoteCard(page, noteTitle);
        await expect(finalCard).toContainText(initialContent, { timeout: 10000 });
    });
});
