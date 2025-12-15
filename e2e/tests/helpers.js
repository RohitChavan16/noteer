import { expect } from '@playwright/test';

/**
 * Test credentials
 */
export const TEST_CREDENTIALS = {
    email: 'admin@test.com',
    password: 'test123'
};

/**
 * Login with test credentials
 * @param {import('@playwright/test').Page} page
 */
export async function login(page) {
    await page.goto('/');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Take a note...')).toBeVisible({ timeout: 10000 });
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
    // Use force click to handle mobile viewport issues
    await logoutBtn.click({ force: true });
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 5000 });
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
        await page.locator('a[href="/"]').first().click();
    } else {
        await page.locator(`a[href="${path}"]`).click();
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
    await page.fill('textarea[placeholder="Take a note..."]', content);
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
    await page.locator('[title="Checklist"]').click();
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
