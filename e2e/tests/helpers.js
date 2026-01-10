import { expect } from '@playwright/test';

/**
 * Generate unique test credentials for isolated test runs
 * @returns {{ email: string, password: string, firstName: string, lastName: string }}
 */
export function generateTestCredentials() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return {
        email: `test-${timestamp}-${random}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: `User${timestamp}`
    };
}

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
 * Register a new user and complete encryption setup
 * Returns credentials and mnemonic for later use
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ email: string, password: string, mnemonic: string }>}
 */
export async function registerAndSetupUser(page) {
    const credentials = generateTestCredentials();

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({ timeout: 15000 });

    // Fill registration form
    await page.locator('input[placeholder="John"]').fill(credentials.firstName);
    await page.locator('input[placeholder="Doe"]').fill(credentials.lastName);
    await page.locator('input[type="email"]').fill(credentials.email);
    await page.locator('input[type="password"]').first().fill(credentials.password);
    await page.locator('input[type="password"]').nth(1).fill(credentials.password);

    // Submit registration
    await page.getByRole('button', { name: 'Create account' }).click();

    // Handle encryption setup and capture mnemonic
    const mnemonic = await handleEncryptionSetup(page);

    // Wait for dashboard to be ready
    await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });

    return {
        email: credentials.email,
        password: credentials.password,
        mnemonic: mnemonic || ''
    };
}

/**
 * Login with specific credentials
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, mnemonic: string }} credentials
 */
export async function loginWithCredentials(page, credentials) {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(credentials.email);
    await page.locator('input[type="password"]').fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Check if unlock modal appears (returning user with encryption)
    const unlockModal = page.getByRole('heading', { name: 'Unlock Notes' }).first();

    // Wait a bit for modal to potentially appear
    await page.waitForTimeout(1000);

    if (await unlockModal.isVisible().catch(() => false)) {
        await expect(unlockModal).toBeVisible({ timeout: 10000 });

        // Fill all mnemonic inputs
        const inputs = page.locator('.mantine-Autocomplete-input');
        const words = credentials.mnemonic.split(' ');

        // Ensure all inputs are rendered
        await expect(inputs).toHaveCount(words.length, { timeout: 10000 });

        for (let i = 0; i < words.length; i++) {
            await inputs.nth(i).fill(words[i]);
        }

        const unlockBtn = page.getByRole('button', { name: 'Unlock' });
        await expect(unlockBtn).toBeEnabled();
        await unlockBtn.click({ force: true });
    }

    await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 15000 });
}

/**
 * Handle Encryption Setup modal for new users
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string|null>} The captured mnemonic phrase
 */
export async function handleEncryptionSetup(page) {
    // Wait for encryption setup modal to appear
    const setupModal = page.getByRole('heading', { name: 'Encryption Setup' }).first();

    try {
        await expect(setupModal).toBeVisible({ timeout: 15000 });
    } catch (e) {
        // Modal didn't appear, user might already be set up
        return null;
    }

    // Capture the mnemonic words using the proven selector pattern
    const wordGroups = page.locator('.mantine-SimpleGrid-root .mantine-Group-root');
    await expect(wordGroups).toHaveCount(24, { timeout: 10000 });

    const count = await wordGroups.count();
    const words = [];
    for (let i = 0; i < count; i++) {
        const text = await wordGroups.nth(i).locator('.mantine-Text-root').last().textContent();
        if (text) words.push(text.trim());
    }
    const mnemonic = words.join(' ');
    console.log(`Saved mnemonic with ${words.length} words`);

    // Complete setup flow
    await page.getByText('I have written down all 24 words').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Encryption is active')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Start using Noteer' }).click();

    return mnemonic;
}

/**
 * Logout from the application
 * @param {import('@playwright/test').Page} page
 * @param {boolean} isMobile - Is mobile viewport
 */
export async function logout(page, isMobile) {
    if (isMobile) {
        const burger = page.locator('[class*="mantine-Burger"]').first();
        const isBurgerVisible = await burger.isVisible().catch(() => false);
        if (isBurgerVisible) {
            await burger.click();
            await page.waitForTimeout(500);
        }
    }

    const logoutBtn = page.locator('[title="Logout"]');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.scrollIntoViewIfNeeded();
    try {
        await logoutBtn.click({ force: true, timeout: 3000 });
    } catch (error) {
        console.log(`Click failed: ${error.message}. Retrying with dispatchEvent...`);
        await logoutBtn.dispatchEvent('click');
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
        const burger = page.locator('[class*="mantine-Burger"]').first();
        const isBurgerVisible = await burger.isVisible().catch(() => false);
        if (isBurgerVisible) {
            await burger.click();
            await page.waitForTimeout(300);
        }
    }

    if (path === '/') {
        await page.locator('a[href="/"]').first().click({ force: true });
    } else {
        await page.locator(`a[href="${path}"]`).click({ force: true });
    }
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

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type(content);

    await page.click('button:has-text("Close")');
    await expect(page.locator('.mantine-Modal-content')).not.toBeVisible({ timeout: 5000 });

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
    await expect(noteCard).toBeVisible({ timeout: 10000 });

    try {
        await noteCard.scrollIntoViewIfNeeded();
    } catch (error) {
        await page.waitForTimeout(500);
        await expect(noteCard).toBeVisible({ timeout: 5000 });
        await noteCard.scrollIntoViewIfNeeded();
    }

    await page.waitForTimeout(300);

    // Try clicking on the title paragraph first (for regular notes)
    const titleParagraph = noteCard.locator('p').first();
    const hasParagraph = await titleParagraph.count() > 0;

    if (hasParagraph) {
        try {
            await titleParagraph.click({ timeout: 3000 });
        } catch (error) {
            // Fall through to card click
        }
    }

    // Check if modal opened
    const modalVisible = await page.locator('.mantine-Modal-content').isVisible().catch(() => false);

    if (!modalVisible) {
        // Try clicking directly on the card
        await noteCard.click({ force: true });
        await page.waitForTimeout(500);
    }

    // Final check for modal
    const stillNotVisible = await page.locator('.mantine-Modal-content').isVisible().catch(() => false);

    if (!stillNotVisible) {
        // Last resort: double click
        await noteCard.dblclick({ force: true });
    }

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
    await noteCard.hover();
    await noteCard.locator('[title="Move to trash"]').click();
    await expect(noteCard).not.toBeVisible({ timeout: 3000 });

    await navigateTo(page, isMobile, '/trash');

    const trashedCard = page.locator('.note-card').first();
    await trashedCard.hover();
    await trashedCard.locator('[title="Delete forever"]').click();
    await expect(trashedCard).not.toBeVisible({ timeout: 3000 });

    await navigateTo(page, isMobile, '/');
}

/**
 * Generate unique test ID
 * @returns {string}
 */
export function uniqueId() {
    return Date.now().toString();
}
