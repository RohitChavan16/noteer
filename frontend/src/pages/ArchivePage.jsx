import { useEffect, useRef, useCallback } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Title } from '@mantine/core';
import NoteGrid from '../components/NoteGrid';

export default function ArchivePage() {
    const { notes, isLoading, isLoadingMore, hasMore, fetchNotes, fetchMoreNotes } = useNotesStore();
    const sentinelRef = useRef(null);

    useEffect(() => {
        fetchNotes({ archived: true });
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
            <Title order={3} mb="lg">Archive</Title>

            {isLoading ? (
                <Center py="xl">
                    <Stack align="center">
                        <Loader size="md" />
                        <Text c="dimmed">Loading notes...</Text>
                    </Stack>
                </Center>
            ) : (
                <>
                    <NoteGrid notes={notes} showRestore />
                    <div ref={sentinelRef} style={{ height: 1 }} />
                    {isLoadingMore && (
                        <Center py="md">
                            <Loader size="sm" />
                        </Center>
                    )}
                </>
            )}
        </Box>
    );
}
