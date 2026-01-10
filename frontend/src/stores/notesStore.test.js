import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotesStore } from './notesStore';
import { useAuthStore } from './authStore';
import { useEncryptionStore } from './encryptionStore';
import { db, SYNC_STATUS, NOTE_STATUS } from '../db/db';
import { logger } from '../utils/logger';

// Mocks
vi.mock('../db/db', () => ({
    db: {
        notes: {
            add: vi.fn(),
            update: vi.fn(),
            put: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            where: vi.fn().mockReturnThis(),
            anyOf: vi.fn().mockReturnThis(),
            count: vi.fn()
        },
        note_versions: {
            add: vi.fn(),
            get: vi.fn(),
            where: vi.fn().mockReturnThis(),
            between: vi.fn().mockReturnThis(),
            primaryKeys: vi.fn().mockResolvedValue([]),
            bulkDelete: vi.fn()
        }
    },
    SYNC_STATUS: {
        NEW: 'new',
        PENDING: 'pending',
        DELETED: 'deleted',
        SYNCED: 'synced'
    },
    NOTE_STATUS: {
        ACTIVE: 'active',
        TRASHED: 'trashed',
        ARCHIVED: 'archived'
    }
}));

vi.mock('./authStore', () => ({
    useAuthStore: {
        getState: vi.fn(() => ({
            authFetch: vi.fn()
        }))
    }
}));

vi.mock('./encryptionStore', () => ({
    useEncryptionStore: {
        getState: vi.fn(() => ({
            isUnlocked: true,
            decryptNote: vi.fn(),
            encryptNote: vi.fn()
        }))
    }
}));

