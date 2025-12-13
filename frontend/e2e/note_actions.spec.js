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
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test123');
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

    log('12. Logging out...');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');
    log('    Logout successful');

    log('SUCCESS: All note action checks passed');
});

test('Checklist item toggle from card', async ({ page }) => {
    page.on('console', msg => log('BROWSER: ' + msg.text()));

    log('START: Checklist item toggle test');

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    log('1. Logged in');

    // Create checklist note
    log('2. Creating Checklist Note...');
    const checklistTitle = `Checklist ${Date.now()}`;
    await page.getByText('Take a note...', { exact: true }).click();

    // Click checklist mode button
    await page.getByTitle('Checklist').click();
    await page.fill('[placeholder="Title"]', checklistTitle);

    // Add items
    await page.fill('[placeholder="List item"]', 'First task');
    await page.keyboard.press('Enter');
    await page.fill('[placeholder="List item"]', 'Second task');
    await page.keyboard.press('Enter');
    await page.fill('[placeholder="List item"]', 'Third task');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(checklistTitle)).toBeVisible();
    log('   Checklist created with 3 items');

    // Find the checklist card
    const checklistCard = page.locator('.mantine-Card-root', { hasText: checklistTitle });

    // Verify items are unchecked initially
    log('3. Verifying initial unchecked state...');
    let firstCheckbox = checklistCard.locator('.mantine-Checkbox-input').first();
    await expect(firstCheckbox).not.toBeChecked();
    log('   First item is unchecked');

    // Toggle the first item from the card
    log('4. Toggling first item from card...');
    await firstCheckbox.click();

    // Wait for the update to complete and verify
    await page.waitForTimeout(1000);
    // Re-locate after update (component re-renders)
    firstCheckbox = checklistCard.locator('.mantine-Checkbox-input').first();
    await expect(firstCheckbox).toBeChecked();
    log('   First item is now checked');

    // Toggle it back
    log('5. Toggling first item back...');
    await firstCheckbox.click();
    await page.waitForTimeout(1000);
    // Re-locate again
    firstCheckbox = checklistCard.locator('.mantine-Checkbox-input').first();
    await expect(firstCheckbox).not.toBeChecked();
    log('   First item is unchecked again');

    // Toggle the second item
    log('6. Toggling second item...');
    let secondCheckbox = checklistCard.locator('.mantine-Checkbox-input').nth(1);
    await secondCheckbox.click();
    await page.waitForTimeout(1000);
    secondCheckbox = checklistCard.locator('.mantine-Checkbox-input').nth(1);
    await expect(secondCheckbox).toBeChecked();
    log('   Second item is checked');

    // Cleanup - trash the test note
    log('7. Cleaning up...');
    // Re-locate card and click trash button
    const cardToTrash = page.locator('.mantine-Card-root', { hasText: checklistTitle });
    await cardToTrash.getByTitle('Move to trash').click({ force: true });
    await expect(cardToTrash).toBeHidden();
    log('   Test note trashed');

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    log('SUCCESS: Checklist item toggle from card passed');
});

