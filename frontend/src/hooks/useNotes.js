import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
 * @param {('updated_at'|'title')} options.sortBy - Sort field (default: 'updated_at')
 * @param {('asc'|'desc')} options.sortOrder - Sort direction (default: 'desc')
 * @param {string} options.searchQuery - Optional search filter
 * @param {string} options.label - Optional label filter
 * @returns {Array|undefined} Array of notes or undefined while loading
 */
export function useNotes({ sortBy = 'updated_at', sortOrder = 'desc', searchQuery = '', labelId = null, limit = 20 } = {}) {
    return useLiveQuery(async () => {
        let notes = await db.notes
            .filter(n => n.is_archived !== true && n.is_trashed !== true)
            .toArray();

        // Filter by label
        if (labelId) {
            notes = notes.filter(n => n.labels && n.labels.some(l => l == labelId));
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
        const stripHtml = (html) => {
            if (!html) return '';
            return html.replace(/<[^>]*>/g, '').trim();
        };

        if (sortBy === 'title') {
            notes.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;

                const aText = (a.title && a.title.trim() ? a.title : stripHtml(a.content)).toLowerCase();
                const bText = (b.title && b.title.trim() ? b.title : stripHtml(b.content)).toLowerCase();
                const cmp = aText.localeCompare(bText);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else {
            notes.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;

                const aTime = new Date(a.updated_at || 0).getTime();
                const bTime = new Date(b.updated_at || 0).getTime();
                return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
            });
        }

        return notes.slice(0, limit);

    }, [sortBy, sortOrder, searchQuery, labelId, limit], EMPTY_ARRAY);
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
            .filter(n => n.is_trashed === true && n.sync_status !== 'deleted')
            .toArray();

        logger.debug('HOOKS', 'useTrashedNotes found items', notes.length);

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
