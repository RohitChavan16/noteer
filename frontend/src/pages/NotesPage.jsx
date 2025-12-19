import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Group, Title } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';

export default function NotesPage() {
    const { label } = useParams();
    const { notes, isLoading, searchQuery, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ label, search: searchQuery });
    }, [fetchNotes, label, searchQuery]);

    return (
        <Box>
            {label && (
                <Group gap="xs" mb="md">
                    <IconTag size={20} />
                    <Title order={4}>{decodeURIComponent(label)}</Title>
                </Group>
            )}

            <NoteInput key={label || 'all'} currentLabel={label ? decodeURIComponent(label) : null} />

            {isLoading ? (
                <Center py="xl">
                    <Stack align="center">
                        <Loader size="md" />
                        <Text c="dimmed">Loading notes...</Text>
                    </Stack>
                </Center>
            ) : (
                <NoteGrid notes={notes} />
            )}
        </Box>
    );
}
