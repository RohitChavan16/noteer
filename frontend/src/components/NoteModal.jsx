import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Modal, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Button, Checkbox, Text, Box, Portal } from '@mantine/core';
import { IconPalette, IconGripVertical, IconPlus, IconX, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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

    const handleSave = async () => {
        if (isSaving) return;

        // Clean IDs if needed? Backend handles it fine typically. 
        // We compare content/completeness mainly.
        // Simple dirty check might flag 'id' change as change, which is fine, we want to save order.
        const currentItemsStr = JSON.stringify(items.map(({ id, ...rest }) => rest)); // Compare without IDs for content check, or with IDs?
        // Actually, logic is:
        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default') ||
            JSON.stringify(items) !== JSON.stringify(note?.items || []);

        // Note: strict JSON comparison might need normalization if IDs were added.
        // But since we WANT to save the new order (which results in new JSON array), 
        // and we added IDs, we should just save it. 
        // If we added IDs to existing items that didn't have them, that counts as a "change" worth saving 
        // so they persist.

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, {
                title,
                content,
                color,
                items,
                is_pinned: note.is_pinned,
                is_archived: note.is_archived,
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

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const newItems = Array.from(items);
        const [reorderedItem] = newItems.splice(result.source.index, 1);
        newItems.splice(result.destination.index, 0, reorderedItem);

        setItems(newItems);
    };

    if (!note) return null;

    const renderItem = (item, index, provided, snapshot) => {
        const isLifted = snapshot.isDragging && !snapshot.isDropAnimating;

        return (
            <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                style={{
                    ...provided.draggableProps.style,
                    boxSizing: 'border-box',
                    transition: snapshot.isDragging ? 'box-shadow 0.2s, background-color 0.2s' : 'none',

                    backgroundColor: snapshot.isDragging ? backgroundColor : 'transparent',
                    color: textColor,
                    borderRadius: '4px',
                    boxShadow: isLifted ? '0 8px 16px rgba(0,0,0,0.2)' : 'none',
                    opacity: 1,
                    zIndex: snapshot.isDragging ? 9999 : 'auto',
                }}
            >
                <Group gap="xs" wrap="nowrap" mb={4} align="center">
                    <div
                        {...provided.dragHandleProps}
                        style={{
                            ...provided.dragHandleProps.style,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'grab',
                            touchAction: 'none',
                            height: '32px',
                            width: '24px',
                            marginLeft: '-4px',
                            WebkitTapHighlightColor: 'transparent'
                        }}
                    >
                        <IconGripVertical size={16} style={{ opacity: 0.4, color: textColor }} />
                    </div>
                    <Checkbox
                        checked={item.is_checked}
                        onChange={() => toggleItemCheck(index)}
                        size="xs"
                        color={textColor === '#000000' ? 'dark' : 'blue'}
                        style={{ pointerEvents: snapshot.isDragging ? 'none' : 'auto' }}
                    />
                    <TextInput
                        value={item.content}
                        onChange={(e) => updateItemContent(index, e.target.value)}
                        variant="unstyled"
                        size="sm"
                        maxLength={500}
                        style={{ flex: 1, pointerEvents: snapshot.isDragging ? 'none' : 'auto' }}
                        styles={{
                            input: {
                                textDecoration: item.is_checked ? 'line-through' : 'none',
                                opacity: item.is_checked ? 0.6 : 1,
                                color: textColor
                            }
                        }}
                    />
                    <ActionIcon
                        variant="subtle"
                        size="xs"
                        onClick={() => removeItem(index)}
                        style={{ color: textColor, pointerEvents: snapshot.isDragging ? 'none' : 'auto' }}
                    >
                        <IconX size={12} />
                    </ActionIcon>
                </Group>
            </div>
        );
    };

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
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable
                                droppableId="modal-checklist-items"
                                renderClone={(provided, snapshot, rubric) => (
                                    <Portal>
                                        {renderItem(items[rubric.source.index], rubric.source.index, provided, snapshot)}
                                    </Portal>
                                )}
                            >
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {items.map((item, index) => (
                                            <Draggable
                                                key={item.id}
                                                draggableId={item.id}
                                                index={index}
                                            >
                                                {(provided, snapshot) => renderItem(item, index, provided, snapshot)}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>

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
            </Stack>
        </Modal>
    );
}
