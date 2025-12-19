import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Modal, TextInput, Group, ActionIcon, Popover, ColorSwatch, Stack, Button, Text, Badge, Menu } from '@mantine/core';
import { IconPalette, IconPlus, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash, IconTypography, IconRestore, IconDotsVertical } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';
import NoteRichTextEditor from './NoteRichTextEditor';
import LabelPicker from './LabelPicker';

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
    const [showFormatting, setShowFormatting] = useState(false);

    // Ensure items have IDs for drag and drop
    const [items, setItems] = useState(() =>
        (note?.items || []).map(item => ({ ...item, id: item.id || generateId() }))
    );

    const [color, setColor] = useState(note?.color || 'default');
    const [isSaving, setIsSaving] = useState(false);
    const [newItem, setNewItem] = useState('');
    const [showColors, setShowColors] = useState(false);
    const [labels, setLabels] = useState(note?.labels || []);

    const isChecklist = note?.type === 'checklist' || (note?.items && note.items.length > 0);

    const bgColor = getNoteColor(color, isDark);
    const textColor = getNoteTextColor(color, isDark);

    // Detect touch device
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const iconSize = isTouchDevice ? 26 : 22;
    const buttonSize = isTouchDevice ? "xl" : "lg";

    // DnD Kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleSave = async () => {
        if (isSaving) return;

        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default') ||
            JSON.stringify(items) !== JSON.stringify(note?.items || []) ||
            JSON.stringify(labels.sort()) !== JSON.stringify((note?.labels || []).sort());

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, {
                title,
                content,
                color,
                items,
                labels,
                // Don't convert status fields back to stale props
                type: note.type
            });
            setIsSaving(false);
        }
        onClose();
    };

    const handleClose = () => {
        handleSave();
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
            onClose={handleClose}
            size="lg"
            centered
            radius="md"
            padding="lg"
            styles={{
                content: { backgroundColor: bgColor, color: textColor },
                header: { backgroundColor: bgColor, color: textColor },
                body: { backgroundColor: bgColor, color: textColor }
            }}
            withCloseButton={false}
            overlayProps={{
                backgroundOpacity: 0.55,
                blur: 3,
            }}
        >
            <Stack gap="md">
                <TextInput
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    variant="unstyled"
                    maxLength={200}
                    size="lg"
                    styles={{ input: { fontWeight: 700, fontSize: '1.5rem', color: textColor } }}
                    data-autofocus={!note?.title}
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
                                        isDark={isDark}
                                        textColor={textColor}
                                        onToggle={() => toggleItemCheck(index)}
                                        onRemove={() => removeItem(index)}
                                        onUpdateContent={(content) => updateItemContent(index, content)}
                                        onEnter={() => addItem()}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        <Group align="center" mt="xs">
                            <IconPlus size={16} style={{ color: textColor, opacity: 0.6 }} />
                            <TextInput
                                placeholder="List item"
                                value={newItem}
                                onChange={(e) => setNewItem(e.currentTarget.value)}
                                onKeyDown={handleItemKeyDown}
                                variant="unstyled"
                                size="sm"
                                maxLength={500}
                                style={{ flex: 1 }}
                                styles={{ input: { color: textColor } }}
                            />
                        </Group>
                    </Stack>
                ) : (
                    <NoteRichTextEditor
                        content={content}
                        onChange={setContent}
                        showToolbar={showFormatting}
                        isDark={isDark}
                    />
                )}

                {/* Labels badges */}
                {labels.length > 0 && (
                    <Group gap="xs" mt="xs">
                        {labels.map((label, idx) => (
                            <Badge key={idx} size="md" variant="light" tt="none">
                                {label}
                            </Badge>
                        ))}
                    </Group>
                )}

                <Group justify="space-between" align="center">
                    <Group gap="xs">
                        <Popover opened={showColors} onChange={setShowColors} position="top-start" shadow="md" width={200}>
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
                                <Group gap="xs" wrap="wrap">
                                    {Object.entries(NOTE_COLORS).map(([name, c]) => (
                                        <ColorSwatch
                                            key={name}
                                            color={isDark ? c.dark : c.light}
                                            onClick={() => { setColor(name); setShowColors(false); }}
                                            style={{
                                                cursor: 'pointer',
                                                border: color === name ? `2px solid ${isDark ? '#fff' : '#000'}` : '1px solid rgba(0,0,0,0.1)'
                                            }}
                                            size={24}
                                        />
                                    ))}
                                </Group>
                            </Popover.Dropdown>
                        </Popover>

                        {!isChecklist && (
                            <ActionIcon
                                variant={showFormatting ? "filled" : "subtle"}
                                title="Formatting options"
                                style={{ color: showFormatting && isDark ? '#fff' : textColor }}
                                onClick={() => setShowFormatting(!showFormatting)}
                                size={buttonSize}
                            >
                                <IconTypography size={iconSize} />
                            </ActionIcon>
                        )}

                        <LabelPicker
                            selectedLabels={labels}
                            onChange={setLabels}
                            triggerStyle={{ color: textColor }}
                        />

                        {!note.is_trashed && (
                            <>
                                <ActionIcon
                                    variant="subtle"
                                    size={buttonSize}
                                    onClick={() => updateNote(note.id, { is_pinned: !note.is_pinned })}
                                    title={note.is_pinned ? "Unpin" : "Pin"}
                                    style={{ color: textColor }}
                                >
                                    {note.is_pinned ? <IconPinFilled size={iconSize} /> : <IconPin size={iconSize} />}
                                </ActionIcon>

                                <ActionIcon
                                    variant="subtle"
                                    size={buttonSize}
                                    onClick={() => {
                                        note.is_archived ? unarchiveNote(note.id) : archiveNote(note.id);
                                        onClose();
                                    }}
                                    title={note.is_archived ? "Unarchive" : "Archive"}
                                    style={{ color: textColor }}
                                >
                                    {note.is_archived ? <IconArchiveOff size={iconSize} /> : <IconArchive size={iconSize} />}
                                </ActionIcon>

                                {/* 3-dot menu for less common actions */}
                                <Menu shadow="md" width={200} position="top-end">
                                    <Menu.Target>
                                        <ActionIcon
                                            variant="subtle"
                                            size={buttonSize}
                                            title="More options"
                                            style={{ color: textColor }}
                                        >
                                            <IconDotsVertical size={iconSize} />
                                        </ActionIcon>
                                    </Menu.Target>

                                    <Menu.Dropdown>
                                        <Menu.Item
                                            color="red"
                                            leftSection={<IconTrash size={14} />}
                                            onClick={() => {
                                                trashNote(note.id);
                                                onClose();
                                            }}
                                        >
                                            Move to trash
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            </>
                        )}

                        {note.is_trashed && (
                            <>
                                <ActionIcon
                                    variant="subtle"
                                    size={buttonSize}
                                    onClick={() => {
                                        restoreNote(note.id);
                                        onClose();
                                    }}
                                    title="Restore"
                                    style={{ color: textColor }}
                                >
                                    <IconRestore size={iconSize} />
                                </ActionIcon>
                                <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    size={buttonSize}
                                    onClick={() => {
                                        deleteNote(note.id);
                                        onClose();
                                    }}
                                    title="Delete forever"
                                >
                                    <IconTrash size={iconSize} />
                                </ActionIcon>
                            </>
                        )}
                    </Group>
                </Group>

                {/* Date and Close on same row */}
                <Group justify="space-between" align="center">
                    {note.updated_at ? (
                        <Text size="xs" style={{ color: textColor, opacity: 0.6 }}>
                            Edited {formatDate(note.updated_at)}
                        </Text>
                    ) : (
                        <div />
                    )}
                    <Button variant="subtle" size="compact-sm" onClick={handleSave} loading={isSaving} style={{ color: textColor }}>
                        Close
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
