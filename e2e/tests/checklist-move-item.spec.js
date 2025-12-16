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

        // Wait for modal to be fully visible
        const modal = page.locator('.mantine-Modal-content');
        await expect(modal).toBeVisible();

        // Wait for items to be loaded and visible
        const itemHandles = modal.locator('[data-testid="checklist-item"]');
        await expect(itemHandles.first()).toBeVisible({ timeout: 10000 });

        // Use data-testid selector for @dnd-kit
        const initialCount = await itemHandles.count();

        // Debug DOM structure
        // if (initialCount > 0) {
        //     const innerHTML = await itemHandles.first().innerHTML();
        // }

        expect(initialCount).toBe(5);

        // 4. Drag Item E (last, index 4) to position 2 (index 1)
        // Expected order after: A, E, B, C, D
        const itemE = itemHandles.nth(4);
        const itemB = itemHandles.nth(1);

        // Get the drag handle for item E
        const dragHandleE = itemE.locator('[data-testid="drag-handle"]');

        // Get bounding boxes for drag operation
        const sourceBox = await dragHandleE.boundingBox();
        const targetBox = await itemB.boundingBox();

        if (sourceBox && targetBox) {
            // Move to center of source element
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();

            // Critical for dnd-kit with distance constraint:
            // We need to move enough to trigger activation (8px constraint)
            // But doing it too fast might be missed by some sensors on mobile emulation
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 15, { steps: 10 });

            await page.waitForTimeout(400); // Wait for sensor activation state to settle

            // Perform the main drag
            await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 60 });
            await page.mouse.up();
        } else {
            console.error('Skipping drag - boxes not found');
        }

        await page.waitForTimeout(1000); // Wait for animation

        // Verify order: A, E, B, C, D
        const itemsAfterFirstMove = modal.locator('[data-testid="item-content"]');

        // Debug
        const contentCount = await itemsAfterFirstMove.count();
        const genericInputCount = await modal.locator('[data-testid="checklist-item"] input').count();

        // Debug actual order
        const actualValues = [];
        for (let i = 0; i < contentCount; i++) {
            actualValues.push(await itemsAfterFirstMove.nth(i).inputValue());
        }

        await expect(itemsAfterFirstMove.nth(0)).toHaveValue('Item A');
        await expect(itemsAfterFirstMove.nth(1)).toHaveValue('Item E');
        await expect(itemsAfterFirstMove.nth(2)).toHaveValue('Item B');
        await expect(itemsAfterFirstMove.nth(3)).toHaveValue('Item C');
        await expect(itemsAfterFirstMove.nth(4)).toHaveValue('Item D');

        // 5. Drag Item E from position 2 (index 1) to position 1 (index 0)
        // Expected order after: E, A, B, C, D
        const newItemHandles = modal.locator('[data-testid="checklist-item"]');
        const itemENew = newItemHandles.nth(1);
        const itemANew = newItemHandles.nth(0);

        const dragHandleENew = itemENew.locator('[data-testid="drag-handle"]');

        const sourceBox2 = await dragHandleENew.boundingBox();
        const targetBox2 = await itemANew.boundingBox();

        if (sourceBox2 && targetBox2) {
            await page.mouse.move(sourceBox2.x + sourceBox2.width / 2, sourceBox2.y + sourceBox2.height / 2);
            await page.mouse.down();

            // Initial move to trigger activation
            await page.mouse.move(sourceBox2.x + sourceBox2.width / 2, sourceBox2.y + sourceBox2.height / 2 + 15, { steps: 10 });
            await page.waitForTimeout(400);

            await page.mouse.move(targetBox2.x + targetBox2.width / 2, targetBox2.y - 10, { steps: 25 });
            await page.mouse.up();
        }

        await page.waitForTimeout(500);

        // Verify order: E, A, B, C, D
        const itemsAfterSecondMove = modal.locator('[data-testid="item-content"]');
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
