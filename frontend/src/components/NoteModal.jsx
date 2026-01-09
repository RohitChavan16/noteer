import { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useLabelsMap } from '../hooks/useLabels';
import { useChecklist } from '../hooks/useChecklist';
import { useNoteImages } from '../hooks/useNoteImages';
import { useMantineColorScheme } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { Modal, TextInput, Group, ActionIcon, Stack, Button, Text, Badge, Collapse, Box, Divider, SimpleGrid, LoadingOverlay, Overlay, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconChevronDown, IconChevronRight, IconUpload, IconTrash, IconUsers } from '@tabler/icons-react';

import { getNoteColor, getNoteTextColor } from '../constants/noteColors';
import { formatDate, getInitials } from '../utils/helpers';
import NoteRichTextEditor from './NoteRichTextEditor';
import ShareModal from './ShareModal';
import EncryptedImage from './EncryptedImage';
import NoteToolbar from './NoteToolbar';
import { Avatar, Tooltip } from '@mantine/core';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import SortableChecklistItem from './SortableChecklistItem';

/**
 * Modal component for creating and editing notes.
 * 
 * Supports:
 * - Text notes
 * - Checklist notes (drag & drop)
 * - Picture notes (upload & view)
 * - Collaboration features (sharing)
 * - Rich text formatting (updates content state)
 * - Image handling via useNoteImages hook
 * 
 * @param {object} props
 * @param {object|null} props.note - Note object to edit, or null. If null, modal is not rendered (but condition usually handled by parent).
 * @param {Function} props.onClose - Callback when modal closes (handles save).
 */
