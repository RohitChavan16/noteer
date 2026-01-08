import { useState } from 'react';
import { Group, ActionIcon, Popover, ColorSwatch, Menu } from '@mantine/core';
import {
    IconPalette,
    IconPin,
    IconPinFilled,
    IconArchive,
    IconArchiveOff,
    IconTrash,
    IconTypography,
    IconRestore,
    IconDotsVertical,
    IconShare,
    IconUserMinus,
    IconPhoto,
} from '@tabler/icons-react';

import { NOTE_COLORS } from '../constants/noteColors';
import LabelPicker from './LabelPicker';
import { useAuthStore } from '../stores/authStore';
import { useNotesStore } from '../stores/notesStore';
import { logger } from '../utils/logger';

/**
 * Bottom toolbar for NoteModal with all action buttons
 * Extracted from NoteModal to reduce component complexity
 */
export default function NoteToolbar({
    note,
    onClose,
    // State
    color,
    setColor,
    labels,
    setLabels,
    showFormatting,
    setShowFormatting,
    // Flags
    isOwner,
    isPinned,
    isChecklist,
    isPicture,
    // Style
    isDark,
    textColor,
    iconSize = 22,
    buttonSize = 'lg',
    // Image handling
    canAddImage,
    onAddImage,
    // Share
    onShareClick,
}) {
    const [showColors, setShowColors] = useState(false);
    const { updateNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote } = useNotesStore();
    const { authFetch, user } = useAuthStore();

    return (
        <Group gap="xs">
            {/* Color picker - hide for picture notes */}
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

            {/* Formatting toggle - only for rich text notes */}
            {!isChecklist && !isPicture && (
                <ActionIcon
                    variant={showFormatting ? 'filled' : 'subtle'}
                    title="Formatting options"
                    style={{ color: showFormatting && isDark ? '#fff' : textColor }}
                    onClick={() => setShowFormatting(!showFormatting)}
                    size={buttonSize}
                >
                    <IconTypography size={iconSize} />
                </ActionIcon>
            )}

            {/* Add image button */}
            <ActionIcon
                variant="subtle"
                title={canAddImage ? 'Add image' : 'Maximum 2 images'}
                style={{ color: textColor, opacity: canAddImage ? 1 : 0.4 }}
                onClick={onAddImage}
                size={buttonSize}
                disabled={!canAddImage}
            >
                <IconPhoto size={iconSize} />
            </ActionIcon>

            {/* Label picker */}
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
                    onClick={onShareClick}
                    title="Share"
                    style={{ color: textColor }}
                >
                    <IconShare size={iconSize} />
                </ActionIcon>
            )}

            {/* Pin button */}
            {!note.is_trashed && (
                <ActionIcon
                    variant="subtle"
                    size={buttonSize}
                    onClick={() => updateNote(note.id, { is_pinned: !isPinned })}
                    title={isPinned ? 'Unpin' : 'Pin'}
                    style={{ color: textColor }}
                >
                    {isPinned ? <IconPinFilled size={iconSize} /> : <IconPin size={iconSize} />}
                </ActionIcon>
            )}

            {/* Archive + More menu - only for owner */}
            {!note.is_trashed && isOwner && (
                <>
                    <ActionIcon
                        variant="subtle"
                        size={buttonSize}
                        onClick={() => {
                            note.is_archived ? unarchiveNote(note.id) : archiveNote(note.id);
                            onClose();
                        }}
                        title={note.is_archived ? 'Unarchive' : 'Archive'}
                        style={{ color: textColor }}
                    >
                        {note.is_archived ? <IconArchiveOff size={iconSize} /> : <IconArchive size={iconSize} />}
                    </ActionIcon>

                    {/* 3-dot menu */}
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
                    title={note.share_is_archived ? 'Unarchive' : 'Archive'}
                    style={{ color: textColor }}
                >
                    {note.share_is_archived ? <IconArchiveOff size={iconSize} /> : <IconArchive size={iconSize} />}
                </ActionIcon>
            )}

            {/* Remove from my notes - for shared notes (not owner) */}
            {!isOwner && !note.is_trashed && (
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size={buttonSize}
                    onClick={async () => {
                        try {
                            await authFetch(`/api/notes/${note.id}/share/${user.id}`, {
                                method: 'DELETE'
                            });
                        } catch (e) {
                            logger.error('UI', 'Failed to unshare self', e);
                        }
                        onClose();
                    }}
                    title="Remove from my notes"
                >
                    <IconUserMinus size={iconSize} />
                </ActionIcon>
            )}

            {/* Trash actions */}
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
    );
}
