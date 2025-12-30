import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Card, Text, Badge, Group, ActionIcon, Stack, Checkbox, Box, Menu, Avatar, Tooltip, SimpleGrid } from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash, IconRestore, IconDotsVertical, IconHistory, IconUsers, IconShare } from '@tabler/icons-react';

import { getNoteColor, getNoteTextColor } from '../constants/noteColors';
import { getInitials } from '../utils/helpers';
import LabelPicker from './LabelPicker';

import EncryptedImage from './EncryptedImage';

export default function NoteCard({ note, onClick, onPin, onArchive, onUnarchive, onRestore, onTrash, onDelete, onItemToggle, onVersionHistory, onLabelsChange, onShare }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';
    const [isHovered, setIsHovered] = useState(false);

    // Detect touch device - show actions always on touch
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // Helper to get correct pinned state (owner uses notes.is_pinned, recipient uses note_shares.is_pinned)
    const isPinned = note.is_owner === false ? note.share_is_pinned : note.is_pinned;

    const handleAction = (e, action) => {
        e.stopPropagation();
        action();
    };

    const bgColor = getNoteColor(note.color, isDark);
    const textColor = getNoteTextColor(note.color, isDark);

    return (
        <Card
            shadow="sm"
            padding={note.type === 'picture' ? 0 : "md"}
            radius="md"
            withBorder
            onClick={() => onClick?.(note)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                cursor: 'pointer',
                breakInside: 'avoid',
                marginBottom: 16,
                backgroundColor: bgColor,
                color: textColor
            }}
            className="note-card"
            styles={(theme) => ({
                root: {
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows.md,
                    },
                    borderColor: isPinned ? 'var(--mantine-color-blue-5)' : undefined,
                },
            })}
        >
            {isPinned && (
                <ActionIcon
                    variant="transparent"
                    color={textColor === '#000000' ? 'dark' : 'blue'}
                    size="sm"
                    style={{ position: 'absolute', top: 8, right: 8 }}
                >
                    <IconPinFilled size={16} />
                </ActionIcon>
            )}

            {note.images && note.images.length > 0 && (
                <Card.Section mb={note.type === 'picture' ? 0 : "xs"}>
                    <SimpleGrid cols={note.images.length === 1 ? 1 : 2} spacing={1}>
                        {note.images.slice(0, 2).map((img, index) => (
                            <Box key={index} style={{ position: 'relative', height: note.type === 'picture' ? 160 : 120, overflow: 'hidden' }}>
                                <EncryptedImage
                                    src={img.thumb_medium || img.thumb_small || img.url}
                                    noteId={note.id}
                                    encryptionIv={img.encryption_iv}
                                    originalName={img.original_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                                />
                            </Box>
                        ))}
                    </SimpleGrid>
                </Card.Section>
            )}

            {note.title && (
                <Text fw={600} size="md" mb="xs" style={{ color: textColor }}>
                    {note.title}
                </Text>
            )}

            {note.content && (
                <Text size="sm" lineClamp={6} component="div" style={{ color: textColor, opacity: 0.8 }} className="note-content">
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }} />
                </Text>
            )}

            {note.items && note.items.length > 0 && (
                <Stack gap="xs" mt="sm">
                    {note.items.map((item, idx) => (
                        <Group key={idx} gap="xs" wrap="nowrap">
                            <Box onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={item.is_checked}
                                    onChange={() => onItemToggle && onItemToggle(note.id, idx)}
                                    size="xs"
                                    color={textColor === '#000000' ? 'dark' : 'blue'}
                                    styles={{ input: { cursor: 'pointer', borderColor: textColor === '#000000' ? 'rgba(0,0,0,0.3)' : undefined } }}
                                />
                            </Box>
                            <Text
                                size="sm"
                                style={{
                                    textDecoration: item.is_checked ? 'line-through' : 'none',
                                    opacity: item.is_checked ? 0.6 : 1,
                                    flex: 1,
                                    wordBreak: 'break-word',
                                    color: textColor
                                }}
                            >
                                {item.content}
                            </Text>
                        </Group>
                    ))}
                </Stack>
            )}

            {note.labels && note.labels.length > 0 && (
                <Group gap="xs" mt="sm">
                    {note.labels.map((label, idx) => (
                        <Badge
                            key={idx}
                            size="md"
                            variant="outline"
                            tt="none"
                            style={{
                                color: textColor,
                                borderColor: textColor,
                                opacity: 0.8
                            }}
                        >
                            {label}
                        </Badge>
                    ))}
                </Group>
            )}

            <Group
                mt={note.type === 'picture' ? 0 : "sm"}
                justify="space-between"
                align="center"
                style={note.type === 'picture' ? {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 'var(--mantine-spacing-sm)',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                    zIndex: 10,
                    opacity: (isHovered || isTouchDevice) ? 1 : 0,
                    transition: 'opacity 0.15s'
                } : {}}
            >
                {/* Left side: Action buttons */}
                <Group gap="xs" style={{ opacity: (isHovered || isTouchDevice) ? 1 : 0, transition: 'opacity 0.15s', position: 'relative', zIndex: 2 }}>
                    {onPin && (
                        <ActionIcon
                            variant="subtle"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onPin(note.id, !isPinned))}
                            title={isPinned ? 'Unpin' : 'Pin'}
                            style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        >
                            {isPinned ? <IconPinFilled size={isTouchDevice ? 20 : 16} /> : <IconPin size={isTouchDevice ? 20 : 16} />}
                        </ActionIcon>
                    )}

                    {onArchive && (
                        <ActionIcon
                            variant="subtle"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onArchive(note.id))}
                            title="Archive"
                            style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        >
                            <IconArchive size={isTouchDevice ? 20 : 16} />
                        </ActionIcon>
                    )}

                    {onUnarchive && (
                        <ActionIcon
                            variant="subtle"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onUnarchive(note.id))}
                            title="Unarchive"
                            style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        >
                            <IconArchiveOff size={isTouchDevice ? 20 : 16} />
                        </ActionIcon>
                    )}

                    {/* Share button for owner */}
                    {onShare && note.is_owner !== false && !note.is_trashed && (
                        <ActionIcon
                            variant="subtle"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onShare(note))}
                            title="Share"
                            style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        >
                            <IconShare size={isTouchDevice ? 20 : 16} />
                        </ActionIcon>
                    )}

                    {onRestore && (
                        <ActionIcon
                            variant="subtle"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onRestore(note.id))}
                            title="Restore"
                            style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        >
                            <IconRestore size={isTouchDevice ? 20 : 16} />
                        </ActionIcon>
                    )}

                    {onLabelsChange && (
                        <LabelPicker
                            selectedLabels={note.labels || []}
                            onChange={(labels) => onLabelsChange(note.id, labels)}
                            triggerStyle={{ color: note.type === 'picture' ? '#fff' : textColor }}
                        />
                    )}

                    {/* Permanent delete - only in trash view */}
                    {onDelete && (
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            size={isTouchDevice ? "lg" : "sm"}
                            onClick={(e) => handleAction(e, () => onDelete(note.id))}
                            title="Delete forever"
                        >
                            <IconTrash size={isTouchDevice ? 20 : 16} />
                        </ActionIcon>
                    )}

                    {/* 3-dot menu - only for owner (version history + trash) */}
                    {note.is_owner !== false && (onVersionHistory || onTrash) && (
                        <Menu shadow="md" width={200} position="bottom-end">
                            <Menu.Target>
                                <ActionIcon
                                    variant="subtle"
                                    size={isTouchDevice ? "lg" : "sm"}
                                    onClick={(e) => e.stopPropagation()}
                                    title="More options"
                                    style={{ color: note.type === 'picture' ? '#fff' : textColor }}
                                >
                                    <IconDotsVertical size={isTouchDevice ? 20 : 16} />
                                </ActionIcon>
                            </Menu.Target>

                            <Menu.Dropdown>
                                {onVersionHistory && note.type !== 'picture' && (
                                    <Menu.Item
                                        leftSection={<IconHistory size={14} />}
                                        onClick={(e) => handleAction(e, () => onVersionHistory(note.id))}
                                    >
                                        Version history
                                    </Menu.Item>
                                )}
                                {onTrash && (
                                    <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash size={14} />}
                                        onClick={(e) => handleAction(e, () => onTrash(note.id))}
                                    >
                                        Move to trash
                                    </Menu.Item>
                                )}
                            </Menu.Dropdown>
                        </Menu>
                    )}
                </Group>

                {/* Right side: Share indicator - NO TIMESTAMP */}
                <Group gap="xs" align="center">
                    {/* Show owner avatar for shared notes (not owned by current user) */}
                    {note.owner && (
                        <Tooltip label={`Shared by ${note.owner.given_name || note.owner.email}`}>
                            <Avatar src={note.owner.avatar_url} size="sm" radius="xl">
                                {getInitials(note.owner.given_name, note.owner.family_name)}
                            </Avatar>
                        </Tooltip>
                    )}

                    {/* Shared with others indicator for owner */}
                    {note.is_shared && note.is_owner && (
                        <Tooltip label="Shared with others">
                            <IconUsers size={14} style={{ color: note.type === 'picture' ? '#fff' : textColor, opacity: 0.7 }} />
                        </Tooltip>
                    )}
                </Group>
            </Group>
        </Card>
    );
}
