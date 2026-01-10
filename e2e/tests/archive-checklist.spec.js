import { test, expect } from '@playwright/test';
import { registerAndSetupUser, navigateTo, createChecklist, getNoteCard, uniqueId } from './helpers.js';

test.describe('Archive Checklist', () => {

    test('should archive and unarchive checklist using overview buttons', async ({ page, isMobile }) => {
        const checklistTitle = `Archive Checklist ${uniqueId()}`;
        const items = ['Item 1', 'Item 2', 'Item 3'];

        // 1. Register new user
        await registerAndSetupUser(page);

        // 2. Create checklist
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Archive checklist using overview button
        await noteCard.hover();
        const archiveBtn = noteCard.locator('[title="Archive"]');
        await expect(archiveBtn).toBeVisible({ timeout: 5000 });
        await archiveBtn.click();

        // Wait for card to disappear from main view
        await expect(noteCard).not.toBeVisible({ timeout: 10000 });

        // 4. Navigate to Archive
        await navigateTo(page, isMobile, '/archive');

        // 5. Verify checklist is in archive
        const archivedCard = getNoteCard(page, checklistTitle);
        await expect(archivedCard).toBeVisible({ timeout: 10000 });

        // 6. Unarchive checklist
        await archivedCard.hover();
        const unarchiveBtn = archivedCard.locator('[title="Unarchive"]');
        await expect(unarchiveBtn).toBeVisible({ timeout: 5000 });
        await unarchiveBtn.click();
        await expect(archivedCard).not.toBeVisible({ timeout: 10000 });

        // 7. Navigate to Notes and verify it's back
        await navigateTo(page, isMobile, '/');

        const restoredCard = getNoteCard(page, checklistTitle);
        await expect(restoredCard).toBeVisible({ timeout: 10000 });
    });

});
