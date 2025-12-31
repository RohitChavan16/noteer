import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/**
 * Hook for reactive notes queries using Dexie's useLiveQuery.
 * Replaces the old notesStore.notes array with live database queries.
 * 
 * Notes are stored DECRYPTED in local Dexie DB (encryption happens at sync edge).
 * This enables efficient sorting and filtering locally.
 */

// Constants
const EMPTY_ARRAY = [];

/**
 * Get all active notes (not archived, not trashed) with sorting
 * @param {Object} options - Query options
 * @param {('updated_at'|'title')} options.sortBy - Sort field (default: 'updated_at')
 * @param {('asc'|'desc')} options.sortOrder - Sort direction (default: 'desc')
 * @param {string} options.searchQuery - Optional search filter
 * @param {string} options.label - Optional label filter
 * @returns {Array|undefined} Array of notes or undefined while loading
 */
export function useNotes({ sortBy = 'updated_at', sortOrder = 'desc', searchQuery = '', label = '', limit = 20 } = {}) {
    return useLiveQuery(async () => {
        // Base query collection
        let collection;

        // Optimization: For default sort (pinned + time), use the compound index directly
        // This is the "Happy Path" for Infinite Scroll
        if (sortBy === 'updated_at' && sortOrder === 'desc' && !searchQuery && !label) {
            // Use [is_pinned+updated_at] index
            // Since we want pinned (1) first, then unpinned (0), and then new dates first:
            // We need to reverse order.
            // is_pinned 0 -> 1. Reverse -> 1 -> 0. Correct.
            // updated_at old -> new. Reverse -> new -> old. Correct.
            return await db.notes
                .where('is_archived').equals('false') // Dexie stores boolean as string in index? No, typically 0/1 or actual bool. 
                // Actually, simple .filter is safer for Archive check combined with Limit, 
                // BUT filter applies AFTER DB fetch in some cases. 
                // Best Dexie practice: Compound index [is_archived+is_trashed+is_pinned+updated_at] is overkill.
                // Let's stick to the main sorts.

                // Effective strategy:
                // 1. Get collection by index
                .orderBy('[is_pinned+updated_at]')
                .reverse()
                // 2. Filter logic (applied during scan, efficiently stops after limit reached)
                .filter(n => n.is_archived !== true && n.is_trashed !== true)
                .limit(limit)
                .toArray();
        }

        // Fallback for custom search/labels (Full Query + InMemory Filter for now, or simple scan)
        // With search, we can't easily use limit at DB level reliably without Full Text Search index.
        // So we load all (matches), filter, then slice.

        let notes = await db.notes
            .filter(n => n.is_archived !== true && n.is_trashed !== true)
            .toArray();

        // Filter by label
        if (label) {
            notes = notes.filter(n => n.labels && n.labels.some(l => l.name === label));
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            notes = notes.filter(n =>
                (n.title && n.title.toLowerCase().includes(query)) ||
                (n.content && n.content.toLowerCase().includes(query))
            );
        }

        // Sort (In-Memory)
        // Note: For search results, we usually have fewer items, so in-memory is acceptable.
        if (sortBy === 'title') {
            notes.sort((a, b) => {
                // Pin logic already handled by backend "effective" field? 
                // Yes, n.is_pinned is now user-specific.
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;

                const aTitle = (a.title || a.content || '').toLowerCase();
                const bTitle = (b.title || b.content || '').toLowerCase();
                const cmp = aTitle.localeCompare(bTitle);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else {
            // Default sort (updated_at)
            notes.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;

                const aTime = new Date(a.updated_at || 0).getTime();
                const bTime = new Date(b.updated_at || 0).getTime();
                return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
            });
        }

        // Apply Limit (In-Memory slice)
        return notes.slice(0, limit);

    }, [sortBy, sortOrder, searchQuery, label, limit], EMPTY_ARRAY);
}

/**
 * Get archived notes
 * @param {Object} options - Query options
 * @param {('updated_at'|'title')} options.sortBy - Sort field
 * @param {('asc'|'desc')} options.sortOrder - Sort direction
 * @returns {Array|undefined} Array of archived notes
 */
export function useArchivedNotes({ sortBy = 'updated_at', sortOrder = 'desc' } = {}) {
    return useLiveQuery(async () => {
        // Filter for archived, non-trashed notes
        let notes = await db.notes
            .filter(n => n.is_archived === true && n.is_trashed !== true)
            .toArray();

        // Sort
        if (sortBy === 'title') {
            notes.sort((a, b) => {
                const aTitle = (a.title || '').toLowerCase();
                const bTitle = (b.title || '').toLowerCase();
                return sortOrder === 'asc' ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
            });
        } else {
            notes.sort((a, b) => {
                const aTime = new Date(a.updated_at || 0).getTime();
                const bTime = new Date(b.updated_at || 0).getTime();
                return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
            });
        }

        return notes;
    }, [sortBy, sortOrder], EMPTY_ARRAY);
}

/**
 * Get trashed notes
 * @returns {Array|undefined} Array of trashed notes
 */
export function useTrashedNotes() {
    return useLiveQuery(async () => {
        const notes = await db.notes
            .filter(n => n.is_trashed === true)
            .toArray();

        // Sort by updated_at desc
        notes.sort((a, b) => {
            const aTime = new Date(a.updated_at || 0).getTime();
            const bTime = new Date(b.updated_at || 0).getTime();
            return bTime - aTime;
        });

        return notes;
    }, [], EMPTY_ARRAY);
}

/**
 * Get a single note by ID
 * @param {string|null} noteId - Note ID to fetch
 * @returns {Object|null|undefined} Note object, null if not found, undefined while loading
 */
export function useNote(noteId) {
    return useLiveQuery(() => {
        if (!noteId) return null;
        return db.notes.get(noteId);
    }, [noteId], null);
}
