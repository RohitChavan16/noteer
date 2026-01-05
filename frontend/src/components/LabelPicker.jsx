import { useState, useEffect } from 'react';
import { useLabelsStore } from '../stores/labelsStore';
import { useLabels } from '../hooks/useLabels';
import {
    Modal, Stack, Group, TextInput, Checkbox, Text, ActionIcon, ScrollArea, Button, Badge
} from '@mantine/core';
import { IconTag, IconPlus, IconX } from '@tabler/icons-react';

export default function LabelPicker({
    selectedLabels = [],
    onChange,
    triggerStyle = {},
    onOpenChange,
    iconSize = 16,
    buttonSize = "sm",
    modalTitle = "Select Labels",
    triggerTooltip = "Add labels",
    Icon = IconTag
}) {
    const { getOrCreateLabel, isLoading } = useLabelsStore();
    const labels = useLabels();
    const [opened, setOpened] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [search, setSearch] = useState('');
    const [localLabels, setLocalLabels] = useState(selectedLabels);

    const handleOpen = (isOpen) => {
        setOpened(isOpen);
        onOpenChange?.(isOpen);
    };

    useEffect(() => {
        if (opened) {
            // Normalize selectedLabels to IDs
            // If we have legacy labels (strings), try to find their ID
            const nameToId = new Map(labels.map(l => [l.name, l.id]));
            const normalized = selectedLabels.map(l => {
                if (typeof l === 'number') return l;
                if (typeof l === 'string') return nameToId.get(l);
                return null;
            }).filter(Boolean); // Remove nulls/undefined

            setLocalLabels(normalized);
            setSearch('');
            setNewLabelName('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened]); // FIX: Removed labels dependency to prevent resetting selection during sync

    const handleToggleLabel = (labelId) => {
        if (localLabels.includes(labelId)) {
            setLocalLabels(localLabels.filter((id) => id !== labelId));
        } else {
            setLocalLabels([...localLabels, labelId]);
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newLabelName.trim()) return;

        const result = await getOrCreateLabel(newLabelName.trim());
        if (result.success) {
            if (!localLabels.includes(result.label.id)) {
                setLocalLabels([...localLabels, result.label.id]);
            }
            setNewLabelName('');
            setSearch('');
        }
    };

    // Helper to get name from ID
    const getLabelName = (id) => {
        const label = labels.find(l => l.id === id);
        return label ? label.name : ''; // Fallback for unknown IDs
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateAndAdd();
        }
    };

    const handleSave = () => {
        onChange(localLabels);
        handleOpen(false);
    };

    const handleClose = () => {
        handleOpen(false);
    };

    const filteredLabels = labels.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase())
    );

    const showCreateOption = search.trim() &&
        !labels.some((l) => l.name.toLowerCase() === search.toLowerCase());

    return (
        <>
            <ActionIcon
                variant="subtle"
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(true);
                }}
                title={triggerTooltip}
                style={triggerStyle}
                size={buttonSize}
            >
                <Icon size={iconSize} />
            </ActionIcon>

            <Modal
                opened={opened}
                onClose={handleClose}
                title={
                    <Group gap="xs">
                        <IconTag size={20} />
                        <Text fw={600}>{modalTitle}</Text>
                    </Group>
                }
                centered
                size="sm"
                onClick={(e) => e.stopPropagation()}
            >
                <Stack gap="md">
                    {/* Search/Create input */}
                    <TextInput
                        placeholder="Search or create label..."
                        value={search || newLabelName}
                        onChange={(e) => {
                            const val = e.currentTarget.value;
                            setSearch(val);
                            setNewLabelName(val);
                        }}
                        onKeyDown={handleKeyDown}
                        leftSection={<IconTag size={16} />}
                        rightSection={
                            showCreateOption && (
                                <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={handleCreateAndAdd}
                                    loading={isLoading}
                                    title="Create label"
                                >
                                    <IconPlus size={16} />
                                </ActionIcon>
                            )
                        }
                        maxLength={100}
                    />

                    {/* Selected labels */}
                    {localLabels.length > 0 && (
                        <Group gap="xs">
                            {localLabels.map((id) => (
                                <Badge
                                    key={id}
                                    size="md"
                                    variant="filled"
                                    tt="none"
                                    rightSection={
                                        <ActionIcon
                                            size="xs"
                                            variant="transparent"
                                            color="white"
                                            onClick={() => handleToggleLabel(id)}
                                        >
                                            <IconX size={12} />
                                        </ActionIcon>
                                    }
                                >
                                    {getLabelName(id)}
                                </Badge>
                            ))}
                        </Group>
                    )}

                    {/* Labels list */}
                    <ScrollArea.Autosize mah={250}>
                        <Stack gap="xs">
                            {filteredLabels.length === 0 && !showCreateOption ? (
                                <Text size="sm" c="dimmed" ta="center" py="md">
                                    {labels.length === 0
                                        ? "No labels yet. Type to create one."
                                        : "No matching labels found."}
                                </Text>
                            ) : (
                                filteredLabels.map((label) => (
                                    <Checkbox
                                        key={label.id}
                                        label={label.name}
                                        checked={localLabels.includes(label.id)}
                                        onChange={() => handleToggleLabel(label.id)}
                                        size="md"
                                    />
                                ))
                            )}

                            {showCreateOption && (
                                <Group
                                    gap="xs"
                                    p="xs"
                                    style={{
                                        cursor: 'pointer',
                                        borderRadius: 'var(--mantine-radius-sm)',
                                        backgroundColor: 'var(--mantine-color-blue-light)'
                                    }}
                                    onClick={handleCreateAndAdd}
                                >
                                    <IconPlus size={16} />
                                    <Text size="sm" fw={500}>
                                        Create "{search.trim()}"
                                    </Text>
                                </Group>
                            )}
                        </Stack>
                    </ScrollArea.Autosize>

                    {/* Action buttons */}
                    <Group justify="flex-end" mt="sm">
                        <Button variant="subtle" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            Done
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
}
