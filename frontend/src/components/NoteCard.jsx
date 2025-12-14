import { useState } from 'react';
import { Card, Text, Badge, Group, ActionIcon, Stack, Checkbox, Box, Menu } from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash, IconRestore, IconDotsVertical, IconHistory } from '@tabler/icons-react';

import { getNoteColor, getNoteTextColor } from '../constants/noteColors';

const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
};

export default function NoteCard({ note, onClick, onPin, onArchive, onUnarchive, onRestore, onTrash, onDelete, onItemToggle, onVersionHistory }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';
    const [isHovered, setIsHovered] = useState(false);

    const handleAction = (e, action) => {
        console.log('NoteCard action clicked', note.id);
        e.stopPropagation();
        action();
    };

    const bgColor = getNoteColor(note.color, isDark);
    const textColor = getNoteTextColor(note.color, isDark);
    const lastModified = formatDate(note.updated_at || note.created_at);

    return (
        <Card
            shadow="sm"
            padding="md"
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
                    borderColor: note.is_pinned ? 'var(--mantine-color-blue-5)' : undefined,
                },
            })}
        >
            {note.is_pinned && (
                <ActionIcon
                    variant="transparent"
                    color={textColor === '#000000' ? 'dark' : 'blue'}
                    size="sm"
                    style={{ position: 'absolute', top: 8, right: 8 }}
                >
                    <IconPinFilled size={16} />
                </ActionIcon>
            )}

            {note.title && (
                <Text fw={600} size="md" mb="xs" style={{ color: textColor }}>
                    {note.title}
                </Text>
            )}

            {note.content && (
                <Text size="sm" lineClamp={6} style={{ whiteSpace: 'pre-wrap', color: textColor, opacity: 0.8 }}>
                    {note.content}
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
                        <Badge key={idx} size="sm" variant="light">
                            {label}
                        </Badge>
                    ))}
                </Group>
            )}

            <Group mt="sm" justify="space-between" align="center">
                <Group gap="xs" style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s', position: 'relative', zIndex: 2 }}>
                    {onPin && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onPin(note.id, !note.is_pinned))}
                            title={note.is_pinned ? 'Unpin' : 'Pin'}
                            style={{ color: textColor }}
                        >
                            {note.is_pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
                        </ActionIcon>
                    )}

                    {onArchive && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onArchive(note.id))}
                            title="Archive"
                            style={{ color: textColor }}
                        >
                            <IconArchive size={16} />
                        </ActionIcon>
                    )}

                    {onUnarchive && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onUnarchive(note.id))}
                            title="Unarchive"
                            style={{ color: textColor }}
                        >
                            <IconArchiveOff size={16} />
                        </ActionIcon>
                    )}

                    {onRestore && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onRestore(note.id))}
                            title="Restore"
                            style={{ color: textColor }}
                        >
                            <IconRestore size={16} />
                        </ActionIcon>
                    )}

                    {onTrash && (
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onTrash(note.id))}
                            title="Move to trash"
                            style={{ color: textColor }}
                        >
                            <IconTrash size={16} />
                        </ActionIcon>
                    )}

                    {onDelete && (
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={(e) => handleAction(e, () => onDelete(note.id))}
                            title="Delete forever"
                        >
                            <IconTrash size={16} />
                        </ActionIcon>
                    )}

                    {onVersionHistory && (
                        <Menu shadow="md" width={200} position="bottom-end">
                            <Menu.Target>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    title="More options"
                                    style={{ color: textColor }}
                                >
                                    <IconDotsVertical size={16} />
                                </ActionIcon>
                            </Menu.Target>

                            <Menu.Dropdown>
                                <Menu.Item
                                    leftSection={<IconHistory size={14} />}
                                    onClick={(e) => handleAction(e, () => onVersionHistory(note.id))}
                                >
                                    Version history
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    )}
                </Group>

                {lastModified && (
                    <Text size="xs" style={{ color: textColor, opacity: 0.7 }}>{lastModified}</Text>
                )}
            </Group>
        </Card>
    );
}
