import { test, expect } from '@playwright/test';
import {
    login, logout, navigateTo, createChecklist,
    openNoteModal, closeNoteModal, getNoteCard, uniqueId
} from './helpers.js';

test.describe('Checklist Move Item', () => {

    test('should reorder checklist items via drag and drop', async ({ page, isMobile }) => {
        const checklistTitle = `DnD Checklist ${uniqueId()}`;
        const items = ['Item A', 'Item B', 'Item C', 'Item D', 'Item E'];

        // 1. Login
        await login(page);

        // 2. Create checklist with 5 items
        const noteCard = await createChecklist(page, checklistTitle, items);

        // 3. Open checklist modal
        await openNoteModal(page, noteCard);

        // Wait for items to load
        await page.waitForTimeout(500);

        // Get all checklist item handles - use Mantine modal selector
        const modal = page.locator('.mantine-Modal-content');
        const itemHandles = modal.locator('[data-rbd-draggable-id]');
        const initialCount = await itemHandles.count();
        expect(initialCount).toBe(5);

        // 4. Drag Item E (last, index 4) to position 2 (index 1)
        // Expected order after: A, E, B, C, D
        const itemE = itemHandles.nth(4);
        const itemB = itemHandles.nth(1);

        // Get bounding boxes for drag operation
        const sourceBox = await itemE.boundingBox();
        const targetBox = await itemB.boundingBox();

        if (sourceBox && targetBox) {
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
            await page.mouse.up();
        }

        await page.waitForTimeout(500);

        // Verify order: A, E, B, C, D
        const itemsAfterFirstMove = modal.locator('[data-rbd-draggable-id] input[type="text"]');
        await expect(itemsAfterFirstMove.nth(0)).toHaveValue('Item A');
        await expect(itemsAfterFirstMove.nth(1)).toHaveValue('Item E');
        await expect(itemsAfterFirstMove.nth(2)).toHaveValue('Item B');
        await expect(itemsAfterFirstMove.nth(3)).toHaveValue('Item C');
        await expect(itemsAfterFirstMove.nth(4)).toHaveValue('Item D');

        // 5. Drag Item E from position 2 (index 1) to position 1 (index 0)
        // Expected order after: E, A, B, C, D
        const newItemHandles = modal.locator('[data-rbd-draggable-id]');
        const itemENew = newItemHandles.nth(1);
        const itemANew = newItemHandles.nth(0);

        const sourceBox2 = await itemENew.boundingBox();
        const targetBox2 = await itemANew.boundingBox();

        if (sourceBox2 && targetBox2) {
            await page.mouse.move(sourceBox2.x + sourceBox2.width / 2, sourceBox2.y + sourceBox2.height / 2);
            await page.mouse.down();
            await page.mouse.move(targetBox2.x + targetBox2.width / 2, targetBox2.y - 10, { steps: 10 });
            await page.mouse.up();
        }

        await page.waitForTimeout(500);

        // Verify order: E, A, B, C, D
        const itemsAfterSecondMove = modal.locator('[data-rbd-draggable-id] input[type="text"]');
        await expect(itemsAfterSecondMove.nth(0)).toHaveValue('Item E');
        await expect(itemsAfterSecondMove.nth(1)).toHaveValue('Item A');
        await expect(itemsAfterSecondMove.nth(2)).toHaveValue('Item B');
        await expect(itemsAfterSecondMove.nth(3)).toHaveValue('Item C');
        await expect(itemsAfterSecondMove.nth(4)).toHaveValue('Item D');

        // Close modal
        await closeNoteModal(page);

        // 6. Cleanup
        await noteCard.hover();
        await noteCard.locator('[title="Move to trash"]').click();
        await navigateTo(page, isMobile, '/trash');
        const trashedCard = getNoteCard(page, checklistTitle);
        await expect(trashedCard).toBeVisible({ timeout: 10000 });
        await trashedCard.hover();
        await trashedCard.locator('[title="Delete forever"]').click();

        // 7. Logout
        await logout(page, isMobile);
    });
});