vi.mock('../utils/logger', () => ({
    logger: {
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid')
}));

describe('notesStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store state
        useNotesStore.setState({
            isLoading: false,
            error: null,
            searchQuery: '',
            pendingChanges: false
        });
    });

    describe('createNote', () => {
        it('should create a valid note locally', async () => {
            const noteData = { title: 'Test Note', content: 'Content', type: 'text' };

            db.notes.add.mockResolvedValue('mock-uuid');

            const result = await useNotesStore.getState().createNote(noteData);

            expect(result).not.toBeNull();
            expect(result.id).toBe('mock-uuid');
            expect(result.title).toBe('Test Note');
            expect(result.sync_status).toBe(SYNC_STATUS.NEW);

            expect(db.notes.add).toHaveBeenCalledWith(expect.objectContaining({
                id: 'mock-uuid',
                title: 'Test Note',
                sync_status: SYNC_STATUS.NEW
            }));

            expect(useNotesStore.getState().pendingChanges).toBe(true);
        });

        it('should handle invalid input', async () => {
            const result = await useNotesStore.getState().createNote(null);

            expect(result).toBeNull();
            expect(useNotesStore.getState().error).toBe('Invalid note data');
            expect(logger.error).toHaveBeenCalled();
            expect(db.notes.add).not.toHaveBeenCalled();
        });

        it('should handle Dexie errors', async () => {
            db.notes.add.mockRejectedValue(new Error('DB Error'));

            const result = await useNotesStore.getState().createNote({ title: 'T' });

            expect(result).toBeNull();
            expect(useNotesStore.getState().error).toBe('DB Error');
            expect(logger.error).toHaveBeenCalledWith('NOTES', expect.stringContaining('Dexie write failed'), expect.any(Error));
        });
    });

    describe('updateNote', () => {
        it('should update note and mark as PENDING sync', async () => {
            const existingNote = {
                id: '1',
                title: 'Old',
                sync_status: SYNC_STATUS.SYNCED,
                updated_at: '2023-01-01',
                is_trashed: false,
                is_archived: false,
                sync_dirty_fields: []
            };

            db.notes.get.mockResolvedValue(existingNote);

            const changes = { title: 'New Title' };
            await useNotesStore.getState().updateNote('1', changes);

            // Expect call with exact fields including derived status
            expect(db.notes.update).toHaveBeenCalledWith('1', expect.objectContaining({
                title: 'New Title',
                sync_status: SYNC_STATUS.PENDING,
                status: NOTE_STATUS.ACTIVE, // Derived
                sync_dirty_fields: ['title', 'status']
            }));
        });

        it('should create version on content change', async () => {
            const existingNote = {
                id: '1',
                title: 'Old',
                content: 'Old Content',
                sync_status: SYNC_STATUS.SYNCED,
                updated_at: '2023-01-01'
            };

            db.notes.get.mockResolvedValue(existingNote);

            await useNotesStore.getState().updateNote('1', { content: 'New Content' });

            expect(db.note_versions.add).toHaveBeenCalledWith(expect.objectContaining({
                note_id: '1',
                data: existingNote
            }));
        });

        it('should NOT create version on metadata change', async () => {
            const existingNote = {
                id: '1',
                title: 'Old',
                sync_status: SYNC_STATUS.SYNCED
            };

            db.notes.get.mockResolvedValue(existingNote);

            await useNotesStore.getState().updateNote('1', { is_pinned: true });

            expect(db.note_versions.add).not.toHaveBeenCalled();
        });
    });

    describe('deleteNote', () => {
        it('should hard delete if note is NEW', async () => {
            db.notes.get.mockResolvedValue({ id: '1', sync_status: SYNC_STATUS.NEW });

            await useNotesStore.getState().deleteNote('1');

            expect(db.notes.delete).toHaveBeenCalledWith('1');
            expect(db.notes.update).not.toHaveBeenCalled();
        });

        it('should soft delete (mark DELETED) if note was SYNCED', async () => {
            db.notes.get.mockResolvedValue({ id: '1', sync_status: SYNC_STATUS.SYNCED });

            await useNotesStore.getState().deleteNote('1');

            expect(db.notes.delete).not.toHaveBeenCalled();
            expect(db.notes.update).toHaveBeenCalledWith('1', { sync_status: SYNC_STATUS.DELETED });
        });
    });

    describe('restoreNoteVersion', () => {
        const mockDecryptNote = vi.fn();
        const mockFetch = vi.fn();

        beforeEach(() => {
            useEncryptionStore.getState.mockReturnValue({
                isUnlocked: true,
                decryptNote: mockDecryptNote
            });
            useAuthStore.getState.mockReturnValue({
                authFetch: mockFetch
            });
            // Mock updateNote to avoid actual DB logic in restore tests
            useNotesStore.setState({ updateNote: vi.fn() });
        });

        it('should restore from local DB (Offline First)', async () => {
            const versionData = { title: 'Restored Title', content: 'Restored Content' };
            db.note_versions.get.mockResolvedValue({ data: versionData });

            const result = await useNotesStore.getState().restoreNoteVersion('1', 'v1');

            expect(db.note_versions.get).toHaveBeenCalledWith('v1');
            expect(useNotesStore.getState().updateNote).toHaveBeenCalledWith('1', expect.objectContaining({
                title: 'Restored Title',
                content: 'Restored Content'
            }));
            expect(result).toEqual(versionData);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should fallback to server if not found locally, and decrypt if needed', async () => {
            // Local missing
            db.note_versions.get.mockResolvedValue(undefined);

            // Server response
            const serverVersion = {
                id: 'v1',
                encrypted: true,
                title: 'Encrypted',
                sync_status: SYNC_STATUS.SYNCED
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(serverVersion)
            });

            // Mock decryption
            const decryptedVersion = { ...serverVersion, title: 'Decrypted Title' };
            mockDecryptNote.mockResolvedValue(decryptedVersion);

            const result = await useNotesStore.getState().restoreNoteVersion('1', 'v1');

            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/versions/v1/restore'), expect.anything());
            expect(mockDecryptNote).toHaveBeenCalledWith(serverVersion);
            expect(db.notes.put).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Decrypted Title',
                sync_status: SYNC_STATUS.SYNCED
            }));
            expect(result).toEqual(serverVersion);
        });
    });
});
