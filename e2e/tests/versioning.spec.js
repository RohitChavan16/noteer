import { test, expect } from '@playwright/test';

test.describe('Note Versioning', () => {
    test('should create versions and restore them', async ({ page }) => {
        // Login
        await page.goto('http://localhost:3000');
        await page.fill('input[type="email"]', 'admin@test.com');
        await page.fill('input[type="password"]', 'test123');
        await page.click('button:has-text("Sign in")');
        await expect(page.locator('text=Take a note...')).toBeVisible();

        const timestamp = Date.now();
        const noteTitle = `Version Test Note ${timestamp}`;

        // Create a test note
        await page.click('text=Take a note...');
        await page.fill('input[placeholder="Title"]', noteTitle);
        await page.fill('textarea[placeholder="Take a note..."]', 'Initial Content');
        await page.click('button:has-text("Close")');

        // Find our specific note card
        const noteCard = page.locator('.note-card').filter({ hasText: noteTitle }).first();
        await expect(noteCard).toBeVisible();

        // 1. Edit note to create Version 2
        await noteCard.click();
        await page.fill('textarea', 'Second Content');
        await page.click('button:has-text("Close")');
        await expect(noteCard).toContainText('Second Content');

        // 2. Edit note to create Version 3
        page.once('dialog', dialog => dialog.accept());

        await restoreBtn.click();

        // 7. Verify modal closes and content is updated
        await expect(page.locator('text=Version History')).not.toBeVisible();
        await expect(noteCard).toContainText('Initial Content');

        // Cleanup
        await noteCard.hover();
        await menuBtn.click();
        await page.getByRole('menuitem', { name: 'Delete forever' }).click();
    });
});
