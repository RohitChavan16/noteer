import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Paper, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Box, Center } from '@mantine/core';
import { IconPlus, IconPalette } from '@tabler/icons-react';

const NOTE_COLORS = [
    { id: 'default', color: '#ffffff', darkColor: '#1a1b1e' },
    { id: 'red', color: '#ffe3e3', darkColor: '#c92a2a' },
    { id: 'orange', color: '#ffe8cc', darkColor: '#d9480f' },
    { id: 'yellow', color: '#fff3bf', darkColor: '#e67700' },
    { id: 'green', color: '#d3f9d8', darkColor: '#2f9e44' },
    { id: 'teal', color: '#c3fae8', darkColor: '#12b886' },
    { id: 'blue', color: '#d0ebff', darkColor: '#1971c2' },
    { id: 'purple', color: '#e5dbff', darkColor: '#7048e8' },
    { id: 'pink', color: '#ffdeeb', darkColor: '#c2255c' },
    { id: 'brown', color: '#ffd8a8', darkColor: '#e8590c' },
    { id: 'gray', color: '#e9ecef', darkColor: '#495057' },
];

export default function NoteInput() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('default');
    const [showColors, setShowColors] = useState(false);
    const { createNote } = useNotesStore();

    const getCurrentColor = () => {
        const c = NOTE_COLORS.find(nc => nc.id === color);
        return c ? c.color : NOTE_COLORS[0].color;
    };

    const handleSubmit = async () => {
        if (!title.trim() && !content.trim()) {
            setIsExpanded(false);
            return;
        }

        await createNote({ title, content, color });
        setTitle('');
        setContent('');
        setColor('default');
        setIsExpanded(false);
        setShowColors(false);
    };

    const handleBlur = (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        handleSubmit();
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
                        <Box c="dimmed">Vytvořit poznámku...</Box>
                        <IconPlus size={18} color="var(--mantine-color-dimmed)" />
                    </Group>
                </Paper>
            </Center>
        );
    }

    return (
        <Center mb="xl">
            <Paper
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
                        placeholder="Název"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="unstyled"
                        autoFocus
                        styles={{ input: { fontWeight: 500, fontSize: '1rem' } }}
                    />
                    <Textarea
                        placeholder="Vytvořit poznámku..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        variant="unstyled"
                        minRows={3}
                        autosize
                    />

                    <Group justify="space-between" mt="xs">
                        <Popover opened={showColors} onChange={setShowColors} position="top-start">
                            <Popover.Target>
                                <ActionIcon
                                    variant="subtle"
                                    onClick={() => setShowColors(!showColors)}
                                    title="Barva pozadí"
                                >
                                    <IconPalette size={18} />
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <Group gap="xs">
                                    {NOTE_COLORS.map((c) => (
                                        <ColorSwatch
                                            key={c.id}
                                            color={c.color}
                                            onClick={() => { setColor(c.id); setShowColors(false); }}
                                            style={{
                                                cursor: 'pointer',
                                                border: color === c.id ? '2px solid var(--mantine-color-blue-5)' : '1px solid var(--mantine-color-gray-3)'
                                            }}
                                            size={24}
                                        />
                                    ))}
                                </Group>
                            </Popover.Dropdown>
                        </Popover>

                        <ActionIcon variant="subtle" onClick={handleSubmit}>
                            Zavřít
                        </ActionIcon>
                    </Group>
                </Stack>
            </Paper>
        </Center>
    );
}
