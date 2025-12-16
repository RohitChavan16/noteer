import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Modal, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Button, Text, Box } from '@mantine/core';
import { IconPalette, IconPlus, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import SortableChecklistItem from './SortableChecklistItem';

// Robust ID generator fallback
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function NoteModal({ note, onClose }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const { updateNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote } = useNotesStore();
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');

    // Ensure items have IDs for drag and drop
    const [items, setItems] = useState(() =>
        (note?.items || []).map(item => ({ ...item, id: item.id || generateId() }))
    );

    const [color, setColor] = useState(note?.color || 'default');
    const [showColors, setShowColors] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newItem, setNewItem] = useState('');

    const isChecklist = note?.type === 'checklist' || (note?.items && note.items.length > 0);

    const backgroundColor = getNoteColor(color, isDark);
    const textColor = getNoteTextColor(color, isDark);

    // Detect touch device for larger buttons
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const iconSize = isTouchDevice ? 22 : 18;
    const buttonSize = isTouchDevice ? "lg" : undefined;

    // DnD Kit sensors - PointerSensor works for both mouse and touch
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement before drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleSave = async () => {
        if (isSaving) return;

        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default') ||
            JSON.stringify(items) !== JSON.stringify(note?.items || []);

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, {
                title,
                content,
                color,
                items,
                // Don't convert status fields back to stale props
                type: note.type
            });
            setIsSaving(false);
        }
        onClose();
    };

    const addItem = () => {
        if (newItem.trim()) {
            setItems([...items, { content: newItem.trim(), is_checked: false, id: generateId() }]);
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

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((currentItems) => {
                const oldIndex = currentItems.findIndex((item) => item.id === active.id);
                const newIndex = currentItems.findIndex((item) => item.id === over.id);
                return arrayMove(currentItems, oldIndex, newIndex);
            });
        }
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
                content: { backgroundColor: backgroundColor, color: textColor },
            }}
        >
            <Stack gap="md">
                <TextInput
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    variant="unstyled"
                    maxLength={200}
                    styles={{ input: { fontWeight: 600, fontSize: '1.25rem', color: textColor } }}
                />

                {isChecklist ? (
                    <Stack gap={4}>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={items.map(item => item.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {items.map((item, index) => (
                                    <SortableChecklistItem
                                        key={item.id}
                                        item={item}
                                        index={index}
                                        onToggle={toggleItemCheck}
                                        onUpdate={updateItemContent}
                                        onRemove={removeItem}
                                        textColor={textColor}
                                        backgroundColor={backgroundColor}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        <Group gap="xs" wrap="nowrap">
                            <Box w={14} />
                            <IconPlus size={14} style={{ opacity: 0.4, color: textColor }} />
                            <TextInput
                                placeholder="List item"
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                onKeyDown={handleItemKeyDown}
                                onBlur={addItem}
                                variant="unstyled"
                                size="sm"
                                maxLength={500}
                                style={{ flex: 1 }}
                                styles={{ input: { color: textColor } }}
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
                        styles={{ input: { color: textColor } }}
                    />
                )}

                {/* Mobile layout: stacked rows. Desktop: single row */}
                {isTouchDevice ? (
                    <Stack gap="sm" align="stretch">
                        <Group gap="xs" justify="center">
                            <Popover opened={showColors} onChange={setShowColors} position="top-start">
                                <Popover.Target>
                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={() => setShowColors(!showColors)}
                                        title="Background color"
                                        style={{ color: textColor }}
                                    >
                                        <IconPalette size={iconSize} />
                                    </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Group gap="xs">
                                        {NOTE_COLORS.map((c) => (
                                            <ColorSwatch
                                                key={c.id}
                                                color={isDark ? c.dark : c.light}
                                                onClick={() => { setColor(c.id); setShowColors(false); }}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: color === c.id ? '2px solid var(--mantine-color-blue-5)' : `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-5)'}`
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
                                        size={buttonSize}
                                        onClick={async () => {
                                            await updateNote(note.id, { is_pinned: !note.is_pinned });
                                        }}
                                        title={note.is_pinned ? "Unpin" : "Pin"}
                                        style={{ color: textColor }}
                                    >
                                        {note.is_pinned ? <IconPinFilled size={iconSize} /> : <IconPin size={iconSize} />}
                                    </ActionIcon>

                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={async () => {
                                            await (note.is_archived ? unarchiveNote(note.id) : archiveNote(note.id));
                                            onClose();
                                        }}
                                        title={note.is_archived ? "Unarchive" : "Archive"}
                                        style={{ color: textColor }}
                                    >
                                        {note.is_archived ? <IconArchiveOff size={iconSize} /> : <IconArchive size={iconSize} />}
                                    </ActionIcon>

                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={async () => {
                                            await trashNote(note.id);
                                            onClose();
                                        }}
                                        title="Trash"
                                        style={{ color: textColor }}
                                    >
                                        <IconTrash size={iconSize} />
                                    </ActionIcon>
                                </>
                            )}

                            {note.is_trashed && (
                                <>
                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={async () => {
                                            await restoreNote(note.id);
                                            onClose();
                                        }}
                                        title="Restore"
                                        style={{ color: textColor }}
                                    >
                                        <IconArchiveOff size={iconSize} />
                                    </ActionIcon>
                                    <ActionIcon
                                        variant="subtle"
                                        color="red"
                                        size={buttonSize}
                                        onClick={async () => {
                                            await deleteNote(note.id);
                                            onClose();
                                        }}
                                        title="Delete forever"
                                    >
                                        <IconTrash size={iconSize} />
                                    </ActionIcon>
                                </>
                            )}
                        </Group>

                        {note.updated_at && (
                            <Text size="xs" c="dimmed" ta="center">
                                Edited {formatDate(note.updated_at)}
                            </Text>
                        )}

                        <Button variant="subtle" onClick={handleSave} loading={isSaving} fullWidth>
                            Close
                        </Button>
                    </Stack>
                ) : (
                    <Group justify="space-between" align="center">
                        <Group gap="xs">
                            <Popover opened={showColors} onChange={setShowColors} position="top-start">
                                <Popover.Target>
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => setShowColors(!showColors)}
                                        title="Background color"
                                        style={{ color: textColor }}
                                    >
                                        <IconPalette size={18} />
                                    </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Group gap="xs">
                                        {NOTE_COLORS.map((c) => (
                                            <ColorSwatch
                                                key={c.id}
                                                color={isDark ? c.dark : c.light}
                                                onClick={() => { setColor(c.id); setShowColors(false); }}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: color === c.id ? '2px solid var(--mantine-color-blue-5)' : `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-5)'}`
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
                                        }}
                                        title={note.is_pinned ? "Unpin" : "Pin"}
                                        style={{ color: textColor }}
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
                                        style={{ color: textColor }}
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
                                        style={{ color: textColor }}
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
                                        style={{ color: textColor }}
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
                )}
            </Stack>
        </Modal>
    );
}
