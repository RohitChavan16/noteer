import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullChanges, pushChanges } from './syncEngine';
import { db, workerDb, SYNC_STATUS } from '../db/db';
import { useEncryptionStore } from '../stores/encryptionStore';
import { logger } from '../utils/logger';

// Mocks
vi.mock('../db/db', () => ({
    db: {
        syncState: { get: vi.fn(), put: vi.fn() },
        notes: {
            get: vi.fn(),
            put: vi.fn(),
            bulkPut: vi.fn(),
            delete: vi.fn(),
            bulkDelete: vi.fn(),
            update: vi.fn(),
            where: vi.fn(),
            add: vi.fn()
        },
        note_versions: { where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn() })) })) },
        transaction: vi.fn(async (...args) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                return callback();
            }
        })
    },
    workerDb: {
        notes: { bulkPut: vi.fn() }
    },
    SYNC_STATUS: {
        SYNCED: 'synced',
        NEW: 'new',
        PENDING: 'pending',
        DELETED: 'deleted'
    }
}));

vi.mock('../stores/encryptionStore', () => ({
    useEncryptionStore: {
        getState: vi.fn()
    }
}));

vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid')
}));

describe('Sync Engine', () => {
    let mockAuthFetch;
    let mockDecryptNote;
    let mockEncryptNote;

    beforeEach(() => {
        vi.clearAllMocks();

        mockAuthFetch = vi.fn();
        mockDecryptNote = vi.fn(note => Promise.resolve({ ...note, encrypted: false }));
        mockEncryptNote = vi.fn(note => Promise.resolve({ ...note, encrypted: true, encrypted_note_key: 'key' }));

        useEncryptionStore.getState.mockReturnValue({
            isUnlocked: true,
            decryptNote: mockDecryptNote,
            encryptNote: mockEncryptNote
        });

        // Default DB responses
        db.syncState.get.mockResolvedValue(null); // No last sync time
        db.notes.where.mockReturnValue({
            anyOf: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([])
            })
        });
    });

    describe('pullChanges', () => {
        it('should skip pull if encryption is locked', async () => {
            useEncryptionStore.getState.mockReturnValue({ isUnlocked: false });

            await pullChanges(mockAuthFetch);

            expect(logger.info).toHaveBeenCalledWith('SYNC', expect.stringContaining('Encryption not unlocked'));
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });

        it('should pull changes from server and update local DB', async () => {
            const serverNotes = [
                { id: '1', updated_at: '2023-01-02T10:00:00Z', title: 'Note 1' }
            ];

            mockAuthFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    notes: serverNotes,
                    deleted: [],
                    serverTime: 123456789
                })
            });

            db.notes.get.mockResolvedValue(undefined); // Local note not found

            await pullChanges(mockAuthFetch);

            expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/notes/sync'));
            expect(mockDecryptNote).toHaveBeenCalledWith(serverNotes[0]);
            expect(db.notes.bulkPut).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: '1',
                    sync_status: SYNC_STATUS.SYNCED
                })
            ]);
            expect(db.syncState.put).toHaveBeenCalledWith({ key: 'lastSyncTime', value: 123456789 });
        });

        it('should handle conflict logic: local is newer', async () => {
            const serverNotes = [
                { id: '1', updated_at: '2023-01-01T10:00:00Z' }
            ];

            mockAuthFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ notes: serverNotes, deleted: [], serverTime: 100 })
            });

            // Local note is NEWER
            db.notes.get.mockResolvedValue({
                id: '1',
                updated_at: '2023-01-02T10:00:00Z', // Local is newer
                sync_status: SYNC_STATUS.PENDING
            });

            await pullChanges(mockAuthFetch);

            // Should NOT put into DB because local is newer
            expect(db.notes.bulkPut).not.toHaveBeenCalled();
        });

        it('should handle deletion from server', async () => {
            mockAuthFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ notes: [], deleted: ['1'], serverTime: 100 })
            });

            await pullChanges(mockAuthFetch);

            expect(db.notes.delete).toHaveBeenCalledWith('1');
            expect(db.transaction).toHaveBeenCalled();
        });
    });

    describe('pushChanges', () => {
        it('should push new notes to server', async () => {
            const pendingNotes = [
                {
                    id: 'temp-1',
                    title: 'New Note',
                    sync_status: SYNC_STATUS.NEW,
                    created_at: '2023-01-01'
                }
            ];

            // Mock DB pending notes
            db.notes.where.mockReturnValue({
                anyOf: vi.fn().mockReturnValue({
                    toArray: vi.fn().mockResolvedValue(pendingNotes)
                })
            });

            // Mock success response
            mockAuthFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    results: [
                        { success: true, op: 'create', id: 'real-1', updated_at: '2023-01-02' }
                    ]
                })
            });

            await pushChanges(mockAuthFetch);

            expect(mockEncryptNote).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Note' }));

            // Check POST body
            expect(mockAuthFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/notes/sync/batch'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"op":"create"')
                })
            );

            // Check ID update (temp-1 -> real-1)
            expect(db.notes.delete).toHaveBeenCalledWith('temp-1');
            expect(db.notes.put).toHaveBeenCalledWith(expect.objectContaining({
                id: 'real-1',
                sync_status: SYNC_STATUS.SYNCED
            }));
        });

        it('should push updates to server', async () => {
            const pendingNotes = [
                {
                    id: '1',
                    title: 'Updated Note',
                    sync_status: SYNC_STATUS.PENDING,
                    sync_dirty_fields: ['title'],
                    encrypted_note_key: 'key'
                }
            ];

            db.notes.where.mockReturnValue({
                anyOf: vi.fn().mockReturnValue({
                    toArray: vi.fn().mockResolvedValue(pendingNotes)
                })
            });

            mockAuthFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    results: [
                        { success: true, op: 'update', updated_at: '2023-01-03' }
                    ]
                })
            });

            await pushChanges(mockAuthFetch);

            expect(mockAuthFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/notes/sync/batch'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"op":"update"')
                })
            );

            // Check workerDb update
            expect(workerDb.notes.bulkPut).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: '1',
                    sync_status: SYNC_STATUS.SYNCED,
                    sync_dirty_fields: []
                })
            ]);
        });
    });
});
