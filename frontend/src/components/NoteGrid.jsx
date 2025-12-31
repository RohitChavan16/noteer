import { useState, useCallback } from 'react';
import { Box, Text, Stack, Center } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';
import VersionHistoryModal from './VersionHistoryModal';
import ShareModal from './ShareModal';
import { useNotesStore } from '../stores/notesStore';

export default function NoteGrid({ notes, showRestore, showDelete }) {
    const { viewMode, pinNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote, updateNote } = useNotesStore();
    const [selectedNote, setSelectedNote] = useState(null);
    const [versionHistoryNoteId, setVersionHistoryNoteId] = useState(null);
    const [shareNoteId, setShareNoteId] = useState(null);

    const isTrash = showDelete;
    const isArchive = showRestore && !showDelete;

    // Helper to get correct pinned state (owner uses notes.is_pinned, recipient uses note_shares.is_pinned)
    const isPinned = (note) => note.is_owner === false ? note.share_is_pinned : note.is_pinned;

    // In trash, we don't separate pinned notes
    const pinnedNotes = isTrash ? [] : notes.filter(isPinned);
    const otherNotes = isTrash ? notes : notes.filter((n) => !isPinned(n));

    // Find shareNote from current notes array by ID
    const shareNote = shareNoteId ? notes.find(n => n.id === shareNoteId) : null;

    const handleNoteClick = useCallback((note) => {
        if (!showDelete) {
            setSelectedNote(note);
        }
    }, [showDelete]);

    const handleModalClose = useCallback(() => {
        setSelectedNote(null);
    }, []);

    const handleItemToggle = useCallback(async (noteId, itemIndex) => {
        const note = notes.find(n => n.id === noteId);
        if (!note || !note.items) return;

        const updatedItems = note.items.map((item, idx) =>
            idx === itemIndex ? { ...item, is_checked: !item.is_checked } : item
        );
        await updateNote(noteId, { items: updatedItems });
    }, [notes, updateNote]);

    const handleLabelsChange = useCallback((noteId, labels) => {
        updateNote(noteId, { labels });
    }, [updateNote]);

    const handleShare = useCallback((note) => {
        setShareNoteId(note.id);
    }, []);

    // Force list view on touch devices (phones and tablets)
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const effectiveViewMode = isTouchDevice ? 'list' : viewMode;

    const gridStyles = effectiveViewMode === 'list'
        ? { maxWidth: 600, margin: '0 auto' }
        : { columnCount: 4, columnGap: 16 };

    const renderNotes = (noteList, title) => (
        <>
            {title && noteList.length > 0 && (
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" mt="md" style={{ letterSpacing: '0.05em' }}>
                    {title}
                </Text>
            )}
            <Box style={gridStyles}>
                {noteList.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        onClick={handleNoteClick}
                        onPin={!isTrash ? pinNote : undefined}
                        onArchive={!isTrash && !isArchive ? archiveNote : undefined}
                        onUnarchive={isArchive ? unarchiveNote : undefined}
                        onRestore={isTrash ? restoreNote : undefined}
                        onTrash={!isTrash ? trashNote : undefined}
                        onDelete={isTrash ? deleteNote : undefined}
                        onItemToggle={!isTrash ? handleItemToggle : undefined}
                        onVersionHistory={!isTrash ? setVersionHistoryNoteId : undefined}
                        onLabelsChange={!isTrash ? handleLabelsChange : undefined}
                        onShare={!isTrash ? handleShare : undefined}
                    />
                ))}
            </Box>
        </>
    );

    // Intersection Observer for Infinite Scroll
    const handleObserver = useCallback((entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
            const { displayLimit, loadMore } = useNotesStore.getState();
            // Only load more if we have notes equal to the limit (meaning there might be more)
            // Or simpler: just try to load more. The hook will handle the limit.
            if (notes.length >= displayLimit) {
                loadMore();
            }
        }
    }, [notes.length]);

    // Use a Ref for the sentinel
    const observerRef = useCallback(node => {
        if (!node) return;
        const observer = new IntersectionObserver(handleObserver, {
            root: null,
            rootMargin: "200px", // Preload before reaching exactly bottom
            threshold: 0.1
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [handleObserver]);

    if (notes.length === 0) {
        return (
            <Center py="xl">
                <Stack align="center" c="dimmed">
                    <IconNote size={64} stroke={1} style={{ opacity: 0.5 }} />
                    <Text size="md">No notes here</Text>
                </Stack>
            </Center>
        );
    }

    // Ensure we pass the latest version of the note to the modal
    const activeNote = selectedNote ? (notes.find(n => n.id === selectedNote.id) || selectedNote) : null;

    return (
        <>
            <Box w="100%">
                {pinnedNotes.length > 0 && !showDelete && renderNotes(pinnedNotes, 'Pinned')}
                {renderNotes(otherNotes, pinnedNotes.length > 0 && !showDelete ? 'Others' : null)}

                {/* Sentinel for Infinite Scroll */}
                {!showDelete && (
                    <Box ref={observerRef} h={20} w="100%" /> // Invisible 20px trigger area
                )}
            </Box>

            {activeNote && (
                <NoteModal note={activeNote} onClose={handleModalClose} />
            )}

            <VersionHistoryModal
                opened={!!versionHistoryNoteId}
                onClose={() => setVersionHistoryNoteId(null)}
                noteId={versionHistoryNoteId}
            />

            <ShareModal
                opened={!!shareNote}
                onClose={() => setShareNoteId(null)}
                note={shareNote}
            />

            <style>{`
                @media (max-width: 1400px) {
                    .mantine-Box-root { column-count: 3 !important; }
                }
                @media (max-width: 1000px) {
                    .mantine-Box-root { column-count: 2 !important; }
                }
                @media (max-width: 600px) {
                    .mantine-Box-root { column-count: 1 !important; }
                }
            `}</style>
        </>
    );
}
