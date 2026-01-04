import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { useNotes } from '../hooks/useNotes';
import { useLabelsMap } from '../hooks/useLabels';
import { Box, Center, Loader, Text, Stack, Group, Title } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';

export default function NotesPage() {
    const { labelId } = useParams();
    const { searchQuery, sortBy, sortOrder, displayLimit } = useNotesStore();
    const labelsMap = useLabelsMap();

    // Resolve label name
    const labelName = labelId && labelsMap ? (labelsMap.get(Number(labelId)) || labelsMap.get(labelId)) : '';

    // Use reactive Dexie query for notes
    const notes = useNotes({
        sortBy,
        sortOrder,
        searchQuery,
        labelId: labelId ? (Number(labelId) || labelId) : null,
        limit: displayLimit
    });

    // Notes is undefined while loading
    const isLoading = notes === undefined;

    return (
        <Box>
            {labelId && (
                <Group gap="xs" mb="md">
                    <IconTag size={20} />
                    <Title order={4}>{labelName || 'Unknown Label'}</Title>
                </Group>
            )}

            <NoteInput key={labelId || 'all'} currentLabel={labelId} />

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
