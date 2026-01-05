import { useNotesStore } from '../stores/notesStore';
import { useArchivedNotes } from '../hooks/useNotes';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function ArchivePage() {
    const { displayLimit } = useNotesStore();
    const notes = useArchivedNotes({ limit: displayLimit });

    // Notes is undefined while loading
    const isLoading = notes === undefined;

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
                <NoteGrid notes={notes} showUnarchive />
            )}
        </Box>
    );
}
