import { useState, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useAuthStore } from '../stores/authStore';
import { useEncryptionStore } from '../stores/encryptionStore';
import { useLabelsMap } from '../hooks/useLabels';
import { useMantineColorScheme } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { Modal, TextInput, Group, ActionIcon, Popover, ColorSwatch, Stack, Button, Text, Badge, Menu, Avatar, Tooltip, Collapse, Box, Divider, SimpleGrid, LoadingOverlay, Overlay, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPalette, IconPlus, IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash, IconTypography, IconRestore, IconDotsVertical, IconShare, IconUserMinus, IconUsers, IconChevronDown, IconChevronRight, IconPhoto, IconUpload } from '@tabler/icons-react';

import { NOTE_COLORS, getNoteColor, getNoteTextColor } from '../constants/noteColors';
import { formatDate, getInitials, generateId } from '../utils/helpers';
import NoteRichTextEditor from './NoteRichTextEditor';
import LabelPicker from './LabelPicker';
import ShareModal from './ShareModal';
import EncryptedImage from './EncryptedImage';

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

export default function NoteModal({ note, onClose }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const { updateNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote, uploadImage } = useNotesStore();
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [images, setImages] = useState(note?.images || []);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const openRef = useRef(null);
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
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [isShared, setIsShared] = useState(note?.is_shared || false);
    const { authFetch, user } = useAuthStore();
    const labelsMap = useLabelsMap();

    const [completedExpanded, setCompletedExpanded] = useState(() => {
        if (typeof window === 'undefined') return true;
        try {
            const stored = localStorage.getItem('noteer-checklist-completed-expanded');
            return stored !== null ? JSON.parse(stored) : true;
        } catch { return true; }
    });

    const toggleCompletedExpanded = () => {
        setCompletedExpanded(prev => {
            const newVal = !prev;
            localStorage.setItem('noteer-checklist-completed-expanded', JSON.stringify(newVal));
            return newVal;
        });
    };

    // Check if current user is the owner
    const isOwner = note?.is_owner !== false; // Default to true if not set (owned notes)

    // Helper to get correct pinned state (owner uses notes.is_pinned, recipient uses note_shares.is_pinned)
    const isPinned = note?.is_owner === false ? note?.share_is_pinned : note?.is_pinned;

    const isChecklist = note?.type === 'checklist' || (note?.items && note.items.length > 0);

    // Check if this is a picture-only note
    const isPicture = note?.type === 'picture';

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

        // Validation
        if (!isChecklist && content.length > 60000) {
            notifications.show({ title: 'Limit reached', message: 'Note content is too long (max 60000 characters).', color: 'red' });
            return;
        }
        if (isChecklist && items.length > 200) {
            notifications.show({ title: 'Limit reached', message: 'Maximum 200 checklist items.', color: 'red' });
            return;
        }

        // Check for specific field changes to enable partial updates (merging)
        const changes = {};

        if (title !== (note?.title || '')) changes.title = title;
        if (content !== (note?.content || '')) changes.content = content;
        if (color !== (note?.color || 'default')) changes.color = color;

        // Check array changes using JSON stringify
        if (JSON.stringify(items) !== JSON.stringify(note?.items || [])) changes.items = items;

        const currentLabels = [...labels].sort();
        const originalLabels = [...(note?.labels || [])].sort();
        if (JSON.stringify(currentLabels) !== JSON.stringify(originalLabels)) changes.labels = labels;

        if (JSON.stringify(images) !== JSON.stringify(note?.images || [])) changes.images = images;

        if (Object.keys(changes).length > 0) {
            setIsSaving(true);
            await updateNote(note.id, changes);
            setIsSaving(false);
        }
        onClose();
    };

    const handleClose = () => {
        handleSave();
    };

    const addItem = () => {
        if (newItem.trim()) {
            if (items.length >= 200) {
                notifications.show({ title: 'Limit reached', message: 'Maximum 200 checklist items.', color: 'red' });
                return;
            }
            const itemToAdd = { content: newItem.trim(), is_checked: false, id: generateId() };
            setItems(currentItems => {
                const firstCheckedIndex = currentItems.findIndex(i => i.is_checked);
                if (firstCheckedIndex === -1) {
                    return [...currentItems, itemToAdd];
                }
                const newItems = [...currentItems];
                newItems.splice(firstCheckedIndex, 0, itemToAdd);
                return newItems;
            });
            setNewItem('');
        }
    };

    const handleItemKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    };

    const removeItem = (id) => {
        setItems(items.filter((item) => item.id !== id));
    };

    const toggleItemCheck = (id) => {
        setItems((currentItems) => {
            const itemIndex = currentItems.findIndex(i => i.id === id);
            if (itemIndex === -1) return currentItems;

            const item = currentItems[itemIndex];
            const newItem = { ...item, is_checked: !item.is_checked };

            const newItems = [...currentItems];
            newItems.splice(itemIndex, 1);

            if (newItem.is_checked) {
                // Moving to completed logic
                newItems.push(newItem);
            } else {
                // Moving back to active list logic
                const firstCheckedIndex = newItems.findIndex(i => i.is_checked);
                if (firstCheckedIndex === -1) {
                    newItems.push(newItem);
                } else {
                    newItems.splice(firstCheckedIndex, 0, newItem);
                }
            }
            return newItems;
        });
    };

    const updateItemContent = (id, content) => {
        setItems(items.map((item) => item.id === id ? { ...item, content } : item));
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

    const handleDrop = async (files) => {
        // Limit to 2 images total
        const remainingSlots = 2 - images.length;
        if (remainingSlots <= 0) {
            return;
        }
        const filesToUpload = files.slice(0, remainingSlots);

        setIsUploading(true);
        try {
            const { isUnlocked, encryptImage: encryptImageFn } = useEncryptionStore.getState();

            for (const file of filesToUpload) {
                let fileToUpload = file;
                let encryptionIv = null;

                // Encrypt image if encryption is unlocked and note has been saved
                if (isUnlocked && note?.id) {
                    try {
                        const { encryptedBlob, iv } = await encryptImageFn(file, note.id);
                        fileToUpload = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });
                        encryptionIv = iv;
                    } catch (encError) {
                        console.warn('Image encryption failed, uploading unencrypted:', encError);
                        // Fall back to unencrypted upload
                    }
                }

                const uploaded = await uploadImage(fileToUpload);
                if (uploaded) {
                    // Store encryption IV with image metadata
                    if (encryptionIv) {
                        uploaded.encryption_iv = encryptionIv;
                    }
                    setImages(prev => [...prev, uploaded]);
                }
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: 'Upload failed', message: 'Failed to upload image', color: 'red' });
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
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
            <Dropzone
                openRef={openRef}
                onDrop={handleDrop}
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
                styles={{ root: { border: 'none', backgroundColor: 'transparent', padding: 0, overflow: 'visible' } }}
            >
                <Box style={{ position: 'relative' }}>
                    <LoadingOverlay visible={isUploading} overlayProps={{ radius: "sm", blur: 1 }} />
                    <Dropzone.Accept>
                        <Overlay color={isDark ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)"} opacity={0.9} zIndex={10}>
                            <Center h="100%" style={{ minHeight: 200 }}>
                                <Stack align="center" gap="xs">
                                    <IconUpload size={40} />
                                    <Text size="lg" fw={500}>Drop images here</Text>
                                </Stack>
                            </Center>
                        </Overlay>
                    </Dropzone.Accept>

                    <Stack gap="md">
                        {images.length > 0 && (
                            <SimpleGrid
                                cols={images.length === 1 ? 1 : 2}
                                spacing={1}
                                style={{
                                    margin: 'calc(-1 * var(--mantine-spacing-lg))',
                                    marginBottom: 'var(--mantine-spacing-lg)',
                                    width: 'calc(100% + 2 * var(--mantine-spacing-lg))',
                                }}
                            >
                                {images.map((img, index) => (
                                    <Box key={index} style={{
                                        position: 'relative',
                                        height: isPicture ? 300 : 150,
                                        cursor: 'zoom-in',
                                        overflow: 'hidden'
                                    }} onClick={() => setPreviewImage(img)}>
                                        <EncryptedImage
                                            src={img.thumb_medium || img.url}
                                            noteId={note.id}
                                            encryptionIv={img.encryption_iv}
                                            originalName={img.original_name}
                                            radius={0}
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

                        {/* Hide title field for picture-only notes */}
                        {!isPicture && (
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
                        )}

                        {/* Hide content fields for picture-only notes */}
                        {!isPicture && (isChecklist ? (
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
                                        {/* Active Items */}
                                        {items.filter(i => !i.is_checked).map((item, index) => (
                                            <SortableChecklistItem
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                isDark={isDark}
                                                textColor={textColor}
                                                onToggle={toggleItemCheck}
                                                onRemove={removeItem}
                                                onUpdate={updateItemContent}
                                                onEnter={() => addItem()}
                                            />
                                        ))}

                                        {/* Completed Items Section */}
                                        {items.some(i => i.is_checked) && (
                                            <>
                                                <Divider my="xs" label={
                                                    <Group gap={4} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={toggleCompletedExpanded}>
                                                        {completedExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                        <Text size="sm" fw={500}>Completed ({items.filter(i => i.is_checked).length})</Text>
                                                    </Group>
                                                } labelPosition="left" styles={{ label: { marginLeft: 0 } }} />

                                                <Collapse in={completedExpanded}>
                                                    <Stack gap={4} style={{ opacity: 0.6 }}>
                                                        {items.filter(i => i.is_checked).map((item, index) => (
                                                            <SortableChecklistItem
                                                                key={item.id}
                                                                item={item}
                                                                index={index}
                                                                isDark={isDark}
                                                                textColor={textColor}
                                                                onToggle={toggleItemCheck}
                                                                onRemove={removeItem}
                                                                onUpdate={updateItemContent}
                                                                onEnter={() => addItem()}
                                                            />
                                                        ))}
                                                    </Stack>
                                                </Collapse>
                                            </>
                                        )}
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
                        ))}

                        {/* Labels badges */}
                        {labels.length > 0 && (
                            <Group gap="xs" mt="xs">
                                {labels.map((label, idx) => (
                                    <Badge
                                        key={idx}
                                        size="md"
                                        variant="outline"
                                        tt="none"
                                        style={{ color: textColor, borderColor: textColor, opacity: 0.8 }}
                                    >
                                        {labelsMap?.get(label) || label}
                                    </Badge>
                                ))}
                            </Group>
                        )}

                        <Group justify="space-between" align="center">
                            <Group gap="xs">
                                {!isPicture && (
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
                                                {NOTE_COLORS.map((c) => (
                                                    <ColorSwatch
                                                        key={c.id}
                                                        color={isDark ? c.dark : c.light}
                                                        onClick={() => { setColor(c.id); setShowColors(false); }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: color === c.id ? `2px solid ${isDark ? '#fff' : '#000'}` : '1px solid rgba(0,0,0,0.1)'
                                                        }}
                                                        size={24}
                                                    />
                                                ))}
                                            </Group>
                                        </Popover.Dropdown>
                                    </Popover>
                                )}

                                {!isChecklist && !isPicture && (
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

                                <ActionIcon
                                    variant="subtle"
                                    title={images.length >= 2 ? "Maximum 2 images" : "Add image"}
                                    style={{ color: textColor, opacity: images.length >= 2 ? 0.4 : 1 }}
                                    onClick={() => images.length < 2 && openRef.current?.()}
                                    size={buttonSize}
                                    disabled={images.length >= 2}
                                >
                                    <IconPhoto size={iconSize} />
                                </ActionIcon>

                                <LabelPicker
                                    selectedLabels={labels}
                                    onChange={setLabels}
                                    triggerStyle={{ color: textColor }}
                                    iconSize={iconSize}
                                    buttonSize={buttonSize}
                                />

                                {/* Share button - only for owner */}
                                {isOwner && !note.is_trashed && (
                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={() => setShareModalOpen(true)}
                                        title="Share"
                                        style={{ color: textColor }}
                                    >
                                        <IconShare size={iconSize} />
                                    </ActionIcon>
                                )}

                                {!note.is_trashed && (
                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={() => updateNote(note.id, { is_pinned: !isPinned })}
                                        title={isPinned ? "Unpin" : "Pin"}
                                        style={{ color: textColor }}
                                    >
                                        {isPinned ? <IconPinFilled size={iconSize} /> : <IconPin size={iconSize} />}
                                    </ActionIcon>
                                )}

                                {!note.is_trashed && isOwner && (
                                    <>

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

                                        {/* 3-dot menu for less common actions - only for owner */}
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

                                {/* Archive for shared notes (recipients) */}
                                {!note.is_trashed && !isOwner && (
                                    <ActionIcon
                                        variant="subtle"
                                        size={buttonSize}
                                        onClick={() => {
                                            note.share_is_archived ? unarchiveNote(note.id) : archiveNote(note.id);
                                            onClose();
                                        }}
                                        title={note.share_is_archived ? "Unarchive" : "Archive"}
                                        style={{ color: textColor }}
                                    >
                                        {note.share_is_archived ? <IconArchiveOff size={iconSize} /> : <IconArchive size={iconSize} />}
                                    </ActionIcon>
                                )}

                                {/* For shared notes (not owner): Remove from my notes */}
                                {!isOwner && !note.is_trashed && (
                                    <ActionIcon
                                        variant="subtle"
                                        color="red"
                                        size={buttonSize}
                                        onClick={async () => {
                                            // Unshare self
                                            try {
                                                await authFetch(`/api/notes/${note.id}/share/${user.id}`, {
                                                    method: 'DELETE'
                                                });
                                            } catch (e) {
                                                console.error('Failed to unshare:', e);
                                            }
                                            onClose();
                                            // Note: useLiveQuery automatically updates UI when data changes
                                        }}
                                        title="Remove from my notes"
                                    >
                                        <IconUserMinus size={iconSize} />
                                    </ActionIcon>
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

                        {/* Date + Collaborators row */}
                        <Group justify="space-between" align="center">
                            <Group gap="xs" align="center">
                                {note.updated_at && (
                                    <Text size="xs" style={{ color: textColor, opacity: 0.6 }}>
                                        Edited {formatDate(note.updated_at)}
                                    </Text>
                                )}

                                {/* Show owner avatar for shared notes */}
                                {note.owner && (
                                    <Tooltip label={`Owned by ${note.owner.given_name || note.owner.email}`}>
                                        <Avatar src={note.owner.avatar_url} size="sm" radius="xl">
                                            {getInitials(note.owner.given_name, note.owner.family_name)}
                                        </Avatar>
                                    </Tooltip>
                                )}

                                {/* Shared with others indicator for owner */}
                                {isShared && isOwner && (
                                    <Tooltip label="Shared with others">
                                        <IconUsers size={14} style={{ color: textColor, opacity: 0.7 }} />
                                    </Tooltip>
                                )}
                            </Group>
                            <Button variant="subtle" size="compact-sm" onClick={handleSave} loading={isSaving} style={{ color: textColor }}>
                                Close
                            </Button>
                        </Group>
                    </Stack>
                </Box>
            </Dropzone>

            <ShareModal
                opened={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                note={note}
                onShareChange={(collabCount) => setIsShared(collabCount > 0)}
            />

            <Modal opened={!!previewImage} onClose={() => setPreviewImage(null)} size="auto" centered withCloseButton={false} p={0} styles={{ body: { padding: 0 }, header: { display: 'none' }, content: { backgroundColor: 'transparent', boxShadow: 'none' } }}>
                {previewImage && (
                    <EncryptedImage
                        src={previewImage.url || previewImage}
                        noteId={note?.id}
                        encryptionIv={previewImage.encryption_iv}
                        originalName={previewImage.original_name}
                        style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
                    />
                )}
            </Modal>
        </Modal>
    );
}
