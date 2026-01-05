import { expect } from '@playwright/test';

/**
 * Test credentials
 */
export const TEST_CREDENTIALS = {
    email: 'admin@test.com',
    password: 'test123'
};

/**
 * Test mnemonic for E2E tests (BIP-39 standard test phrase)
 * Use this exact phrase when setting up admin user encryption after volume wipe.
 */
export const TEST_MNEMONIC = 'vessel erase embark marriage detail torch equip uniform better replace pride family lion special scrap mechanic pact test axis gloom short cement giggle gap';

/**
 * Setup console and page error logging for debugging
 */
export function setupPageConsoleDebug(page) {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    page.on('request', request => console.log('>>', request.method(), request.url()));
    page.on('response', response => console.log('<<', response.status(), response.url()));
    page.on('requestfailed', request => console.log('!!', request.failure().errorText, request.url()));
}

/**
 * Login with test credentials
 * @param {import('@playwright/test').Page} page
 * @param {string} mnemonic - Optional mnemonic for encryption unlock (defaults to TEST_MNEMONIC)
 */
export async function login(page, mnemonic = TEST_MNEMONIC) {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[type="password"]').fill(TEST_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Check if unlock modal appears (returning user with encryption)
    const unlockModal = page.getByRole('heading', { name: 'Unlock Notes' }).first();
    const isUnlockVisible = await unlockModal.isVisible().catch(() => false);

    // Wait a bit for modal to potentially appear
    if (!isUnlockVisible) {
        await page.waitForTimeout(1000);
    }

    const isUnlockNowVisible = await unlockModal.isVisible().catch(() => false);

    if (isUnlockNowVisible || await unlockModal.isVisible().catch(() => false)) {
        await expect(unlockModal).toBeVisible({ timeout: 10000 });

        // Fill all inputs individually
        const inputs = page.locator('.mantine-Autocomplete-input');
        const words = mnemonic.split(' ');
        for (let i = 0; i < words.length; i++) {
            await inputs.nth(i).fill(words[i]);
        }

        const unlockBtn = page.getByRole('button', { name: 'Unlock' });
        await expect(unlockBtn).toBeEnabled();
        await unlockBtn.click({ force: true });
    } else {
        // Handle new user setup if no unlock modal
        await handleEncryptionSetup(page);
    }

    await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });
}

/**
 * Handle Encryption Setup modal for new users
 * @param {import('@playwright/test').Page} page
 */
export async function handleEncryptionSetup(page) {
    // Check if setup modal appears (new user)
    // Try role first, then text content if role fails (sometimes Mantine modals are tricky)
    const setupModal = page.getByRole('heading', { name: 'Encryption Setup' });
    let isSetupVisible = await setupModal.isVisible({ timeout: 15000 }).catch(() => false);

    if (!isSetupVisible) {
        isSetupVisible = await page.getByText('Encryption Setup').first().isVisible({ timeout: 3000 }).catch(() => false);
    }

    if (isSetupVisible) {
        // Capture the mnemonic words
        // Target the second Text element in each Group within the SimpleGrid
        const wordElements = page.locator('.mantine-Modal-body .mantine-SimpleGrid-root .mantine-Group-root > .mantine-Text-root:last-child');
        await expect(wordElements).toHaveCount(24, { timeout: 5000 });

        const words = await wordElements.allInnerTexts();
        const mnemonic = words.join(' ');

        // Complete setup flow
        await page.getByText('I have written down all 24 words').click();
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText('Encryption is active')).toBeVisible({ timeout: 30000 });
        await page.getByRole('button', { name: 'Start using Noteer' }).click();

        return mnemonic;
    }
    return null;
}

/**
 * Logout from the application
 * @param {import('@playwright/test').Page} page
 * @param {boolean} isMobile - Is mobile viewport
 */
