import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { Box, Center, Loader, Text, Stack, Group, Title } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';

export default function NotesPage() {
    const { label } = useParams();
    const { notes, isLoading, isLoadingMore, hasMore, searchQuery, fetchNotes, fetchMoreNotes, fetchErrorCooldown } = useNotesStore();
    const sentinelRef = useRef(null);

    useEffect(() => {
        fetchNotes({ label, search: searchQuery });
    }, [fetchNotes, label, searchQuery]);

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
                <>
                    <NoteGrid notes={notes} />

                    {/* Sentinel element for infinite scroll */}
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
