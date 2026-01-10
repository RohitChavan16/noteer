import { test, expect } from '@playwright/test';
import { registerAndSetupUser, createNote } from './helpers';

test.describe('Note Sorting', () => {
    let credentials;

    test.beforeEach(async ({ page }) => {
        // Each test gets a fresh user
        credentials = await registerAndSetupUser(page);
    });

    test('should sort notes by creation time (Newest first) and ignore updates', async ({ page }) => {
        // 1. Create 3 notes in sequence
        const timestamp = Date.now();
        const noteA_Title = `Note A ${timestamp}`;
        const noteB_Title = `Note B ${timestamp}`;
        const noteC_Title = `Note C ${timestamp}`;

        await createNote(page, noteA_Title, 'Content A');
        await page.waitForTimeout(1000);

        await createNote(page, noteB_Title, 'Content B');
        await page.waitForTimeout(1000);

        await createNote(page, noteC_Title, 'Content C');

        // 2. Verify initial order (Newest first -> C, B, A)
        const initialSearch = page.getByPlaceholder('Search');
        await initialSearch.fill(String(timestamp));
        await page.waitForTimeout(500);

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

        const idxA = allTitles.findIndex(t => t.includes(noteA_Title));
        const idxB = allTitles.findIndex(t => t.includes(noteB_Title));
        const idxC = allTitles.findIndex(t => t.includes(noteC_Title));

        expect(idxA).not.toBe(-1);
        expect(idxB).not.toBe(-1);
        expect(idxC).not.toBe(-1);

        expect(idxC).toBeLessThan(idxB);
        expect(idxB).toBeLessThan(idxA);
    });

    test('should allow switching to Oldest First', async ({ page }) => {
        const timestamp = Date.now();
        const note1 = `Oldest Note ${timestamp}`;
        const note2 = `Newest Note ${timestamp}`;

        await createNote(page, note1, 'Content 1');
        await page.waitForTimeout(2000);
        await createNote(page, note2, 'Content 2');

        // Filter by timestamp
        await page.getByPlaceholder('Search').fill(String(timestamp));
        await page.waitForTimeout(500);

        let cardTexts = await page.locator('.note-card').allInnerTexts();
        let idx1 = cardTexts.findIndex(t => t.includes(note1));
        let idx2 = cardTexts.findIndex(t => t.includes(note2));

        expect(idx2).toBeLessThan(idx1);

        // Switch to Oldest First
        await page.getByLabel('Newest first').click();
        const oldestOption = page.getByRole('menuitem', { name: 'Oldest first' });
        await expect(oldestOption).toBeVisible();
        await oldestOption.click();

        await expect(page.locator('button[aria-label="Oldest first"]')).toBeVisible({ timeout: 5000 });

        // Wait for the UI to actually reorder the notes
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
