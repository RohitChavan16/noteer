import { useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function ArchivePage() {
    const { notes, isLoading, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ archived: true });
    }, [fetchNotes]);

    return (
        <Box>
            <Title order={3} mb="lg">Archive</Title>

            {isLoading ? (
                <Center py="xl">
                    <Stack align="center">
                        <Loader size="md" />
                        <Text c="dimmed">Loading notes...</Text>
                    </Stack>
                </Center>
            ) : (
                <NoteGrid notes={notes} showRestore />
            )}
        </Box>
    );
}
