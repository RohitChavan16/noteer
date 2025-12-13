import { test, expect } from '@playwright/test';
import fs from 'fs';

const log = (msg) => {
    try { fs.appendFileSync('debug_log.txt', msg + '\n'); } catch (e) { }
};

test('Note actions: Pin, Archive, Trash', async ({ page }) => {
    page.on('console', msg => log('BROWSER: ' + msg.text()));
    page.on('requestfailed', req => log('REQ FAILED: ' + req.url() + ' ' + (req.failure()?.errorText || 'unknown')));
    page.on('requestfinished', async req => {
        const res = await req.response();
        log('REQ: ' + req.method() + ' ' + req.url() + ' ' + (res ? res.status() : 'ERR'));
    });

    log('START: Note actions test');
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'changeme');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    log('1. Login successful');

    log('2. Creating Note...');
    const noteTitle = `Test Note ${Date.now()}`;
    await page.getByText('Take a note...', { exact: true }).click();
    await page.fill('[placeholder="Title"]', noteTitle);
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByText(noteTitle)).toBeVisible();
    log('   Note created');

    const noteCard = page.locator('.mantine-Card-root', { hasText: noteTitle });

    log('3. Pinning Note...');
    // Use force: true just in case
    await noteCard.getByTitle('Pin').click({ force: true });
    await expect(noteCard.getByTitle('Unpin')).toBeVisible();
    log('   Note pinned');

    log('4. Archiving Note...');
    await noteCard.getByTitle('Archive').click({ force: true });
    await expect(noteCard).toBeHidden();
    log('   Note archived');

    log('5. Verifying Archive Page...');
    await page.goto('/archive');
    await expect(page.getByText(noteTitle)).toBeVisible();
    log('   Found in archive');

    log('6. Unarchiving Note...');
    const archivedCard = page.locator('.mantine-Card-root', { hasText: noteTitle });
    await archivedCard.getByTitle('Unarchive').click({ force: true });
    await expect(archivedCard).toBeHidden();
    log('   Unarchived');

    log('7. Verifying Dashboard...');
    await page.goto('/');
    await expect(page.getByText(noteTitle)).toBeVisible();
    log('   Back in dashboard');

    log('8. Trashing Note...');
    await page.locator('.mantine-Card-root', { hasText: noteTitle }).getByTitle('Move to trash').click({ force: true });
    await expect(page.getByText(noteTitle)).toBeHidden();
    log('   Note trashed');

    log('9. Verifying Trash Page...');
    await page.goto('/trash');
    await expect(page.getByText(noteTitle)).toBeVisible();
    log('    Found in Trash');

    log('10. Restoring Note...');
    const trashCard = page.locator('.mantine-Card-root', { hasText: noteTitle });
    await trashCard.getByTitle('Restore').click({ force: true });
    await expect(trashCard).toBeHidden();
    log('    Note restored');

    log('11. Deleting Forever...');
    await page.goto('/');
    await page.locator('.mantine-Card-root', { hasText: noteTitle }).getByTitle('Move to trash').click({ force: true });
    await page.goto('/trash');
    const deleteBtn = page.locator('.mantine-Card-root', { hasText: noteTitle }).getByTitle('Delete forever');
    await deleteBtn.click({ force: true });
    await expect(page.getByText(noteTitle)).toBeHidden();

    log('SUCCESS: All checks passed');
});
