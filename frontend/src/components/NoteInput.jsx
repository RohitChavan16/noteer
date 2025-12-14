import { useState, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Paper, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Box, Center, Button, Checkbox, Text, Portal } from '@mantine/core';
import { IconPlus, IconPalette, IconCheckbox, IconNotes, IconGripVertical, IconX } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Robust ID generator fallback
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export default function NoteInput() {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const [isExpanded, setIsExpanded] = useState(false);
    const [mode, setMode] = useState('note'); // 'note' or 'checklist'
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [items, setItems] = useState([]); // For checklist mode
    const [newItem, setNewItem] = useState('');
    const [color, setColor] = useState('default');
    const [showColors, setShowColors] = useState(false);
    const { createNote } = useNotesStore();
    const formRef = useRef(null);
    const isSubmittingRef = useRef(false);

    const backgroundColor = getNoteColor(color, isDark);
    const textColor = getNoteTextColor(color, isDark);

    const handleSubmit = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        try {
            if (mode === 'note') {
                if (!title.trim() && !content.trim()) {
                    resetForm();
                    return;
                }
                await createNote({ title, content, color });
            } else {
                // Include newItem if user was typing when they clicked away
                const finalItems = newItem.trim()
                    ? [...items, { content: newItem.trim(), is_checked: false, id: generateId() }]
                    : items;

                // Clean up IDs before sending if backend doesn't expect them?
                // Actually keeping them is fine for consistency, but backend might strip them or store them.
                // Let's rely on backend storing whatever we send in JSONB.
                if (!title.trim() && finalItems.length === 0) {
                    resetForm();
                    return;
                }
                await createNote({ title, items: finalItems, color, type: 'checklist' });
            }
            resetForm();
        } finally {
            isSubmittingRef.current = false;
        }
    };


    const resetForm = () => {
        setTitle('');
        setContent('');
        setItems([]);
        setNewItem('');
        setColor('default');
        setIsExpanded(false);
        setShowColors(false);
        setMode('note');
    };

    const handleBlur = (e) => {
        // Don't blur-save if popover is open or click was inside the form
        if (showColors) return;
        if (formRef.current && formRef.current.contains(e.relatedTarget)) return;

        // Small delay to allow for popover interactions
        setTimeout(() => {
            if (!showColors && !isSubmittingRef.current) {
                handleSubmit();
            }
        }, 100);
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

    const handleColorSelect = (colorId) => {
        setColor(colorId);
        setShowColors(false);
    };

    const renderItem = (item, index, provided, snapshot) => {
        // "Selected" state is active only when dragging BUT NOT when dropping (animating to home)
        // This makes the item satisfy the user request to "unselect" immediately on release
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

    if (!isExpanded) {
        return (
            <Center mb="xl">
                <Paper
                    shadow="md"
                    radius="xl"
                    p="sm"
                    px="lg"
                    withBorder
                    onClick={() => setIsExpanded(true)}
                    style={{ cursor: 'text', maxWidth: 550, width: '100%' }}
                >
                    <Group justify="space-between">
                        <Text c="dimmed">Take a note...</Text>
                        <Group gap="xs">
                            <ActionIcon variant="subtle" c="dimmed" size="sm" onClick={(e) => { e.stopPropagation(); setMode('checklist'); setIsExpanded(true); }}>
                                <IconCheckbox size={18} />
                            </ActionIcon>
                            <IconPlus size={18} color="var(--mantine-color-dimmed)" />
                        </Group>
                    </Group>
                </Paper>
            </Center>
        );
    }

    return (
        <Center mb="xl">
            <Paper
                ref={formRef}
                shadow="lg"
                radius="md"
                p="md"
                withBorder
                onBlur={handleBlur}
                tabIndex={-1}
                style={{
                    maxWidth: 550,
                    width: '100%',
                    backgroundColor: backgroundColor,
                    color: textColor
                }}
            >
                <Stack gap="xs">
                    <TextInput
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="unstyled"
                        autoFocus
                        maxLength={200}
                        styles={{
                            input: {
                                fontWeight: 600,
                                fontSize: '1rem',
                                color: textColor
                            }
                        }}
                    />

                    {mode === 'note' ? (
                        <Textarea
                            placeholder="Take a note..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            variant="unstyled"
                            minRows={3}
                            autosize
                            styles={{ input: { color: textColor } }}
                        />
                    ) : (
                        <Stack gap={4}>
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable
                                    droppableId="checklist-items"
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
                                <Box w={14} /> {/* Spacer for grip icon */}
                                <IconPlus size={14} style={{ opacity: 0.4, color: textColor }} />
                                <TextInput
                                    placeholder="List item"
                                    value={newItem}
                                    onChange={(e) => setNewItem(e.target.value)}
                                    onKeyDown={handleItemKeyDown}
                                    variant="unstyled"
                                    size="sm"
                                    maxLength={500}
                                    style={{ flex: 1 }}
                                    styles={{ input: { color: textColor } }}
                                />
                            </Group>
                        </Stack>
                    )}

                    <Group justify="space-between" mt="xs">
                        <Group gap="xs">
                            <Popover
                                opened={showColors}
                                onChange={setShowColors}
                                position="top-start"
                                trapFocus
                                withinPortal={false}
                            >
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
                                                onClick={() => handleColorSelect(c.id)}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: color === c.id
                                                        ? '2px solid var(--mantine-color-blue-5)'
                                                        : `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-5)'}`
                                                }}
                                                size={24}
                                            />
                                        ))}
                                    </Group>
                                </Popover.Dropdown>
                            </Popover>

                            <ActionIcon
                                variant={mode === 'note' ? 'filled' : 'subtle'}
                                size="sm"
                                onClick={() => setMode('note')}
                                title="Note"
                                style={mode !== 'note' ? { color: textColor } : {}}
                            >
                                <IconNotes size={16} />
                            </ActionIcon>
                            <ActionIcon
                                variant={mode === 'checklist' ? 'filled' : 'subtle'}
                                size="sm"
                                onClick={() => setMode('checklist')}
                                title="Checklist"
                                style={mode !== 'checklist' ? { color: textColor } : {}}
                            >
                                <IconCheckbox size={16} />
                            </ActionIcon>
                        </Group>

                        <Button variant="subtle" size="xs" onClick={handleSubmit} style={{ color: textColor }}>
                            Close
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </Center>
    );
}