export async function logout(page, isMobile) {
    if (isMobile) {
        // Open sidebar on mobile using Mantine Burger button
        // Try multiple selector patterns for the burger menu
        const burger = page.locator('[class*="mantine-Burger"]').first();
        const isBurgerVisible = await burger.isVisible().catch(() => false);
        if (isBurgerVisible) {
            await burger.click();
            // Wait for sidebar animation to complete
            await page.waitForTimeout(500);
        }
    }

    // Find logout button and scroll it into view
    const logoutBtn = page.locator('[title="Logout"]');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.scrollIntoViewIfNeeded();
    // Use force click to handle mobile viewport issues, with fallback to dispatchEvent
    try {
        await logoutBtn.click({ force: true, timeout: 3000 });
    } catch (error) {
        console.log(`Click failed: ${error.message}. Retrying with dispatchEvent...`);
        await logoutBtn.dispatchEvent('click');
        // Wait a bit for the navigation to start
        await page.waitForTimeout(500);
    }
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to a page (handles mobile sidebar)
 * @param {import('@playwright/test').Page} page
 * @param {boolean} isMobile
 * @param {string} path - Path like '/archive', '/trash', '/'
 */
export async function navigateTo(page, isMobile, path) {
    if (isMobile) {
        // Open sidebar on mobile using Mantine Burger
        const burger = page.locator('[class*="mantine-Burger"]').first();
        const isBurgerVisible = await burger.isVisible().catch(() => false);
        if (isBurgerVisible) {
            await burger.click();
            await page.waitForTimeout(300);
        }
    }

    // Use the NavLink with matching href
    if (path === '/') {
        await page.locator('a[href="/"]').first().click({ force: true });
    } else {
        await page.locator(`a[href="${path}"]`).click({ force: true });
    }
    // Wait for page to fully load including network requests
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
}

/**
 * Create a note
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @param {string} content
 * @returns {Promise<import('@playwright/test').Locator>} Note card locator
 */
export async function createNote(page, title, content) {
    await page.click('text=Take a note...');
    await page.fill('input[placeholder="Title"]', title);

    // The content area is a TipTap RichTextEditor (ProseMirror), not a textarea
    // We need to click into it and type
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type(content);

    await page.click('button:has-text("Close")');

    const noteCard = page.locator('.note-card').filter({ hasText: title }).first();
    await expect(noteCard).toBeVisible({ timeout: 5000 });
    return noteCard;
}

/**
 * Create a checklist
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @param {string[]} items
 * @returns {Promise<import('@playwright/test').Locator>} Note card locator
 */
export async function createChecklist(page, title, items) {
    await page.click('text=Take a note...');
    // The checklist button has title="New list" in the expanded note input
    await page.locator('[title="New list"]').click();
    await page.fill('input[placeholder="Title"]', title);

    for (const item of items) {
        await page.fill('input[placeholder="List item"]', item);
        await page.keyboard.press('Enter');
    }

    await page.click('button:has-text("Close")');

    const noteCard = page.locator('.note-card').filter({ hasText: title }).first();
    await expect(noteCard).toBeVisible({ timeout: 5000 });
    return noteCard;
}

/**
 * Open note modal by clicking on note card
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} noteCard
 */
export async function openNoteModal(page, noteCard) {
    // Ensure card is visible and ready
    await expect(noteCard).toBeVisible({ timeout: 10000 });
    // Scroll into view to ensure it's clickable
    await noteCard.scrollIntoViewIfNeeded();
    // Wait a moment for any animations
    await page.waitForTimeout(300);
    // Click with force to bypass any overlay issues
    await noteCard.click({ force: true });
    await expect(page.locator('.mantine-Modal-content')).toBeVisible({ timeout: 10000 });
}

/**
 * Close note modal
 * @param {import('@playwright/test').Page} page
 */
export async function closeNoteModal(page) {
    await page.locator('.mantine-Modal-content button:has-text("Close")').click();
    await expect(page.locator('.mantine-Modal-content')).not.toBeVisible({ timeout: 5000 });
}

/**
 * Get note card by title
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @returns {import('@playwright/test').Locator}
 */
export function getNoteCard(page, title) {
    return page.locator('.note-card').filter({ hasText: title }).first();
}

/**
 * Delete note permanently (cleanup helper)
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} noteCard
 * @param {boolean} isMobile
 */
export async function deleteNotePermanently(page, noteCard, isMobile) {
    // Move to trash first
    await noteCard.hover();
    await noteCard.locator('[title="Move to trash"]').click();
    await expect(noteCard).not.toBeVisible({ timeout: 3000 });

    // Go to trash
    await navigateTo(page, isMobile, '/trash');

    // Delete forever
    const trashedCard = page.locator('.note-card').first();
    await trashedCard.hover();
    await trashedCard.locator('[title="Delete forever"]').click();
    await expect(trashedCard).not.toBeVisible({ timeout: 3000 });

    // Return to notes
    await navigateTo(page, isMobile, '/');
}

/**
 * Generate unique test ID
 * @returns {string}
 */
export function uniqueId() {
    return Date.now().toString();
}
