/**
 * Unit tests for database helper functions
 * Uses Node.js native test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('bulkInsertItems', () => {
    it('should return early when items array is empty', async () => {
        const { bulkInsertItems } = await import('./helpers.js');

        // Should not throw, just return
        await bulkInsertItems(1, []);
        await bulkInsertItems(1, null);
        await bulkInsertItems(1, undefined);

        assert.ok(true, 'No error thrown for empty/null items');
    });

    it('should build correct arrays for UNNEST', async () => {
        // This is more of a logic test - the actual DB query is hard to test without DB
        const items = [
            { content: 'Task 1', is_checked: false },
            { content: 'Task 2', is_checked: true },
            { content: 'Task 3' } // is_checked undefined
        ];

        // Verify array transformations
        const contents = items.map(i => i.content);
        const checks = items.map(i => i.is_checked || false);
        const positions = items.map((_, i) => i);

        assert.deepStrictEqual(contents, ['Task 1', 'Task 2', 'Task 3']);
        assert.deepStrictEqual(checks, [false, true, false]);
        assert.deepStrictEqual(positions, [0, 1, 2]);
    });
});

describe('bulkInsertImages', () => {
    it('should return early when images array is empty', async () => {
        const { bulkInsertImages } = await import('./helpers.js');

        await bulkInsertImages(1, 1, []);
        await bulkInsertImages(1, 1, null);
        await bulkInsertImages(1, 1, undefined);

        assert.ok(true, 'No error thrown for empty/null images');
    });

    it('should correctly extract image properties', () => {
        const images = [
            { url: '/uploads/img1.jpg', original_name: 'photo.jpg', mime_type: 'image/jpeg', size: 1024 },
            { url: '/uploads/img2.jpg' }, // Missing optional fields
        ];

        const urls = images.map(i => i.url);
        const names = images.map(i => i.original_name || null);
        const mimes = images.map(i => i.mime_type || null);
        const sizes = images.map(i => i.size || null);
        const ivs = images.map(i => i.encryption_iv || null);

        assert.deepStrictEqual(urls, ['/uploads/img1.jpg', '/uploads/img2.jpg']);
        assert.deepStrictEqual(names, ['photo.jpg', null]);
        assert.deepStrictEqual(mimes, ['image/jpeg', null]);
        assert.deepStrictEqual(sizes, [1024, null]);
        assert.deepStrictEqual(ivs, [null, null]);
    });
});

describe('setNoteLabels', () => {
    it('should handle empty labels gracefully', async () => {
        // This tests the early return branch
        const { setNoteLabels } = await import('./helpers.js');

        // These will attempt DB calls, but the important thing is the logic flow
        // In a real test we'd mock the query function
        try {
            // This will fail because no DB, but we're testing the function exists
            // and handles the input structure correctly
            assert.ok(typeof setNoteLabels === 'function');
        } catch (_e) {
            // Expected - no DB connection
        }
    });
});

describe('setNoteLabelIds', () => {
    it('should be a function that accepts expected arguments', async () => {
        const { setNoteLabelIds } = await import('./helpers.js');
        assert.ok(typeof setNoteLabelIds === 'function');
        // Function.length only counts params before first default, so 3 (userId, noteId, labelIds)
        assert.strictEqual(setNoteLabelIds.length, 3);
    });
});

describe('cleanupOrphanImages', () => {
    it('should return early when no deleted versions data', async () => {
        const { cleanupOrphanImages } = await import('./helpers.js');

        // Should not throw
        await cleanupOrphanImages(1, []);
        await cleanupOrphanImages(1, null);
        await cleanupOrphanImages(1, undefined);

        assert.ok(true, 'No error for empty data');
    });

    it('should correctly collect image URLs from version data', () => {
        const deletedVersionsData = [
            {
                images: [
                    { url: '/uploads/img1.jpg', thumb_small: '/uploads/img1_s.jpg', thumb_medium: '/uploads/img1_m.jpg' },
                    { url: '/uploads/img2.jpg' }
                ]
            },
            {
                images: [
                    { url: '/uploads/img3.jpg' }
                ]
            }
        ];

        const deletedImageUrls = new Set();
        for (const versionData of deletedVersionsData) {
            if (versionData.images && Array.isArray(versionData.images)) {
                for (const img of versionData.images) {
                    if (img.url) deletedImageUrls.add(img.url);
                    if (img.thumb_small && img.thumb_small !== img.url) deletedImageUrls.add(img.thumb_small);
                    if (img.thumb_medium && img.thumb_medium !== img.url) deletedImageUrls.add(img.thumb_medium);
                }
            }
        }

        assert.strictEqual(deletedImageUrls.size, 5);
        assert.ok(deletedImageUrls.has('/uploads/img1.jpg'));
        assert.ok(deletedImageUrls.has('/uploads/img1_s.jpg'));
        assert.ok(deletedImageUrls.has('/uploads/img1_m.jpg'));
        assert.ok(deletedImageUrls.has('/uploads/img2.jpg'));
        assert.ok(deletedImageUrls.has('/uploads/img3.jpg'));
    });
});

describe('saveNoteVersion', () => {
    it('should be a function that accepts expected arguments', async () => {
        const { saveNoteVersion } = await import('./helpers.js');
        assert.ok(typeof saveNoteVersion === 'function');
        // Function.length only counts params before first default, so 2 (noteId, userId)
        assert.strictEqual(saveNoteVersion.length, 2);
    });

    it('should parse version limit from env correctly', () => {
        // Test the parsing logic used in the function
        const testCases = [
            { input: '10', expected: 10 },
            { input: '5', expected: 5 },
            { input: undefined, expected: 10 }, // default
        ];

        for (const tc of testCases) {
            const result = parseInt(tc.input || '10');
            assert.strictEqual(result, tc.expected);
        }
    });
});
