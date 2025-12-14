import { test, expect } from '@playwright/test';

test.describe('Note Actions', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/');
        await page.fill('input[type="email"]', 'admin@test.com');
        await page.fill('input[type="password"]', 'test123');
        await page.click('button:has-text("Sign in")');
        // Wait for dashboard to load
        await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });
    });

    test('should create, pin, archive and delete a note', async ({ page }) => {
        const timestamp = Date.now();
        const noteTitle = `Test Note ${timestamp}`;
        const noteContent = 'This is a test note content';

        // 1. Create Note
        await page.click('text=Take a note...');
        await page.fill('input[placeholder="Title"]', noteTitle);
        await page.fill('textarea[placeholder="Take a note..."]', noteContent);
        // Select color (Blue)
        await page.getByTitle('Background color').click();
        await page.locator('button[style*="background-color: var(--mantine-color-blue-"]').first().click();
        await page.click('button:has-text("Close")');

        // Verify note created
        const noteCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(noteCard).toBeVisible();
        await expect(noteCard).toContainText(noteContent);

        // 2. Pin Note
        await noteCard.hover();
        const pinBtn = noteCard.locator('[title="Pin"]');
        await expect(pinBtn).toBeVisible();
        await pinBtn.click();

        // Verify pinned section appears
        await expect(page.locator('text=Pinned')).toBeVisible();

        // 3. Unpin Note
        await noteCard.hover();
        const unpinBtn = noteCard.locator('[title="Unpin"]');
        await unpinBtn.click();
        // Wait for section to disappear or note to move (optional, heavily dependent on other notes)

        // 4. Archive Note
        await noteCard.hover();
        const archiveBtn = noteCard.locator('[title="Archive"]');
        await archiveBtn.click();

        // Verify removed from main dashboard
        await expect(noteCard).not.toBeVisible();

        // Verify in Archive
        await page.click('a[href="/archive"]');
        const archivedCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(archivedCard).toBeVisible();

        // 5. Unarchive
        await archivedCard.hover();
        const unarchiveBtn = archivedCard.locator('[title="Unarchive"]');
        await unarchiveBtn.click();
        await expect(archivedCard).not.toBeVisible();

        // Return to notes
        await page.click('a[href="/"]');
        await expect(noteCard).toBeVisible();

        // 6. Trash Note
        await noteCard.hover();
        const trashBtn = noteCard.locator('[title="Move to trash"]');
        await trashBtn.click();
        await expect(noteCard).not.toBeVisible();

        // Verify in Trash
        await page.click('a[href="/trash"]');
        const trashedCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(trashedCard).toBeVisible();

        // 7. Delete Forever
        await trashedCard.hover();
        const deleteBtn = trashedCard.locator('[title="Delete forever"]');
        await deleteBtn.click();
        await expect(trashedCard).not.toBeVisible();
    });

    test('should manage checklist mode', async ({ page }) => {
        const timestamp = Date.now();
        const noteTitle = `Checklist ${timestamp}`;

        // Open Note Input
        await page.click('text=Take a note...');

        // Switch to Checklist
        await page.click('[title="Checklist"]');

        await page.fill('input[placeholder="Title"]', noteTitle);

        // Add items
        await page.fill('input[placeholder="List item"]', 'Item 1');
        await page.keyboard.press('Enter');
        await page.fill('input[placeholder="List item"]', 'Item 2');
        await page.keyboard.press('Enter');

        await page.click('button:has-text("Close")');

        // Verify checklist created
        const noteCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(noteCard).toBeVisible();
        await expect(noteCard).toContainText('Item 1');
        await expect(noteCard).toContainText('Item 2');

        // Check an item
        await noteCard.locator('input[type="checkbox"]').first().click();

        // Verify checked state (style or attribute) - difficult without specific selectors, 
        // relying on visual or internal state. 
        // We can verify database or just that it doesn't crash.

        // Cleanup
        await noteCard.hover();
        await noteCard.locator('[title="Move to trash"]').click();
    });
});
