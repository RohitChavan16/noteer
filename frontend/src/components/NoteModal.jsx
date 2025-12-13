import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Modal, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Button, Checkbox, Text, Box } from '@mantine/core';
import { IconPalette, IconGripVertical, IconPlus, IconX, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';

const NOTE_COLORS = [
    { id: 'default', color: '#ffffff', darkColor: '#25262b' },
    { id: 'red', color: '#ffe3e3', darkColor: '#5c2323' },
    { id: 'orange', color: '#ffe8cc', darkColor: '#5c3a1d' },
    { id: 'yellow', color: '#fff3bf', darkColor: '#5c4a1d' },
    { id: 'green', color: '#d3f9d8', darkColor: '#1d4a2a' },
    { id: 'teal', color: '#c3fae8', darkColor: '#1d4a4a' },
    { id: 'blue', color: '#d0ebff', darkColor: '#1d3a5c' },
    { id: 'purple', color: '#e5dbff', darkColor: '#3d2a5c' },
    { id: 'pink', color: '#ffdeeb', darkColor: '#5c2a3d' },
    { id: 'brown', color: '#ffd8a8', darkColor: '#5c3a1d' },
    { id: 'gray', color: '#e9ecef', darkColor: '#373a40' },
];

const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function NoteModal({ note, onClose }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const { updateNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote } = useNotesStore();
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [items, setItems] = useState(note?.items || []);
    const [color, setColor] = useState(note?.color || 'default');
    const [showColors, setShowColors] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newItem, setNewItem] = useState('');

    const isChecklist = note?.type === 'checklist' || (note?.items && note.items.length > 0);

    const getCurrentColor = () => {
        const c = NOTE_COLORS.find(nc => nc.id === color);
        return isDark ? (c?.darkColor || NOTE_COLORS[0].darkColor) : (c?.color || NOTE_COLORS[0].color);
    };

    const handleSave = async () => {
        if (isSaving) return;

        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default') ||
            JSON.stringify(items) !== JSON.stringify(note?.items || []);

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, { title, content, color, items });
            setIsSaving(false);
        }
        onClose();
    };

    const addItem = () => {
        if (newItem.trim()) {
            setItems([...items, { content: newItem.trim(), is_checked: false }]);
            setNewItem('');
        }
    };

    const handleItemKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const toggleItemCheck = (index) => {
        setItems(items.map((item, i) => i === index ? { ...item, is_checked: !item.is_checked } : item));
    };

    const updateItemContent = (index, content) => {
        setItems(items.map((item, i) => i === index ? { ...item, content } : item));
    };

    if (!note) return null;

    return (
        <Modal
            opened={!!note}
            onClose={handleSave}
            size="lg"
            centered
            withCloseButton={false}
            styles={{
                content: { backgroundColor: getCurrentColor() },
            }}
        >
            <Stack gap="md">
                <TextInput
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    variant="unstyled"
                    maxLength={200}
                    styles={{ input: { fontWeight: 600, fontSize: '1.25rem' } }}
                />

                {isChecklist ? (
                    <Stack gap={4}>
                        {items.map((item, index) => (
                            <Group key={index} gap="xs" wrap="nowrap">
                                <IconGripVertical size={14} style={{ opacity: 0.4, cursor: 'grab' }} />
                                <Checkbox
                                    checked={item.is_checked}
                                    onChange={() => toggleItemCheck(index)}
                                    size="xs"
                                />
                                <TextInput
                                    value={item.content}
                                    onChange={(e) => updateItemContent(index, e.target.value)}
                                    variant="unstyled"
                                    size="sm"
                                    maxLength={500}
                                    style={{ flex: 1 }}
                                    styles={{
                                        input: {
                                            textDecoration: item.is_checked ? 'line-through' : 'none',
                                            opacity: item.is_checked ? 0.6 : 1
                                        }
                                    }}
                                />
                                <ActionIcon variant="subtle" size="xs" onClick={() => removeItem(index)}>
                                    <IconX size={12} />
                                </ActionIcon>
                            </Group>
                        ))}
                        <Group gap="xs" wrap="nowrap">
                            <Box w={14} />
                            <IconPlus size={14} style={{ opacity: 0.4 }} />
                            <TextInput
                                placeholder="List item"
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                onKeyDown={handleItemKeyDown}
                                variant="unstyled"
                                size="sm"
                                maxLength={500}
                                style={{ flex: 1 }}
                            />
                        </Group>
                    </Stack>
                ) : (
                    <Textarea
                        placeholder="Take a note..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        variant="unstyled"
                        minRows={6}
                        autosize
                    />
                )}

                <Group justify="space-between" align="center">
                    <Group gap="xs">
                        <Popover opened={showColors} onChange={setShowColors} position="top-start">
                            <Popover.Target>
                                <ActionIcon
                                    variant="subtle"
                                    onClick={() => setShowColors(!showColors)}
                                    title="Background color"
                                >
                                    <IconPalette size={18} />
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <Group gap="xs">
                                    {NOTE_COLORS.map((c) => (
                                        <ColorSwatch
                                            key={c.id}
                                            color={isDark ? c.darkColor : c.color}
                                            onClick={() => { setColor(c.id); setShowColors(false); }}
                                            style={{
                                                cursor: 'pointer',
                                                border: color === c.id ? '2px solid var(--mantine-color-blue-5)' : '1px solid var(--mantine-color-gray-5)'
                                            }}
                                            size={24}
                                        />
                                    ))}
                                </Group>
                            </Popover.Dropdown>
                        </Popover>

                        {!note.is_trashed && (
                            <>
                                <ActionIcon
                                    variant="subtle"
                                    onClick={async () => {
                                        await updateNote(note.id, { is_pinned: !note.is_pinned });
                                        // Don't close on pin
                                        // Update local state if needed, but props should update if parent re-renders
                                        // Actually better to just close or let store update propagate
                                    }}
                                    title={note.is_pinned ? "Unpin" : "Pin"}
                                >
                                    {note.is_pinned ? <IconPinFilled size={18} /> : <IconPin size={18} />}
                                </ActionIcon>

                                <ActionIcon
                                    variant="subtle"
                                    onClick={async () => {
                                        await (note.is_archived ? unarchiveNote(note.id) : archiveNote(note.id));
                                        onClose();
                                    }}
                                    title={note.is_archived ? "Unarchive" : "Archive"}
                                >
                                    {note.is_archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}
                                </ActionIcon>

                                <ActionIcon
                                    variant="subtle"
                                    onClick={async () => {
                                        await trashNote(note.id);
                                        onClose();
                                    }}
                                    title="Trash"
                                >
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </>
                        )}

                        {note.is_trashed && (
                            <>
                                <ActionIcon
                                    variant="subtle"
                                    onClick={async () => {
                                        await restoreNote(note.id);
                                        onClose();
                                    }}
                                    title="Restore"
                                >
                                    <IconArchiveOff size={18} />
                                </ActionIcon>
                                <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={async () => {
                                        await deleteNote(note.id);
                                        onClose();
                                    }}
                                    title="Delete forever"
                                >
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </>
                        )}

                    </Group>

                    {note.updated_at && (
                        <Text size="xs" c="dimmed" ta="center">
                            Edited {formatDate(note.updated_at)}
                        </Text>
                    )}

                    <Button variant="subtle" onClick={handleSave} loading={isSaving}>
                        Close
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
