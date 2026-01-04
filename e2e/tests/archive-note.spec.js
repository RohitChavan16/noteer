import { test, expect } from '@playwright/test';
import { login, navigateTo, createNote, getNoteCard, uniqueId } from './helpers.js';

test.describe('Archive Note', () => {

    test('should archive and unarchive note using overview buttons', async ({ page, isMobile }) => {
        const noteTitle = `Archive Test ${uniqueId()}`;
        const noteContent = 'Test content for archiving';

        // 1. Login
        await login(page);

        // 2. Create note
        const noteCard = await createNote(page, noteTitle, noteContent);

        // 3. Archive note using overview button (on mobile, buttons are always visible)
        if (!isMobile) {
            await noteCard.hover();
        }
        const archiveBtn = noteCard.locator('[title="Archive"]');
        await expect(archiveBtn).toBeVisible({ timeout: 5000 });
        await archiveBtn.click({ force: true });

        // Wait for card to disappear from main view
        await expect(noteCard).not.toBeVisible({ timeout: 10000 });

        // 4. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 5. Verify note is in archive
        const archivedCard = getNoteCard(page, noteTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });

        // 6. Unarchive note (on mobile, buttons are always visible, no hover needed)
        if (!isMobile) {
            await archivedCard.hover();
        }
        const unarchiveBtn = archivedCard.locator('[title="Unarchive"]');
        await expect(unarchiveBtn).toBeVisible({ timeout: 5000 });
        await unarchiveBtn.click({ force: true });
        await expect(archivedCard).not.toBeVisible({ timeout: 10000 });

        // 7. Navigate to Notes and verify it's back
        await navigateTo(page, isMobile, '/');

        const restoredCard = getNoteCard(page, noteTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });

        // Test complete - archive/unarchive verified successfully
    });

});
