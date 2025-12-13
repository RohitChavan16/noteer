import { useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function TrashPage() {
    const { notes, isLoading, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ trashed: true });
    }, [fetchNotes]);

    return (
        <Box>
            <Title order={3} mb="xs">Trash</Title>
            <Text c="dimmed" size="sm" mb="lg">Notes in trash are automatically deleted after 7 days</Text>

            {isLoading ? (
                <Center py="xl">
                    <Stack align="center">
                        <Loader size="md" />
                        <Text c="dimmed">Loading notes...</Text>
                    </Stack>
                </Center>
            ) : (
                <NoteGrid notes={notes} showRestore showDelete />
            )}
        </Box>
    );
}
