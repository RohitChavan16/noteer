import { useState } from 'react';
import { Box, Text, Stack, Center } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';
import VersionHistoryModal from './VersionHistoryModal';
import { useNotesStore } from '../stores/notesStore';

export default function NoteGrid({ notes, showRestore, showDelete }) {
    const { viewMode, pinNote, archiveNote, unarchiveNote, trashNote, deleteNote, restoreNote, updateNote } = useNotesStore();
    const [selectedNote, setSelectedNote] = useState(null);
    const [versionHistoryNoteId, setVersionHistoryNoteId] = useState(null);

    const isTrash = showDelete;
    const isArchive = showRestore && !showDelete;

    // In trash, we don't separate pinned notes
    const pinnedNotes = isTrash ? [] : notes.filter((n) => n.is_pinned);
    const otherNotes = isTrash ? notes : notes.filter((n) => !n.is_pinned);

    const handleNoteClick = (note) => {
        if (!showDelete) {
            setSelectedNote(note);
        }
    };

    const handleModalClose = () => {
        setSelectedNote(null);
    };

    const handleItemToggle = async (noteId, itemIndex) => {
        const note = notes.find(n => n.id === noteId);
        if (!note || !note.items) return;

        const updatedItems = note.items.map((item, idx) =>
            idx === itemIndex ? { ...item, is_checked: !item.is_checked } : item
        );
        await updateNote(noteId, { items: updatedItems });
    };

    // Force list view on touch devices (phones and tablets)
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const effectiveViewMode = isTouchDevice ? 'list' : viewMode;

    const gridStyles = effectiveViewMode === 'list'
        ? { maxWidth: 600, margin: '0 auto' }
        : { columnCount: 5, columnGap: 16 };

    const renderNotes = (noteList, title) => (
        <>
            {title && noteList.length > 0 && (
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" mt="md" style={{ letterSpacing: '0.05em' }}>
                    {title}
                </Text>
            )}
            <Box
                style={{
                    ...gridStyles,
                    '@media (max-width: 992px)': { columnCount: 3 },
                    '@media (max-width: 768px)': { columnCount: 2 },
                    '@media (max-width: 576px)': { columnCount: 1 },
                }}
            >
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
                        onLabelsChange={!isTrash ? (noteId, labels) => updateNote(noteId, { labels }) : undefined}
                    />
                ))}
            </Box>
        </>
    );

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

    return (
        <>
            <Box w="100%">
                {pinnedNotes.length > 0 && !showDelete && renderNotes(pinnedNotes, 'Pinned')}
                {renderNotes(otherNotes, pinnedNotes.length > 0 && !showDelete ? 'Others' : null)}
            </Box>

            {selectedNote && (
                <NoteModal note={selectedNote} onClose={handleModalClose} />
            )}

            <VersionHistoryModal
                opened={!!versionHistoryNoteId}
                onClose={() => setVersionHistoryNoteId(null)}
                noteId={versionHistoryNoteId}
            />

            <style>{`
                @media (max-width: 1200px) {
                    .mantine-Box-root { column-count: 4 !important; }
                }
                @media (max-width: 992px) {
                    .mantine-Box-root { column-count: 3 !important; }
                }
                @media (max-width: 768px) {
                    .mantine-Box-root { column-count: 2 !important; }
                }
                @media (max-width: 576px) {
                    .mantine-Box-root { column-count: 1 !important; }
                }
            `}</style>
        </>
    );
}
