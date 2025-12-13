import { useState, useEffect } from 'react';
import { Modal, Text, Timeline, Button, Group, Loader, Center, Stack } from '@mantine/core';
import { IconHistory, IconRestore } from '@tabler/icons-react';
import { useNotesStore } from '../stores/notesStore';

export default function VersionHistoryModal({ opened, onClose, noteId }) {
    const { getNoteVersions, restoreNoteVersion, fetchNotes } = useNotesStore();
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        if (opened && noteId) {
            loadVersions();
        }
    }, [opened, noteId]);

    const loadVersions = async () => {
        setLoading(true);
        try {
            const data = await getNoteVersions(noteId);
            setVersions(data);
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (versionId) => {
        if (!confirm('Are you sure you want to restore this version? Current state will be saved as a new version.')) return;

        setRestoring(true);
        try {
            await restoreNoteVersion(noteId, versionId);
            await fetchNotes(); // Refresh notes list
            onClose();
        } catch (error) {
            console.error('Failed to restore version:', error);
            alert('Failed to restore version');
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
        >
            {loading ? (
                <Center py="xl"><Loader /></Center>
            ) : versions.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">No history available for this note.</Text>
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
                                    onClick={() => handleRestore(version.id)}
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
