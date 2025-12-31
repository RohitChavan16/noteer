import { useState, useEffect } from 'react';
import { Modal, Text, Timeline, Button, Group, Center, Loader } from '@mantine/core';
import { IconHistory, IconRestore } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db, SYNC_STATUS } from '../db/db';
import { useAuthStore } from '../stores/authStore';

export default function VersionHistoryModal({ opened, onClose, noteId }) {
    const [restoring, setRestoring] = useState(false);
    const [fetching, setFetching] = useState(false);
    const authFetch = useAuthStore.getState().authFetch;

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
                console.error('Failed to fetch versions on-demand:', error);
            } finally {
                setFetching(false);
            }
        };

        const timeout = setTimeout(fetchVersions, 100); // Small delay to allow dexie load
        return () => clearTimeout(timeout);
    }, [opened, noteId, versions, authFetch]);

    const handleRestore = async (version) => {
        if (!confirm('Are you sure you want to restore this version? Current state will be saved as a conflict copy.')) return;

        setRestoring(true);
        try {
            const versionData = version.data;
            if (!versionData) throw new Error('Version data missing');

            // 1. Get current note state
            const currentNote = await db.notes.get(noteId);
            if (!currentNote) throw new Error('Current note not found');

            // 2. Create Safety "Conflict Copy" of current state
            const conflictId = uuidv4();
            const conflictNote = {
                ...currentNote,
                id: conflictId,
                title: `${currentNote.title} (Before Restore ${new Date().toLocaleTimeString()})`,
                sync_status: SYNC_STATUS.NEW,
                updated_at: new Date().toISOString()
            };
            await db.notes.add(conflictNote);

            // 3. Restore content from version
            // We use the version's data but preserve current ID and update metadata
            const restoredNote = {
                ...currentNote, // Keep current implementation details like is_owner logic if any
                ...versionData, // Overwrite with version data (title, content, color, items, etc.)
                id: noteId,     // Force keep same ID
                user_id: currentNote.user_id, // Force keep same owner
                // Update implementation metadata
                updated_at: new Date().toISOString(),
                sync_status: SYNC_STATUS.PENDING, // Mark for sync
                version: (currentNote.version || 0) + 1 // Increment version locally
            };

            await db.notes.put(restoredNote);

            onClose();
        } catch (error) {
            console.error('Failed to restore version:', error);
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
            {!versions ? (
                <Center py="xl"><Text>Loading...</Text></Center>
            ) : versions.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">No history available offline.</Text>
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
