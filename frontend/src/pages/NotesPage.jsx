import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { useNotes } from '../hooks/useNotes';
import { Box, Center, Loader, Text, Stack, Group, Title } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';

export default function NotesPage() {
    const { label } = useParams();
    const { searchQuery, sortBy, sortOrder } = useNotesStore();

    // Use reactive Dexie query for notes
    const notes = useNotes({
        sortBy,
        sortOrder,
        searchQuery,
        label: label ? decodeURIComponent(label) : ''
    });

    // Notes is undefined while loading
    const isLoading = notes === undefined;

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
