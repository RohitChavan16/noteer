import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack } from '@mantine/core';
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
            <NoteInput />

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
