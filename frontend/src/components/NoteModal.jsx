import { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Modal, TextInput, Textarea, Group, ActionIcon, Popover, ColorSwatch, Stack, Button } from '@mantine/core';
import { IconPalette } from '@tabler/icons-react';

const NOTE_COLORS = [
    { id: 'default', name: 'Default', color: '#ffffff', darkColor: '#1a1b1e' },
    { id: 'red', name: 'Red', color: '#ffe3e3', darkColor: '#c92a2a' },
    { id: 'orange', name: 'Orange', color: '#ffe8cc', darkColor: '#d9480f' },
    { id: 'yellow', name: 'Yellow', color: '#fff3bf', darkColor: '#e67700' },
    { id: 'green', name: 'Green', color: '#d3f9d8', darkColor: '#2f9e44' },
    { id: 'teal', name: 'Teal', color: '#c3fae8', darkColor: '#12b886' },
    { id: 'blue', name: 'Blue', color: '#d0ebff', darkColor: '#1971c2' },
    { id: 'purple', name: 'Purple', color: '#e5dbff', darkColor: '#7048e8' },
    { id: 'pink', name: 'Pink', color: '#ffdeeb', darkColor: '#c2255c' },
    { id: 'brown', name: 'Brown', color: '#ffd8a8', darkColor: '#e8590c' },
    { id: 'gray', name: 'Gray', color: '#e9ecef', darkColor: '#495057' },
];

export default function NoteModal({ note, onClose }) {
    const { updateNote } = useNotesStore();
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || 'default');
    const [showColors, setShowColors] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const getCurrentColor = () => {
        const c = NOTE_COLORS.find(nc => nc.id === color);
        return c ? c.color : NOTE_COLORS[0].color;
    };

    const handleSave = async () => {
        if (isSaving) return;

        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default');

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, { title, content, color });
            setIsSaving(false);
        }
        onClose();
    };

    if (!note) return null;

    return (
        <Modal
            opened={!!note}
            onClose={handleSave}
            size="lg"
            centered
            withCloseButton={false}
            styles={{
                content: { backgroundColor: getCurrentColor() },
            }}
        >
            <Stack gap="md">
                <TextInput
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    variant="unstyled"
                    styles={{ input: { fontWeight: 600, fontSize: '1.25rem' } }}
                />
                <Textarea
                    placeholder="Take a note..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    variant="unstyled"
                    minRows={6}
                    autosize
                />

                <Group justify="space-between">
                    <Popover opened={showColors} onChange={setShowColors} position="top-start">
                        <Popover.Target>
                            <ActionIcon
                                variant="subtle"
                                onClick={() => setShowColors(!showColors)}
                                title="Change color"
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
                                        title={c.name}
                                    />
                                ))}
                            </Group>
                        </Popover.Dropdown>
                    </Popover>

                    <Button variant="subtle" onClick={handleSave} loading={isSaving}>
                        {isSaving ? 'Saving...' : 'Close'}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
