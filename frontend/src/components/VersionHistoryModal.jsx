import { useState, useEffect } from 'react';
import { Modal, Text, Timeline, Button, Group, Center, Loader } from '@mantine/core';
import { IconHistory, IconRestore } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuthStore } from '../stores/authStore';
import { useNotesStore } from '../stores/notesStore';
import { logger } from '../utils/logger';

export default function VersionHistoryModal({ opened, onClose, noteId }) {
    const [restoring, setRestoring] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const authFetch = useAuthStore.getState().authFetch;

    // Track online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Live query from local DB (Offline First)
    const versions = useLiveQuery(
        () => db.note_versions && noteId
            ? db.note_versions
                .where('note_id')
                .equals(noteId)
                .reverse()
                .sortBy('created_at')
            : [],
        [noteId]
    );

    // On-Demand Fetch: If opened and no versions found locally, try fetching from server
    // This bridges the gap for "Lazy Sync"
    useEffect(() => {
        if (!opened || !noteId || (versions && versions.length > 0)) return;

        const fetchVersions = async () => {
            if (!navigator.onLine) return; // Can only fetch if online
            setFetching(true);
            try {
                const res = await authFetch('/api/notes/versions/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteIds: [noteId] })
                });

                if (res.ok) {
                    const fetchedVersions = await res.json();
                    if (fetchedVersions.length > 0) {
                        await db.transaction('rw', db.note_versions, async () => {
                            // Delete all local versions for this note first
                            // Server is the source of truth
                            await db.note_versions.where('note_id').equals(noteId).delete();

                            // Insert server versions
                            for (const version of fetchedVersions) {
                                await db.note_versions.put({
                                    id: version.id,
                                    note_id: version.note_id,
                                    created_at: version.created_at,
                                    data: version.data
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                logger.error('UI', 'Failed to fetch versions on-demand', error);
            } finally {
                setFetching(false);
            }
        };

        const timeout = setTimeout(fetchVersions, 100); // Small delay to allow dexie load
        return () => clearTimeout(timeout);
    }, [opened, noteId, versions, authFetch]);

    const handleRestore = async (version) => {
        if (!confirm('Are you sure you want to restore this version? The current state will be saved as a new version in history.')) return;

        setRestoring(true);
        try {
            await useNotesStore.getState().restoreNoteVersion(noteId, version.id);
            onClose();
        } catch (error) {
            logger.error('UI', 'Failed to restore version', error);
            alert('Failed to restore version: ' + error.message);
        } finally {
            setRestoring(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Group gap="xs"><IconHistory size={20} /><Text fw={600}>Version History</Text></Group>}
            size="lg"
            zIndex={1100} // Ensure it's above other layers
        >
            {fetching || !versions ? (
                <Center py="xl"><Loader size="sm" /><Text ml="sm">Loading versions...</Text></Center>
            ) : versions.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    {isOnline ? "No version history found." : "No history available offline."}
                </Text>
            ) : (
                <Timeline active={-1} bulletSize={24} lineWidth={2}>
                    {versions.map((version) => (
                        <Timeline.Item
                            key={version.id}
                            bullet={<IconHistory size={12} />}
                            title={new Date(version.created_at).toLocaleString()}
                        >
                            <Group justify="space-between" mt="xs">
                                <Text size="sm" c="dimmed">
                                    Saved version
                                </Text>
                                <Button
                                    variant="subtle"
                                    size="xs"
                                    leftSection={<IconRestore size={14} />}
                                    loading={restoring}
                                    onClick={() => handleRestore(version)}
                                >
                                    Restore
                                </Button>
                            </Group>
                        </Timeline.Item>
                    ))}
                </Timeline>
            )}
        </Modal>
    );
}
