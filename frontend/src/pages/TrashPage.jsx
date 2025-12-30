import { useEffect, useRef, useCallback } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function TrashPage() {
    const { notes, isLoading, isLoadingMore, hasMore, fetchNotes, fetchMoreNotes, fetchErrorCooldown } = useNotesStore();
    const sentinelRef = useRef(null);

    useEffect(() => {
        fetchNotes({ trashed: true });
    }, [fetchNotes]);

    // Infinite scroll observer
    const handleObserver = useCallback((entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
            fetchMoreNotes();
        }
    }, [hasMore, isLoading, isLoadingMore, fetchMoreNotes]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(handleObserver, {
            root: null,
            rootMargin: '200px',
            threshold: 0
        });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleObserver]);

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
                <>
                    <NoteGrid notes={notes} showRestore showDelete />
                    <div ref={sentinelRef} style={{ height: 1 }} />
                    {isLoadingMore && (
                        <Center py="md">
                            <Loader size="sm" />
                        </Center>
                    )}
                    {fetchErrorCooldown && (
                        <Center py="md">
                            <Text c="orange" size="sm">Waiting for API limit...</Text>
                        </Center>
                    )}
                </>
            )}
        </Box>
    );
}
