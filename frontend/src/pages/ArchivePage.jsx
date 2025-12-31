import { useArchivedNotes } from '../hooks/useNotes';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function ArchivePage() {
    const notes = useArchivedNotes();

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
                <NoteGrid notes={notes} showRestore />
            )}
        </Box>
    );
}
