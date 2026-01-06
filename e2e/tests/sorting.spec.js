
import { test, expect } from '@playwright/test';
import { login, createNote, openNoteModal, closeNoteModal, getNoteCard } from './helpers';

test.describe('Note Sorting', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should sort notes by creation time (Newest first) and ignore updates', async ({ page }) => {
        // 1. Create 3 notes in sequence
        // We use timestamps in titles to ensure uniqueness and traceability
        const timestamp = Date.now();
        const noteA_Title = `Note A ${timestamp}`;
        const noteB_Title = `Note B ${timestamp}`;
        const noteC_Title = `Note C ${timestamp}`;

        await createNote(page, noteA_Title, 'Content A');
        await page.waitForTimeout(2000); // Ensure distinct creation times (avoid ms collisions)

        await createNote(page, noteB_Title, 'Content B');
        await page.waitForTimeout(2000);

        await createNote(page, noteC_Title, 'Content C');

        // 2. Verify initial order (Newest first -> C, B, A)

        // Filter by our unique timestamp to hide other notes and avoid pagination/interleaving issues
        const initialSearch = page.getByPlaceholder('Search');
        await initialSearch.fill(String(timestamp));
        await page.waitForTimeout(500); // Wait for search to apply

        // Ensure "Newest first" is selected explicitly
        const sortButton = page.getByLabel('Newest first').or(page.getByLabel('Oldest first'));
        if ((await sortButton.getAttribute('aria-label')) === 'Oldest first') {
            await sortButton.click();
            await page.getByRole('menuitem', { name: 'Newest first' }).click();
            await expect(page.locator('button[aria-label="Newest first"]')).toBeVisible();
        }


        await page.waitForTimeout(1000);

        const cards = page.locator('.note-card');
        const allTitles = await cards.allInnerTexts();

        // Find indices
        const idxA = allTitles.findIndex(t => t.includes(noteA_Title));
        const idxB = allTitles.findIndex(t => t.includes(noteB_Title));
        const idxC = allTitles.findIndex(t => t.includes(noteC_Title));

        expect(idxA).not.toBe(-1);
        expect(idxB).not.toBe(-1);
        expect(idxC).not.toBe(-1);


        expect(idxC).toBeLessThan(idxB);
        expect(idxB).toBeLessThan(idxA);

        // 3. Edit Note A (The oldest created)
        // Re-query to avoid stale element (list re-renders often)
        const cardA = page.locator('.note-card').filter({ hasText: noteA_Title }).first();
        await openNoteModal(page, cardA);

        // Modify content to trigger updated_at change
        const editor = page.locator('.ProseMirror');
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' - Updated');

        await closeNoteModal(page);

        // Wait for update to persist and UI to potentially react
        await page.waitForTimeout(1000);

        // 4. Verify order AGAIN. 
        // With CREATED_AT sort, logic constraints:
        // Note A should STILL be at the bottom (oldest created).
        // Order should still be C, B, A.

        // Ensure search is still applied (persists across modals?)
        // Yes, store state persists. But good to be sure.
        const searchInput = page.getByPlaceholder('Search');
        if (await searchInput.inputValue() !== String(timestamp)) {
            await searchInput.fill(String(timestamp));
            await page.waitForTimeout(500);
        }
        await expect(searchInput).toHaveValue(String(timestamp));

        const newCardTexts = await page.locator('.note-card').allInnerTexts();
        const newIdxA = newCardTexts.findIndex(t => t.includes(noteA_Title));
        const newIdxB = newCardTexts.findIndex(t => t.includes(noteB_Title));
        const newIdxC = newCardTexts.findIndex(t => t.includes(noteC_Title));

        expect(newIdxC).toBeLessThan(newIdxB);
        expect(newIdxB).toBeLessThan(newIdxA);
    });

    test('should allow switching to Oldest First', async ({ page }) => {
        // Reuse setup logic or create new notes
        const timestamp = Date.now();
        const note1 = `Oldest Note ${timestamp}`;
        const note2 = `Newest Note ${timestamp}`;

        await createNote(page, note1, 'Content 1');
        await page.waitForTimeout(2000);
        await createNote(page, note2, 'Content 2');

        // Initial: Newest First (Note 2, Note 1)

        // Filter by timestamp
        await page.getByPlaceholder('Search').fill(String(timestamp));
        await page.waitForTimeout(500);

        let cardTexts = await page.locator('.note-card').allInnerTexts();
        let idx1 = cardTexts.findIndex(t => t.includes(note1));
        let idx2 = cardTexts.findIndex(t => t.includes(note2));

        expect(idx2).toBeLessThan(idx1);

        // Switch to Oldest First
        // Open menu
        await page.getByLabel('Newest first').click();

        // Click option
        const oldestOption = page.getByRole('menuitem', { name: 'Oldest first' });
        await expect(oldestOption).toBeVisible();
        await oldestOption.click();

        // Verify label changed (indicates state update)
        // Note: Tooltip might take a moment to update or hide. 
        // We check aria-label on the button if possible, or wait.
        // The button label should eventually become 'Oldest first'.
        await expect(page.locator('button[aria-label="Oldest first"]')).toBeVisible({ timeout: 5000 });

        // Wait for the UI to actually reorder the notes
        // The first note card should now be the oldest note (note1)
        await expect(async () => {
            const firstCardText = await page.locator('.note-card').first().innerText();
            expect(firstCardText).toContain(note1);
        }).toPass({ timeout: 10000 });

        // Verify Order: Note 1 (Oldest), Note 2 (Newest)
        cardTexts = await page.locator('.note-card').allInnerTexts();
        idx1 = cardTexts.findIndex(t => t.includes(note1));
        idx2 = cardTexts.findIndex(t => t.includes(note2));

        expect(idx1).toBeLessThan(idx2);
    });
});
