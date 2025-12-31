import { useState } from 'react';
import { useLabelsStore } from '../stores/labelsStore';
import { useLabels } from '../hooks/useLabels';
import {
    Modal, Stack, Group, TextInput, Button, Text, ActionIcon, Paper, Badge, Box
} from '@mantine/core';
import { IconTag, IconPlus, IconX } from '@tabler/icons-react';

export default function EditLabelsModal({ opened, onClose }) {
    const { createLabel, deleteLabel, isLoading } = useLabelsStore();
    const labels = useLabels();
    const [newLabelName, setNewLabelName] = useState('');
    const [error, setError] = useState('');

    const handleClose = () => {
        setError('');
        setNewLabelName('');
        onClose();
    };

    const handleCreate = async () => {
        if (!newLabelName.trim()) return;

        setError('');
        const result = await createLabel(newLabelName.trim());
        if (result.success) {
            setNewLabelName('');
        } else {
            setError(result.error);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        }
    };

    const handleDelete = async (id) => {
        await deleteLabel(id);
        // Note: useLiveQuery automatically updates notes display
        // Labels in local DB will be refreshed on next sync
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={
                <Group gap="xs">
                    <IconTag size={20} />
                    <Text fw={600}>Edit Labels</Text>
                </Group>
            }
            centered
        >
            <Stack gap="md">
                {/* Create new label */}
                <Group align="flex-start" wrap="nowrap">
                    <Box style={{ flex: 1 }}>
                        <TextInput
                            placeholder="New label name..."
                            value={newLabelName}
                            onChange={(e) => {
                                setNewLabelName(e.currentTarget.value);
                                if (error) setError('');
                            }}
                            onKeyDown={handleKeyDown}
                            error={error}
                            maxLength={100}
                        />
                    </Box>
                    <Button
                        onClick={handleCreate}
                        loading={isLoading}
                        leftSection={<IconPlus size={16} />}
                        disabled={!newLabelName.trim()}
                    >
                        Add
                    </Button>
                </Group>

                {/* Labels list */}
                {labels.length === 0 ? (
                    <Text c="dimmed" ta="center" py="md">
                        No labels yet. Create your first label above.
                    </Text>
                ) : (
                    <Stack gap="xs">
                        {labels.map((label) => (
                            <Paper key={label.id} p="sm" withBorder radius="sm">
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                        <IconTag size={18} style={{ flexShrink: 0 }} />
                                        <Text size="md" truncate style={{ flex: 1 }}>{label.name}</Text>
                                    </Group>
                                    <Group gap="sm" wrap="nowrap">
                                        <Badge size="md" variant="light" color="gray">
                                            {label.note_count || 0}
                                        </Badge>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            size="md"
                                            onClick={() => handleDelete(label.id)}
                                            title="Delete label"
                                        >
                                            <IconX size={18} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
}
