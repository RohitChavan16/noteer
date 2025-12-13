import { useState, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Paper, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Box, Center, Button, Checkbox, Text } from '@mantine/core';
import { IconPlus, IconPalette, IconCheckbox, IconNotes, IconGripVertical, IconX } from '@tabler/icons-react';

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

    const getCurrentColor = () => {
        const c = NOTE_COLORS.find(nc => nc.id === color);
        return isDark ? (c?.darkColor || NOTE_COLORS[0].darkColor) : (c?.color || NOTE_COLORS[0].color);
    };

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
                    ? [...items, { content: newItem.trim(), is_checked: false }]
                    : items;

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

    const handleColorSelect = (colorId) => {
        setColor(colorId);
        setShowColors(false);
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
                            <ActionIcon variant="subtle" size="sm" onClick={(e) => { e.stopPropagation(); setMode('checklist'); setIsExpanded(true); }}>
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
                style={{ maxWidth: 550, width: '100%', backgroundColor: getCurrentColor() }}
            >
                <Stack gap="xs">
                    <TextInput
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="unstyled"
                        autoFocus
                        styles={{ input: { fontWeight: 600, fontSize: '1rem' } }}
                    />

                    {mode === 'note' ? (
                        <Textarea
                            placeholder="Take a note..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            variant="unstyled"
                            minRows={3}
                            autosize
                        />
                    ) : (
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
                                <Box w={14} /> {/* Spacer for grip icon */}
                                <IconPlus size={14} style={{ opacity: 0.4 }} />
                                <TextInput
                                    placeholder="List item"
                                    value={newItem}
                                    onChange={(e) => setNewItem(e.target.value)}
                                    onKeyDown={handleItemKeyDown}
                                    variant="unstyled"
                                    size="sm"
                                    style={{ flex: 1 }}
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
                                                onClick={() => handleColorSelect(c.id)}
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

                            <ActionIcon
                                variant={mode === 'note' ? 'filled' : 'subtle'}
                                size="sm"
                                onClick={() => setMode('note')}
                                title="Note"
                            >
                                <IconNotes size={16} />
                            </ActionIcon>
                            <ActionIcon
                                variant={mode === 'checklist' ? 'filled' : 'subtle'}
                                size="sm"
                                onClick={() => setMode('checklist')}
                                title="Checklist"
                            >
                                <IconCheckbox size={16} />
                            </ActionIcon>
                        </Group>

                        <Button variant="subtle" size="xs" onClick={handleSubmit}>
                            Close
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </Center>
    );
}
