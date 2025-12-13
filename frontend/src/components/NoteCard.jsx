import { Card, Text, Badge, Group, ActionIcon, Stack, Checkbox, Box } from '@mantine/core';
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';

const NOTE_COLORS = {
    default: undefined,
    red: 'red.1',
    orange: 'orange.1',
    yellow: 'yellow.1',
    green: 'green.1',
    teal: 'teal.1',
    blue: 'blue.1',
    purple: 'grape.1',
    pink: 'pink.1',
    brown: 'orange.2',
    gray: 'gray.2',
};

const NOTE_COLORS_DARK = {
    default: undefined,
    red: 'red.9',
    orange: 'orange.9',
    yellow: 'yellow.9',
    green: 'green.9',
    teal: 'teal.9',
    blue: 'blue.9',
    purple: 'grape.9',
    pink: 'pink.9',
    brown: 'orange.9',
    gray: 'gray.8',
};

export default function NoteCard({ note, onClick, onPin, onArchive, onTrash, onRestore, onDelete, showRestore, showDelete }) {
    const handleAction = (e, action) => {
        e.stopPropagation();
        action();
    };

    return (
        <Card
            shadow="sm"
            padding="md"
            radius="md"
            withBorder
            onClick={() => onClick?.(note)}
            style={{ cursor: 'pointer', breakInside: 'avoid', marginBottom: 16 }}
            bg={NOTE_COLORS[note.color]}
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
                    color="blue"
                    size="sm"
                    style={{ position: 'absolute', top: 8, right: 8 }}
                >
                    <IconPinFilled size={16} />
                </ActionIcon>
            )}

            {note.title && (
                <Text fw={600} size="md" mb="xs">
                    {note.title}
                </Text>
            )}

            {note.content && (
                <Text size="sm" c="dimmed" lineClamp={6} style={{ whiteSpace: 'pre-wrap' }}>
                    {note.content}
                </Text>
            )}

            {note.items && note.items.length > 0 && (
                <Stack gap="xs" mt="sm">
                    {note.items.slice(0, 5).map((item, idx) => (
                        <Group key={idx} gap="xs">
                            <Checkbox
                                checked={item.is_checked}
                                readOnly
                                size="xs"
                            />
                            <Text
                                size="sm"
                                c={item.is_checked ? 'dimmed' : undefined}
                                td={item.is_checked ? 'line-through' : undefined}
                            >
                                {item.content}
                            </Text>
                        </Group>
                    ))}
                    {note.items.length > 5 && (
                        <Text size="sm" c="dimmed" fs="italic">+{note.items.length - 5} more</Text>
                    )}
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

            <Group gap="xs" mt="sm" className="note-actions" style={{ opacity: 0, transition: 'opacity 0.15s' }}>
                {onPin && !showDelete && (
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => handleAction(e, () => onPin(note.id, !note.is_pinned))}
                        title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                        {note.is_pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
                    </ActionIcon>
                )}

                {onArchive && !showDelete && !showRestore && (
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => handleAction(e, () => onArchive(note.id))}
                        title="Archive"
                    >
                        <IconArchive size={16} />
                    </ActionIcon>
                )}

                {showRestore && onArchive && (
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => handleAction(e, () => onArchive(note.id))}
                        title="Unarchive"
                    >
                        <IconArchiveOff size={16} />
                    </ActionIcon>
                )}

                {onTrash && !showDelete && (
                    <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => handleAction(e, () => onTrash(note.id))}
                        title="Move to trash"
                    >
                        <IconTrash size={16} />
                    </ActionIcon>
                )}

                {showDelete && onDelete && (
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={(e) => handleAction(e, () => onDelete(note.id))}
                        title="Delete permanently"
                    >
                        <IconTrash size={16} />
                    </ActionIcon>
                )}
            </Group>

            <style>{`
                .mantine-Card-root:hover .note-actions {
                    opacity: 1 !important;
                }
            `}</style>
        </Card>
    );
}
