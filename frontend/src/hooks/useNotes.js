import { useLiveQuery } from 'dexie-react-hooks';
import { db, NOTE_STATUS } from '../db/db';
import { logger } from '../utils/logger';

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
 * @param {('created_at'|'title')} options.sortBy - Sort field (default: 'created_at')
 * @param {('asc'|'desc')} options.sortOrder - Sort direction (default: 'desc')
 * @param {string} options.searchQuery - Optional search filter
 * @param {string} options.label - Optional label filter
 * @returns {Array|undefined} Array of notes or undefined while loading
 */
export function useNotes({ sortBy = 'created_at', sortOrder = 'desc', searchQuery = '', labelId = null, limit = 20 } = {}) {
    return useLiveQuery(async () => {
        let pinnedNotes = [];
        let unpinnedNotes = [];

        if (labelId) {
            // Label filter: use *labels multiEntry index, then split by pinned
            const labelNotes = await db.notes
                .where('labels').equals(labelId)
                .filter(n => n.status === NOTE_STATUS.ACTIVE)
                .toArray();

            pinnedNotes = labelNotes.filter(n => n.is_pinned);
            unpinnedNotes = labelNotes.filter(n => !n.is_pinned);
        } else {
            // Use compound index for optimized queries
            // Fetch pinned and unpinned separately to leverage index ordering

            // Pinned notes (status=active, is_pinned=1)
            pinnedNotes = await db.notes
                .where('[status+is_pinned+updated_at]')
                .between(
                    [NOTE_STATUS.ACTIVE, 1, ''],
                    [NOTE_STATUS.ACTIVE, 1, '\uffff']
                )
                .reverse() // Most recent first
                .toArray();

            // Unpinned notes (status=active, is_pinned=0) - limited
            unpinnedNotes = await db.notes
                .where('[status+is_pinned+updated_at]')
                .between(
                    [NOTE_STATUS.ACTIVE, 0, ''],
                    [NOTE_STATUS.ACTIVE, 0, '\uffff']
                )
                .reverse() // Most recent first
                .limit(limit) // Apply limit at DB level
                .toArray();
        }

        // Filter by search query (still in-memory, would need full-text search index)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const filterFn = n =>
                (n.title && n.title.toLowerCase().includes(query)) ||
                (n.content && n.content.toLowerCase().includes(query));
            pinnedNotes = pinnedNotes.filter(filterFn);
            unpinnedNotes = unpinnedNotes.filter(filterFn);
        }

        // Sort by title if requested (needs in-memory since we sort by title not updated_at)
        if (sortBy === 'title') {
            const stripHtml = (html) => {
                if (!html) return '';
                return html.replace(/<[^>]*>/g, '').trim();
            };
            const sortFn = (a, b) => {
                const aText = (a.title && a.title.trim() ? a.title : stripHtml(a.content)).toLowerCase();
                const bText = (b.title && b.title.trim() ? b.title : stripHtml(b.content)).toLowerCase();
                const cmp = aText.localeCompare(bText);
                return sortOrder === 'asc' ? cmp : -cmp;
            };
            pinnedNotes.sort(sortFn);
            unpinnedNotes.sort(sortFn);
        }
        // For created_at, respect sortOrder
        else if (sortOrder === 'asc') {
            // Reverse both since we fetched desc
            pinnedNotes.reverse();
            unpinnedNotes.reverse();
        }

        // Combine: pinned first, then unpinned (already limited at DB level)
        return [...pinnedNotes, ...unpinnedNotes].slice(0, limit);

    }, [sortBy, sortOrder, searchQuery, labelId, limit], EMPTY_ARRAY);
}

/**
 * Get archived notes
 * @param {Object} options - Query options
 * @param {('updated_at'|'title')} options.sortBy - Sort field
 * @param {('asc'|'desc')} options.sortOrder - Sort direction
 * @returns {Array|undefined} Array of archived notes
 */
export function useArchivedNotes({ sortBy = 'updated_at', sortOrder = 'desc', limit = 20 } = {}) {
    return useLiveQuery(async () => {
        // Use compound index for efficient query with limit
        let notes = await db.notes
            .where('[status+is_pinned+updated_at]')
            .between(
                [NOTE_STATUS.ARCHIVED, 0, ''],
                [NOTE_STATUS.ARCHIVED, 1, '\uffff'] // Include both pinned states
            )
            .reverse()
            .limit(limit)
            .toArray();

        // Sort by title if requested
        if (sortBy === 'title') {
            notes.sort((a, b) => {
                const aTitle = (a.title || '').toLowerCase();
                const bTitle = (b.title || '').toLowerCase();
                return sortOrder === 'asc' ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
            });
        } else if (sortOrder === 'asc') {
            notes.reverse();
        }

        return notes;
    }, [sortBy, sortOrder, limit], EMPTY_ARRAY);
}

/**
 * Get trashed notes
 * @param {Object} options - Query options
 * @param {number} options.limit - Max items to return
 * @returns {Array|undefined} Array of trashed notes
 */
export function useTrashedNotes({ limit = 20 } = {}) {
    return useLiveQuery(async () => {
        // Use compound index for efficient query with limit
        const notes = await db.notes
            .where('[status+is_pinned+updated_at]')
            .between(
                [NOTE_STATUS.TRASHED, 0, ''],
                [NOTE_STATUS.TRASHED, 1, '\uffff']
            )
            .reverse()
            .limit(limit)
            .toArray();

        // Filter out deleted sync status (rare case, minimal overhead)
        const filtered = notes.filter(n => n.sync_status !== 'deleted');

        logger.debug('HOOKS', 'useTrashedNotes found items', filtered.length);
        return filtered;
    }, [limit], EMPTY_ARRAY);
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
