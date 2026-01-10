import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSync } from './useSync';
import { useNotesStore } from '../stores/notesStore';
import { useAuthStore } from '../stores/authStore';
import * as syncEngine from '../services/syncEngine';
import * as labelSync from '../services/labelSyncService';
import * as imageSync from '../services/imageSyncService';

import * as offlineQueue from '../services/offlineQueueService';

// Mocks
vi.mock('../services/syncEngine');
vi.mock('../services/labelSyncService');
vi.mock('../services/imageSyncService');
vi.mock('../services/offlineQueueService');

vi.mock('../db/db', () => ({
    db: {
        notes: {
            where: vi.fn().mockReturnThis(),
            anyOf: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue(0)
        },
        transaction: vi.fn((mode, tables, callback) => callback())
    },
    SYNC_STATUS: { NEW: 'new', PENDING: 'pending', DELETED: 'deleted' }
}));

vi.mock('../stores/authStore', () => ({
    useAuthStore: {
        getState: vi.fn()
    }
}));

vi.mock('../stores/notesStore', () => ({
    useNotesStore: {
        setState: vi.fn(),
        getState: vi.fn()
    }
}));

// We need to mock the default export of create() from zustand behavior
// But here useNotesStore is a direct export from module. 
// In the hook: import { useNotesStore } from '../stores/notesStore';
// useNotesStore(state => state.isSyncing)
// This is a selector hook. We need to mock it as a function.

vi.mock('../stores/notesStore', () => {
    const setState = vi.fn();
    const getState = vi.fn(() => ({
        setTriggerSync: vi.fn()
    }));

    const useNotesStore = vi.fn((selector) => {
        const state = { isSyncing: false };
        return selector(state);
    });

    useNotesStore.setState = setState;
    useNotesStore.getState = getState;

    return { useNotesStore };
});


describe('useSync', () => {
    const mockAuthFetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        useAuthStore.getState.mockReturnValue({ authFetch: mockAuthFetch });

        // Setup service mocks
        syncEngine.pullChanges.mockResolvedValue();
        syncEngine.pushChanges.mockResolvedValue();
        labelSync.pullLabels.mockResolvedValue();
        labelSync.pushLabels.mockResolvedValue();
        imageSync.uploadOfflineImages.mockResolvedValue();
        offlineQueue.processOfflineQueue.mockResolvedValue();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should run full sync sequence when sync() is called', async () => {
        const { result } = renderHook(() => useSync());

        await act(async () => {
            await result.current.sync();
        });

        // Verify order: images -> labels -> queue -> changes
        expect(imageSync.uploadOfflineImages).toHaveBeenCalledWith(mockAuthFetch);
        expect(labelSync.pushLabels).toHaveBeenCalledWith(mockAuthFetch);
        expect(labelSync.pullLabels).toHaveBeenCalledWith(mockAuthFetch);
        expect(offlineQueue.processOfflineQueue).toHaveBeenCalledWith(mockAuthFetch);
        expect(syncEngine.pushChanges).toHaveBeenCalledWith(mockAuthFetch);
        expect(syncEngine.pullChanges).toHaveBeenCalledWith(mockAuthFetch, expect.anything());

        // Verify state updates
        expect(useNotesStore.setState).toHaveBeenCalledWith(expect.objectContaining({ isSyncing: true }));
        expect(useNotesStore.setState).toHaveBeenCalledWith(expect.objectContaining({ isSyncing: false }));
    });

    it('should retry on failure', async () => {
        // Fail once, then succeed
        syncEngine.pushChanges
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValueOnce();

        const { result } = renderHook(() => useSync());

        // We need to be online for retry logic
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

        await act(async () => {
            await result.current.sync();
        });

        expect(useNotesStore.setState).toHaveBeenCalledWith({ isSyncing: false });

        // Fast-forward time for retry delay (1000ms)
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        // Should have called sync again (implied by service calls)
        expect(syncEngine.pushChanges).toHaveBeenCalledTimes(2);
    });
});
