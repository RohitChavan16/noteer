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
        let notes;

        // Use indexed queries for better performance
        if (labelId) {
            // Use *labels multiEntry index + filter for status
            notes = await db.notes
                .where('labels').equals(labelId)
                .filter(n => n.status === NOTE_STATUS.ACTIVE)
                .toArray();
        } else {
            // Use status index directly
            notes = await db.notes
                .where('status').equals(NOTE_STATUS.ACTIVE)
                .toArray();
        }

        // Filter by search query (still in-memory, search indexing would require full-text search)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            notes = notes.filter(n =>
                (n.title && n.title.toLowerCase().includes(query)) ||
                (n.content && n.content.toLowerCase().includes(query))
            );
        }

        // Sort (In-Memory - compound index already filters, sorting still needed for pinned)
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

                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
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
export function useArchivedNotes({ sortBy = 'updated_at', sortOrder = 'desc', limit = 20 } = {}) {
    return useLiveQuery(async () => {
        // Use status index for efficient query
        let notes = await db.notes
            .where('status').equals(NOTE_STATUS.ARCHIVED)
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

        return notes.slice(0, limit);
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
        // Use status index for efficient query
        const notes = await db.notes
            .where('status').equals(NOTE_STATUS.TRASHED)
            .filter(n => n.sync_status !== 'deleted')
            .toArray();

        logger.debug('HOOKS', 'useTrashedNotes found items', notes.length);

        // Sort by updated_at desc
        notes.sort((a, b) => {
            const aTime = new Date(a.updated_at || 0).getTime();
            const bTime = new Date(b.updated_at || 0).getTime();
            return bTime - aTime;
        });

        return notes.slice(0, limit);
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