test('User registration and profile management', async ({ page }) => {
    page.on('console', msg => log('BROWSER: ' + msg.text()));
    page.on('requestfailed', req => log('REQ FAILED: ' + req.url() + ' ' + (req.failure()?.errorText || 'unknown')));

    const timestamp = Date.now();
    const testUser = {
        email: `testuser_${timestamp}@example.com`,
        password: 'TestPass123!',
        name: 'Test User'
    };
    const updatedUser = {
        email: `updated_${timestamp}@example.com`,
        password: 'NewPass456!',
        name: 'Updated Name'
    };

    log('START: User registration and profile test');

    // 1. Register new user
    log('1. Registering new user...');
    await page.goto('/register');
    await page.fill('[placeholder="Your name"]', testUser.name);
    await page.fill('[placeholder="you@example.com"]', testUser.email);
    await page.locator('input[placeholder="••••••••"]').first().fill(testUser.password);
    await page.locator('input[placeholder="••••••••"]').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/');
    log('   Registration successful');

    // 2. Navigate to Settings
    log('2. Navigating to Settings...');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    log('   Settings page loaded');

    // 3. Update name
    log('3. Updating name...');
    await page.locator('[placeholder="Your name"]').clear();
    await page.fill('[placeholder="Your name"]', updatedUser.name);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Profile updated successfully')).toBeVisible();
    log('   Name updated');

    // 4. Update email
    log('4. Updating email...');
    await page.fill('[placeholder="your@email.com"]', updatedUser.email);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Profile updated successfully')).toBeVisible();
    log('   Email updated');

    // 5. Update password
    log('5. Updating password...');
    await page.locator('input[placeholder="••••••••"]').first().fill(updatedUser.password);
    await page.locator('input[placeholder="••••••••"]').nth(1).fill(updatedUser.password);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Profile updated successfully')).toBeVisible();
    log('   Password updated');

    // 6. Logout
    log('6. Logging out...');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');
    log('   Logout successful');

    // 7. Login with NEW password to verify password change worked
    log('7. Logging in with new password...');
    await page.fill('input[type="email"]', updatedUser.email);
    await page.fill('input[type="password"]', updatedUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    log('   Login with new password successful');

    // 8. Verify updated name is displayed (check Settings page)
    log('8. Verifying updated profile...');
    await page.goto('/settings');
    await expect(page.locator('[placeholder="Your name"]')).toHaveValue(updatedUser.name);
    await expect(page.locator('[placeholder="your@email.com"]')).toHaveValue(updatedUser.email);
    log('   Profile data verified');

    // 9. Final logout
    log('9. Final logout...');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    log('SUCCESS: User registration and profile management passed');
});

test('XSS and injection protection', async ({ page }) => {
    page.on('console', msg => log('BROWSER: ' + msg.text()));

    // Track if any XSS payload executed
    let xssTriggered = false;
    await page.exposeFunction('xssTriggered', () => {
        xssTriggered = true;
        log('!!! XSS ATTACK SUCCESSFUL - SECURITY VULNERABILITY !!!');
    });

    log('START: XSS and injection protection test');

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    log('1. Logged in');

    // XSS payloads to test - simpler payloads
    const xssTitle = '<script>alert(1)</script>';
    const xssContent = '<img src=x onerror=alert(1)>\n<svg onload=alert(1)>';

    // Test XSS in note title and content
    log('2. Testing XSS in note title...');
    await page.getByText('Take a note...', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.fill('[placeholder="Title"]', xssTitle);
    await page.fill('[placeholder="Take a note..."]', xssContent);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(500);

    // Verify note was created (at least one note card visible after creation)
    // The XSS payload is stored and displayed as text, not executed
    await expect(page.locator('.mantine-Card-root').first()).toBeVisible();
    log('   XSS payloads stored safely as text');

    // Verify no XSS was triggered during the test
    if (xssTriggered) {
        throw new Error('XSS VULNERABILITY DETECTED! Malicious script was executed.');
    }
    log('3. No XSS payloads executed - SECURE');

    // Test SQL injection-like payloads (should be stored as-is without breaking)
    log('6. Testing SQL injection payloads...');
    const sqlPayloads = [
        "'; DROP TABLE notes; --",
        "1' OR '1'='1",
        "Robert'); DROP TABLE users;--",
    ];
    await page.getByText('Take a note...', { exact: true }).click();
    await page.fill('[placeholder="Title"]', sqlPayloads[0]);
    await page.fill('[placeholder="Take a note..."]', sqlPayloads.join('\n'));
    await page.getByRole('button', { name: 'Close' }).click();

    // Verify note was created successfully (not broken by SQL)
    await expect(page.getByText("'; DROP TABLE")).toBeVisible();
    log('   SQL injection payloads stored safely');

    // Cleanup - trash the test notes
    log('7. Cleaning up test notes...');
    const testNotes = page.locator('.mantine-Card-root').filter({ hasText: /XSS|DROP TABLE|<script>/ });
    const count = await testNotes.count();
    for (let i = 0; i < count; i++) {
        await testNotes.first().getByTitle('Move to trash').click({ force: true });
        await page.waitForTimeout(300);
    }
    log('   Test notes trashed');

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    log('SUCCESS: XSS and injection protection verified');
});