export default function NoteModal({ note, onClose }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const { updateNote } = useNotesStore();
    const labelsMap = useLabelsMap();

    // Form state - initialized from note prop
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || 'default');
    const [labels, setLabels] = useState(note?.labels || []);
    const [isSaving, setIsSaving] = useState(false);
    const [showFormatting, setShowFormatting] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [isShared, setIsShared] = useState(note?.is_shared || false);

    // Track if user has made local edits (to avoid overwriting with external changes)
    const hasLocalEdits = useRef(false);
    const lastUpdatedAt = useRef(note?.updated_at);

    // Sync state when note prop changes (external updates)
    useEffect(() => {
        if (!note || hasLocalEdits.current) return;

        // If updated_at changed, this is an external update (e.g. from sync)
        if (note.updated_at !== lastUpdatedAt.current) {
            setTitle(note.title || '');
            setContent(note.content || '');
            setColor(note.color || 'default');
            setLabels(note.labels || []);
            setIsShared(note.is_shared || false);
            lastUpdatedAt.current = note.updated_at;
        }
    }, [note]);

    // Wrap setters to track local edits
    const handleTitleChange = (e) => {
        const newValue = e.currentTarget.value;
        // Verify it's actually different from current consistent state to avoid false positives
        if (newValue !== title) {
            hasLocalEdits.current = true;
            setTitle(newValue);
        }
    };

    const handleContentChange = (newContent) => {
        // Prevent marking as local edit if content matches what we just synced
        // This is crucial because Tiptap fires onChange when we setContent programmatically
        if (newContent === note?.content && !hasLocalEdits.current) {
            return;
        }

        // Also check against current state to avoid redundant updates
        if (newContent !== content) {
            hasLocalEdits.current = true;
            setContent(newContent);
        }
    };

    // Checklist hook
    const {
        items,
        uncheckedItems,
        checkedItems,
        completedExpanded,
        toggleCompletedExpanded,
        newItemText,
        setNewItemText,
        addItemWithContent,
        removeItem,
        toggleItemCheck,
        updateItemContent,
        handleDragEnd,
    } = useChecklist(note?.items || []);

    // Images hook
    const {
        images,
        isUploading,
        previewImage,
        setPreviewImage,
        openRef,
        handleDrop,
        handleReject,
        removeImage,
        openFilePicker,
        canAddImage,
    } = useNoteImages(note?.images || [], note?.id);

    // Derived state
    const isOwner = note?.is_owner !== false;
    const isPinned = note?.is_owner === false ? note?.share_is_pinned : note?.is_pinned;
    const isChecklist = note?.type === 'checklist' || (note?.items && note.items.length > 0);
    const isPicture = note?.type === 'picture';

    const bgColor = getNoteColor(color, isDark);
    const textColor = getNoteTextColor(color, isDark);

    // Touch device detection
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const iconSize = isTouchDevice ? 26 : 22;
    const buttonSize = isTouchDevice ? 'xl' : 'lg';

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

        await new Promise(r => setTimeout(r, 0));

        const changes = {};
        if (title !== (note?.title || '')) changes.title = title;
        if (content !== (note?.content || '')) changes.content = content;
        if (color !== (note?.color || 'default')) changes.color = color;
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

    const handleClose = () => handleSave();

    const handleItemKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItemWithContent();
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
            overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        >
            <Dropzone
                openRef={openRef}
                onDrop={handleDrop}
                onReject={handleReject}
                accept={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                maxSize={10 * 1024 * 1024}
                activateOnClick={false}
                radius="md"
                styles={{ root: { border: 'none', backgroundColor: 'transparent', padding: 0, overflow: 'visible' } }}
            >
                <Box style={{ position: 'relative' }}>
                    <LoadingOverlay visible={isUploading} overlayProps={{ radius: 'sm', blur: 1 }} />
                    <Dropzone.Accept>
                        <Overlay color={isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)'} opacity={0.9} zIndex={10}>
                            <Center h="100%" style={{ minHeight: 200 }}>
                                <Stack align="center" gap="xs">
                                    <IconUpload size={40} />
                                    <Text size="lg" fw={500}>Drop images here</Text>
                                </Stack>
                            </Center>
                        </Overlay>
                    </Dropzone.Accept>

                    <Stack gap="md">
                        {/* Images Grid */}
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
                                        {/* Hide delete button for picture-only notes with single image */}
                                        {!(isPicture && images.length === 1) && (
                                            <ActionIcon
                                                variant="filled"
                                                color="rgba(0,0,0,0.6)"
                                                size="sm"
                                                style={{ position: 'absolute', bottom: 4, right: 4 }}
                                                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                            >
                                                <IconTrash size={14} color="white" />
                                            </ActionIcon>
                                        )}
                                    </Box>
                                ))}
                            </SimpleGrid>
                        )}

                        {/* Title */}
                        {!isPicture && (
                            <TextInput
                                placeholder="Title"
                                value={title}
                                onChange={handleTitleChange}
                                variant="unstyled"
                                maxLength={200}
                                size="lg"
                                styles={{ input: { fontWeight: 700, fontSize: '1.5rem', color: textColor } }}
                                data-autofocus={!note?.title}
                            />
                        )}

                        {/* Content: Checklist or Rich Text */}
                        {!isPicture && (isChecklist ? (
                            <Stack gap={4}>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                                        {/* Active Items */}
                                        {uncheckedItems.map((item, index) => (
                                            <SortableChecklistItem
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                isDark={isDark}
                                                textColor={textColor}
                                                onToggle={toggleItemCheck}
                                                onRemove={removeItem}
                                                onUpdate={updateItemContent}
                                                onEnter={() => addItemWithContent()}
                                            />
                                        ))}

                                        {/* Completed Items Section */}
                                        {checkedItems.length > 0 && (
                                            <>
                                                <Divider my="xs" label={
                                                    <Group gap={4} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={toggleCompletedExpanded}>
                                                        {completedExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                        <Text size="sm" fw={500}>Completed ({checkedItems.length})</Text>
                                                    </Group>
                                                } labelPosition="left" styles={{ label: { marginLeft: 0 } }} />

                                                <Collapse in={completedExpanded}>
                                                    <Stack gap={4} style={{ opacity: 0.6 }}>
                                                        {checkedItems.map((item, index) => (
                                                            <SortableChecklistItem
                                                                key={item.id}
                                                                item={item}
                                                                index={index}
                                                                isDark={isDark}
                                                                textColor={textColor}
                                                                onToggle={toggleItemCheck}
                                                                onRemove={removeItem}
                                                                onUpdate={updateItemContent}
                                                                onEnter={() => addItemWithContent()}
                                                            />
                                                        ))}
                                                    </Stack>
                                                </Collapse>
                                            </>
                                        )}
                                    </SortableContext>
                                </DndContext>

                                {/* New item input */}
                                <Group align="center" mt="xs">
                                    <IconPlus size={16} style={{ color: textColor, opacity: 0.6 }} />
                                    <TextInput
                                        placeholder="List item"
                                        value={newItemText}
                                        onChange={(e) => setNewItemText(e.currentTarget.value)}
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
                                onChange={handleContentChange}
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

                        {/* Toolbar */}
                        <Group justify="space-between" align="center">
                            <NoteToolbar
                                note={note}
                                onClose={onClose}
                                color={color}
                                setColor={setColor}
                                labels={labels}
                                setLabels={setLabels}
                                showFormatting={showFormatting}
                                setShowFormatting={setShowFormatting}
                                isOwner={isOwner}
                                isPinned={isPinned}
                                isChecklist={isChecklist}
                                isPicture={isPicture}
                                isDark={isDark}
                                textColor={textColor}
                                iconSize={iconSize}
                                buttonSize={buttonSize}
                                canAddImage={canAddImage}
                                onAddImage={openFilePicker}
                                onShareClick={() => setShareModalOpen(true)}
                            />
                        </Group>

                        {/* Date + Collaborators row */}
                        <Group justify="space-between" align="center">
                            <Group gap="xs" align="center">
                                {note.updated_at && (
                                    <Text size="xs" style={{ color: textColor, opacity: 0.6 }}>
                                        Edited {formatDate(note.updated_at)}
                                    </Text>
                                )}
                                {note.owner && (
                                    <Tooltip label={`Owned by ${note.owner.given_name || note.owner.email}`}>
                                        <Avatar src={note.owner.avatar_url} size="sm" radius="xl">
                                            {getInitials(note.owner.given_name, note.owner.family_name)}
                                        </Avatar>
                                    </Tooltip>
                                )}
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
