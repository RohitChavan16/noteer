import { test, expect } from '@playwright/test';
import { login, logout, navigateTo, createNote, getNoteCard, uniqueId } from './helpers.js';

test.describe('Archive Note', () => {

    test('should archive and unarchive note using overview buttons', async ({ page, isMobile }) => {
        const noteTitle = `Archive Test ${uniqueId()}`;
        const noteContent = 'Original content';
        const editedContent = 'Edited content in archive';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Archive note using overview button
        await noteCard.hover();
        await noteCard.locator('[title="Archive"]').click();
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 4. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 5. Wait and find the archived note
        const archivedCard = getNoteCard(page, noteTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });

        // 6. OPEN MODAL: Click on the note card body (not action buttons)
        // Use more specific click on the card content area
        await archivedCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await archivedCard.click({ position: { x: 50, y: 50 } });

        // Wait for modal to appear
        const modal = page.locator('.mantine-Modal-content');
        await expect(modal).toBeVisible({ timeout: 10000 });

        // 7. Edit content in modal
        const contentTextarea = modal.locator('textarea');
        await contentTextarea.fill(editedContent);

        // 8. Close modal
        await modal.locator('button:has-text("Close")').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });

        // 9. Verify text changed
        await expect(archivedCard).toContainText(editedContent);

        // 10. Unarchive note using overview button
        await archivedCard.hover();
        await archivedCard.locator('[title="Unarchive"]').click();
        await expect(archivedCard).not.toBeVisible({ timeout: 5000 });

        // 11. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(editedContent);

        // 12. Cleanup - move to trash
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();

        // 13. Logout
        await logout(page, isMobile);
    });

    test('should archive and unarchive note using modal buttons', async ({ page, isMobile }) => {
        const noteTitle = `Archive Modal Test ${uniqueId()}`;
        const noteContent = 'Original modal content';
        const editedContent = 'Edited content from modal';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Open modal
        await noteCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await noteCard.click({ position: { x: 50, y: 50 } });
        const modal = page.locator('.mantine-Modal-content');
        await expect(modal).toBeVisible({ timeout: 10000 });

        // 4. Archive using modal button
        await modal.locator('[title="Archive"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
        await expect(noteCard).not.toBeVisible({ timeout: 5000 });

        // 5. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 6. Find and click archived note
        const archivedCard = getNoteCard(page, noteTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });
        await archivedCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await archivedCard.click({ position: { x: 50, y: 50 } });
        await expect(modal).toBeVisible({ timeout: 10000 });

        // 7. Edit content
        const contentTextarea = modal.locator('textarea');
        await contentTextarea.fill(editedContent);

        // 8. Close modal
        await modal.locator('button:has-text("Close")').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });

        // 9. Verify changes
        await expect(archivedCard).toContainText(editedContent);

        // 10. Open modal and unarchive
        await archivedCard.click({ position: { x: 50, y: 50 } });
        await expect(modal).toBeVisible({ timeout: 10000 });
        await modal.locator('[title="Unarchive"]').click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });

        // 11. Navigate to Notes and verify
        await navigateTo(page, isMobile, '/');
        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
        await expect(restoredCard).toContainText(editedContent);

        // 12. Cleanup
        await restoredCard.hover();
        await restoredCard.locator('[title="Move to trash"]').click();

        // 13. Logout
        await logout(page, isMobile);
    });
});
