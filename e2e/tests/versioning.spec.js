import { test, expect } from '@playwright/test';
import fs from 'fs';

import {
    login, logout, navigateTo, createNote,
    openNoteModal, closeNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Note Versioning', () => {

    test('should create versions and restore old version', async ({ page, isMobile }) => {
        test.setTimeout(60000); // Increase timeout to allow debug dump on failure
        const noteTitle = `Versioning Test ${uniqueId()}`;
        const initialContent = 'Initial content v1';
        const editedContent = 'Edited content v2';

        // 1. Login
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        await login(page);

        // 2. Create note with initial text - Capture ID from response
        const createResponsePromise = page.waitForResponse(response =>
            response.url().includes('/api/notes') && response.request().method() === 'POST'
        );
        const noteCard = await createNote(page, noteTitle, initialContent);
        const createResponse = await createResponsePromise;
        const noteData = await createResponse.json();
        const noteId = noteData.id;
        console.log(`Created note with ID: ${noteId}`);

        // 3. Edit note to create version 2
        console.log('Opening note modal...');
        await openNoteModal(page, noteCard);
        console.log('Modal opened');

        const modal = page.locator('.mantine-Modal-content');
        const contentTextarea = modal.locator('textarea');
        await contentTextarea.fill(editedContent);
        console.log('Content filled');

        // Wait for update request
        const updateResponsePromise = page.waitForResponse(response =>
            response.url().includes(`/api/notes/${noteId}`) && response.request().method() === 'PATCH'
        );
        await closeNoteModal(page);
        console.log('Modal closed, waiting for patch...');
        await updateResponsePromise;
        console.log('Patch received');

        // Verify content updated
        await expect(noteCard).toContainText(editedContent);
        console.log('Content verification passed');

        // 4. Open version history menu
        await noteCard.hover();
        console.log('Hovered card');
        const menuBtn = noteCard.locator('[title="More options"]');
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
        await menuBtn.click();
        console.log('Clicked menu button');
        try {
            await page.getByRole('menuitem', { name: 'Version history' }).click();
            console.log('Version history item clicked');

            // 5. Verify version history modal
            // Use specific selector for modal title to avoid matching menu item
            const modalTitle = page.locator('.mantine-Modal-title').getByText('Version History');
            await expect(modalTitle).toBeVisible({ timeout: 5000 });
            console.log('History modal visible');

            // Wait for loader to disappear
            await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });

            // Wait for at least one restore button to appear
            const restoreButtons = page.getByRole('button', { name: 'Restore' });
            await expect(restoreButtons.first()).toBeVisible({ timeout: 10000 });

            const restoreCount = await restoreButtons.count();
            console.log(`Found ${restoreCount} restore buttons`);
            expect(restoreCount).toBeGreaterThanOrEqual(1);

            // Accept confirmation dialog
            page.once('dialog', dialog => dialog.accept());

            // Click last restore button (oldest version - initial content)
            await restoreButtons.last().click();

            // 6. Verify modal closes and content restored
            console.log('Verifying content restored');
            await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
            await expect(noteCard).toContainText(initialContent);
            console.log('Content restored successfully');

            // 7. Open version history again to verify 3 versions exist
            console.log('Re-opening version history');
            await noteCard.hover();
            await menuBtn.click();
            await page.getByRole('menuitem', { name: 'Version history' }).click();

            // Use specific selector for modal title to avoid matching menu item
            const modalTitleReopened = page.locator('.mantine-Modal-title').getByText('Version History');
            await expect(modalTitleReopened).toBeVisible({ timeout: 5000 });
            console.log('History modal re-opened');

            try {
                // Wait for loader to disappear
                await expect(page.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });
                console.log('Loader disappeared');

                // Find versions
                const restoreButtons = page.getByRole('button', { name: 'Restore' });
                await expect(restoreButtons.first()).toBeVisible({ timeout: 10000 });

                const count = await restoreButtons.count();
                console.log(`Found ${count} versions`);

                if (count < 2) {
                    console.log('Dump because count < 2');
                    fs.writeFileSync('status.txt', `COUNT: ${count}`);
                    // Dump modal
                    try {
                        const modalHtml = await page.locator('.mantine-Modal-content').innerHTML();
                        fs.writeFileSync('modal.html', modalHtml);
                    } catch (e) { }
                }

                expect(count).toBeGreaterThanOrEqual(2);

            } catch (e) {
                console.log('ERROR in Step 7');
                fs.writeFileSync('status.txt', `ERROR: ${e.toString()}`);
                // Dump modal
                try {
                    const modalHtml = await page.locator('.mantine-Modal-content').innerHTML();
                    fs.writeFileSync('modal.html', modalHtml);
                } catch (err) { }
                throw e;
            }
        } catch (e) {
            console.log('ERROR CAUGHT');
            fs.writeFileSync('error.txt', e.toString() + '\n' + e.stack);
            throw e;
        }

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
