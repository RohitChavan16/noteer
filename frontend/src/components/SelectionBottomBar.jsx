import { ActionIcon, Button, Group, Text, Transition, Tooltip, Menu, Paper, useMantineColorScheme, ThemeIcon } from '@mantine/core';
import { IconTrash, IconArchive, IconPalette, IconX, IconRestore, IconCheck, IconTag } from '@tabler/icons-react';
import { useNotesStore } from '../stores/notesStore';
import { NOTE_COLORS } from '../constants/noteColors';
import LabelPicker from './LabelPicker';

export default function SelectionBottomBar({ showRestore, showDelete, onSelectAll, notes }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        isSelectionMode,
        selectedNoteIds,
        clearSelection,
        bulkTrashNotes,
        bulkArchiveNotes,
        bulkRestoreNotes,
        bulkDeleteNotes,
        bulkUpdateNotes,
        updateNote
    } = useNotesStore();

    const count = selectedNoteIds.length;
    const hasSelection = count > 0;

    const handleColorChange = (colorId) => {
        bulkUpdateNotes(selectedNoteIds, { color: colorId });
    };

    const handleAddLabels = async (newLabels) => {
        if (!newLabels || newLabels.length === 0) return;

        // Iterate selected notes and append labels
        const updates = selectedNoteIds.map(id => {
            const note = notes.find(n => n.id === id);
            if (!note) return null;

            const currentLabels = note.labels || [];
            const mergedLabels = [...new Set([...currentLabels, ...newLabels])];

            return { id, labels: mergedLabels };
        }).filter(Boolean);

        await Promise.all(updates.map(u => updateNote(u.id, { labels: u.labels })));
        clearSelection();
    };

    return (
        <Transition transition="slide-up" mounted={isSelectionMode} duration={200}>
            {(styles) => (
                <Paper
                    shadow="xl"
                    p="md"
                    withBorder
                    style={{
                        ...styles,
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 200,
                        backgroundColor: 'var(--mantine-color-body)',
                        borderTop: '1px solid var(--mantine-color-default-border)'
                    }}
                >
                    <Group justify="space-between" maw={800} mx="auto">
                        <Group>
                            <Button
                                variant="subtle"
                                color="gray"
                                onClick={clearSelection}
                                leftSection={<IconX size={18} />}
                            >
                                Cancel
                            </Button>
                            <Text fw={500}>{count} selected</Text>

                            {onSelectAll && (
                                <Button
                                    variant="subtle"
                                    size="sm"
                                    onClick={onSelectAll}
                                >
                                    Select All
                                </Button>
                            )}
                        </Group>

                        <Group gap="sm">
                            {(showRestore || showDelete) ? (
                                // Trash Actions
                                <>
                                    {showRestore && (
                                        <Tooltip label="Restore selected">
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                disabled={!hasSelection}
                                                onClick={() => bulkRestoreNotes(selectedNoteIds)}
                                            >
                                                <IconRestore size={22} />
                                            </ActionIcon>
                                        </Tooltip>
                                    )}
                                    {showDelete && (
                                        <Tooltip label="Delete forever">
                                            <ActionIcon
                                                variant="subtle"
                                                color="red"
                                                size="lg"
                                                disabled={!hasSelection}
                                                onClick={() => bulkDeleteNotes(selectedNoteIds)}
                                            >
                                                <IconTrash size={22} />
                                            </ActionIcon>
                                        </Tooltip>
                                    )}
                                </>
                            ) : (
                                // Standard Actions
                                <>
                                    <Tooltip label="Archive selected">
                                        <ActionIcon
                                            variant="subtle"
                                            size="lg"
                                            disabled={!hasSelection}
                                            onClick={() => bulkArchiveNotes(selectedNoteIds)}
                                        >
                                            <IconArchive size={22} />
                                        </ActionIcon>
                                    </Tooltip>

                                    <Tooltip label="Move to trash">
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            size="lg"
                                            disabled={!hasSelection}
                                            onClick={() => bulkTrashNotes(selectedNoteIds)}
                                        >
                                            <IconTrash size={22} />
                                        </ActionIcon>
                                    </Tooltip>

                                    {/* Mass Tag */}
                                    <LabelPicker
                                        selectedLabels={[]}
                                        onChange={handleAddLabels}
                                        triggerStyle={{}}
                                        iconSize={22}
                                        buttonSize="lg"
                                    />

                                    <Menu position="top" shadow="md">
                                        <Menu.Target>
                                            <Tooltip label="Change color">
                                                <ActionIcon variant="subtle" size="lg" disabled={!hasSelection}>
                                                    <IconPalette size={22} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                            <Group gap={4} p="xs" maw={220}>
                                                {NOTE_COLORS.map((c) => {
                                                    const bg = isDark ? c.dark : c.light;
                                                    return (
                                                        <ActionIcon
                                                            key={c.id}
                                                            size="lg"
                                                            radius="xl"
                                                            style={{
                                                                backgroundColor: bg,
                                                                border: '1px solid var(--mantine-color-default-border)'
                                                            }}
                                                            onClick={() => handleColorChange(c.id)}
                                                        />
                                                    );
                                                })}
                                            </Group>
                                        </Menu.Dropdown>
                                    </Menu>
                                </>
                            )}
                        </Group>
                    </Group>
                </Paper>
            )}
        </Transition>
    );
}
