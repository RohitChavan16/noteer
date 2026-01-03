import { useState, useRef, useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useMantineColorScheme } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { Paper, TextInput, Group, ActionIcon, Popover, ColorSwatch, Stack, Box, Center, Button, Text, Badge, SimpleGrid, LoadingOverlay, Overlay } from '@mantine/core';
import { IconPlus, IconPalette, IconCheckbox, IconNotes, IconPhoto, IconTrash, IconUpload, IconTypography } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';
import { notifications } from '@mantine/notifications';
import LabelPicker from './LabelPicker';
import NoteRichTextEditor from './NoteRichTextEditor';
import EncryptedImage from './EncryptedImage';
import { logger } from '../utils/logger';

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

export default function NoteInput({ currentLabel }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const [isExpanded, setIsExpanded] = useState(false);
    const [mode, setMode] = useState('note'); // 'note', 'checklist', or 'picture'
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [items, setItems] = useState([]); // For checklist mode
    const [newItem, setNewItem] = useState('');
    const [color, setColor] = useState('default');
    const [showColors, setShowColors] = useState(false);
    const [showFormatting, setShowFormatting] = useState(false);
    const [labels, setLabels] = useState(currentLabel ? [currentLabel] : []);
    const [labelsModalOpen, setLabelsModalOpen] = useState(false);
    const [images, setImages] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const { createNote, uploadImage } = useNotesStore();
    const formRef = useRef(null);
    const isSubmittingRef = useRef(false);
    const openRef = useRef(null);
    const isFilePickerOpenRef = useRef(false);

    // Update labels when currentLabel changes (e.g., navigating to different label filter)
    useEffect(() => {
        setLabels(currentLabel ? [currentLabel] : []);
    }, [currentLabel]);

    const backgroundColor = getNoteColor(color, isDark);
    const textColor = getNoteTextColor(color, isDark);

    // Detect touch device for larger buttons
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const iconSize = isTouchDevice ? 22 : 18;
    const buttonSize = isTouchDevice ? "lg" : "sm";

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

    const handleSubmit = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        try {
            if (mode === 'picture') {
                if (images.length === 0) {
                    resetForm();
                    return;
                }
                await createNote({ title: '', content: '', color, type: 'picture', labels, images });
            } else if (mode === 'note') {
                if (content.length > 60000) {
                    notifications.show({ title: 'Limit reached', message: 'Note content is too long (max 60000 characters).', color: 'red' });
                    return;
                }
                if (!title.trim() && !content.trim() && images.length === 0) {
                    resetForm();
                    return;
                }
                await createNote({ title, content, color, labels, images });
            } else {
                // checklist mode
                const finalItems = newItem.trim()
                    ? [...items, { content: newItem.trim(), is_checked: false, id: generateId() }]
                    : items;

                if (finalItems.length > 200) {
                    notifications.show({ title: 'Limit reached', message: 'Maximum 200 checklist items.', color: 'red' });
                    return;
                }

                if (!title.trim() && finalItems.length === 0 && images.length === 0) {
                    resetForm();
                    return;
                }
                await createNote({ title, items: finalItems, color, type: 'checklist', labels, images });
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
        setShowFormatting(false);
        setMode('note');
        setLabels(currentLabel ? [currentLabel] : []);
        setImages([]);
    };

    const handleBlur = (e) => {
        // Don't blur-save if popover, modal, picture mode, or file picker is open
        if (showColors || labelsModalOpen || mode === 'picture' || isFilePickerOpenRef.current) return;
        if (formRef.current && formRef.current.contains(e.relatedTarget)) return;

        // Small delay to allow for popover interactions and file picker
        setTimeout(() => {
            if (!showColors && !labelsModalOpen && mode !== 'picture' && !isFilePickerOpenRef.current && !isSubmittingRef.current) {
                handleSubmit();
            }
        }, 200);
    };

    const addItem = () => {
        if (newItem.trim()) {
            if (items.length >= 200) {
                notifications.show({ title: 'Limit reached', message: 'Maximum 200 checklist items.', color: 'red' });
                return;
            }
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

    const handleColorSelect = (colorId) => {
        setColor(colorId);
        setShowColors(false);
    };

    const handleDrop = async (files) => {
        // Limit to 2 images total
        const remainingSlots = 2 - images.length;
        if (remainingSlots <= 0) {
            return;
        }
        const filesToUpload = files.slice(0, remainingSlots);

        setIsUploading(true);
        try {
            for (const file of filesToUpload) {
                const uploaded = await uploadImage(file);
                if (uploaded) {
                    setImages(prev => [...prev, uploaded]);
                }
            }
        } catch (error) {
            logger.error('UI', 'Image upload failed', error);
            notifications.show({ title: 'Upload failed', message: 'Failed to upload image', color: 'red' });
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handlePhotoClick = (e) => {
        e.stopPropagation();
        setIsExpanded(true);
        setMode('picture');
    };

    const handleFilePickerOpen = (e) => {
        e?.stopPropagation();
        if (images.length >= 2) return;

        isFilePickerOpenRef.current = true;
        openRef.current?.();

        // Check for focus return to reset the ref
        window.addEventListener('focus', () => {
            setTimeout(() => {
                isFilePickerOpenRef.current = false;
            }, 500);
        }, { once: true });
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
                            <ActionIcon variant="subtle" c="dimmed" size="sm" onClick={handlePhotoClick}>
                                <IconPhoto size={18} />
                            </ActionIcon>
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
                <Dropzone
                    openRef={openRef}
                    onDrop={(files) => {
                        handleDrop(files);
                        // Image-only mode stays in image-only mode after drop
                    }}
                    onReject={(files) => {
                        const errors = files.flatMap(f => f.errors.map(e => e.message));
                        notifications.show({
                            title: 'Upload failed',
                            message: errors.join(', ') || 'Only JPEG, PNG, GIF and WebP images are allowed (max 10MB)',
                            color: 'red',
                            autoClose: 5000
                        });
                    }}
                    accept={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                    maxSize={10 * 1024 * 1024}
                    activateOnClick={false}
                    radius="md"
                    styles={{ root: { border: 'none', backgroundColor: 'transparent', padding: 0, overflow: 'hidden' } }}
                >
                    <Box style={{ position: 'relative' }}>
                        <LoadingOverlay visible={isUploading} overlayProps={{ radius: "sm", blur: 1 }} />
                        <Dropzone.Accept>
                            <Overlay color={isDark ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)"} opacity={0.9} zIndex={10}>
                                <Center h="100%">
                                    <Stack align="center" gap="xs">
                                        <IconUpload size={40} />
                                        <Text size="lg" fw={500}>Drop images here</Text>
                                    </Stack>
                                </Center>
                            </Overlay>
                        </Dropzone.Accept>

                        <Stack gap="xs">
                            {/* Drag & Drop panel - shown in picture mode */}
                            {mode === 'picture' && images.length < 2 && (
                                <Box
                                    p="xl"
                                    style={{
                                        border: '2px dashed var(--mantine-color-blue-5)',
                                        borderRadius: 'var(--mantine-radius-md)',
                                        backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={handleFilePickerOpen}
                                >
                                    <Center>
                                        <Stack align="center" gap="xs">
                                            <IconPhoto size={40} color="var(--mantine-color-blue-5)" />
                                            <Text size="lg" fw={500}>Drag & Drop</Text>
                                            <Text size="sm" c="dimmed">or <Text component="span" c="blue" style={{ cursor: 'pointer' }}>browse</Text></Text>
                                            <Text size="xs" c="dimmed">Supports: JPEG, PNG, GIF, WebP</Text>
                                        </Stack>
                                    </Center>
                                </Box>
                            )}

                            {/* Action buttons for picture mode - only show if no images yet */}
                            {mode === 'picture' && images.length === 0 && (
                                <Group justify="flex-end" gap="xs">
                                    <Button
                                        variant="subtle"
                                        size="xs"
                                        onClick={handleSubmit}
                                        style={{ color: textColor }}
                                    >
                                        Close
                                    </Button>
                                </Group>
                            )}

                            {images.length > 0 && (
                                <SimpleGrid cols={images.length === 1 ? 1 : 2} spacing="xs">
                                    {images.map((img, index) => (
                                        <Box key={index} style={{ position: 'relative', height: 100, overflow: 'hidden' }}>
                                            <EncryptedImage
                                                src={img.thumb_medium || img.url}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                                            />
                                            <ActionIcon
                                                variant="filled"
                                                color="rgba(0,0,0,0.6)"
                                                size="sm"
                                                style={{ position: 'absolute', bottom: 4, right: 4 }}
                                                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                            >
                                                <IconTrash size={14} color="white" />
                                            </ActionIcon>
                                        </Box>
                                    ))}
                                </SimpleGrid>
                            )}

                            {/* Only show title/text fields when NOT in picture mode */}
                            {mode !== 'picture' && (
                                <>
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

                                    {mode === 'note' && (
                                        <NoteRichTextEditor
                                            content={content}
                                            onChange={setContent}
                                            showToolbar={showFormatting}
                                            isDark={isDark}
                                        />
                                    )}
                                </>
                            )}

                            {mode === 'checklist' && (
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

                            {/* Labels badges */}
                            {labels.length > 0 && (
                                <Group gap="xs" mt="xs">
                                    {labels.map((label, idx) => (
                                        <Badge
                                            key={idx}
                                            size="sm"
                                            variant="outline"
                                            tt="none"
                                            style={{ color: textColor, borderColor: textColor, opacity: 0.8 }}
                                        >
                                            {label}
                                        </Badge>
                                    ))}
                                </Group>
                            )}

                            {/* Full toolbar - hide in picture mode completely */}
                            {mode !== 'picture' && (
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
                                            size={buttonSize}
                                            onClick={() => setMode('note')}
                                            title="Note"
                                            style={mode !== 'note' ? { color: textColor } : {}}
                                        >
                                            <IconNotes size={isTouchDevice ? 20 : 16} />
                                        </ActionIcon>
                                        <ActionIcon
                                            variant={mode === 'checklist' ? "filled" : "subtle"}
                                            size={buttonSize}
                                            onClick={() => {
                                                setMode(mode === 'checklist' ? 'note' : 'checklist');
                                                if (mode !== 'checklist') setShowFormatting(false); // Reset formatting on switch
                                            }}
                                            title="New list"
                                            style={{ color: textColor }}
                                        >
                                            <IconCheckbox size={iconSize} />
                                        </ActionIcon>

                                        {mode === 'note' && (
                                            <ActionIcon
                                                variant={showFormatting ? "filled" : "subtle"}
                                                size={buttonSize}
                                                onClick={() => setShowFormatting(!showFormatting)}
                                                title="Formatting options"
                                                style={{ color: textColor }}
                                            >
                                                <IconTypography size={iconSize} />
                                            </ActionIcon>
                                        )}

                                        <LabelPicker
                                            selectedLabels={labels}
                                            onChange={setLabels}
                                            triggerStyle={{ color: textColor }}
                                            onOpenChange={setLabelsModalOpen}
                                            iconSize={iconSize}
                                            buttonSize={buttonSize}
                                        />
                                        <ActionIcon
                                            variant="subtle"
                                            size={buttonSize}
                                            onClick={(e) => {
                                                setMode('picture');
                                                setShowFormatting(false);
                                                handleFilePickerOpen(e);
                                            }}
                                            title={images.length >= 2 ? "Maximum 2 images" : "Add image"}
                                            style={{ color: textColor, opacity: images.length >= 2 ? 0.4 : 1 }}
                                            disabled={images.length >= 2}
                                        >
                                            <IconPhoto size={iconSize} />
                                        </ActionIcon>
                                    </Group>

                                    <Button variant="subtle" size={isTouchDevice ? "sm" : "xs"} onClick={handleSubmit} style={{ color: textColor }}>
                                        Close
                                    </Button>
                                </Group>
                            )}

                            {/* Simple Close button for picture mode with images */}
                            {mode === 'picture' && images.length > 0 && (
                                <Group justify="flex-end" mt="xs">
                                    <Button variant="subtle" size={isTouchDevice ? "sm" : "xs"} onClick={handleSubmit} style={{ color: textColor }}>
                                        Close
                                    </Button>
                                </Group>
                            )}
                        </Stack>
                    </Box>
                </Dropzone>
            </Paper>
        </Center>
    );
}
