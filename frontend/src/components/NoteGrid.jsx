import { useState } from 'react';
import { Box, Text, Stack, Center } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';
import { useNotesStore } from '../stores/notesStore';

export default function NoteGrid({ notes, showRestore, showDelete }) {
    const { viewMode, pinNote, archiveNote, unarchiveNote, trashNote, deleteNote } = useNotesStore();
    const [selectedNote, setSelectedNote] = useState(null);

    const pinnedNotes = notes.filter((n) => n.is_pinned);
    const otherNotes = notes.filter((n) => !n.is_pinned);

    const handleNoteClick = (note) => {
        if (!showDelete) {
            setSelectedNote(note);
        }
    };

    const handleModalClose = () => {
        setSelectedNote(null);
    };

    const gridStyles = viewMode === 'list'
        ? { maxWidth: 600 }
        : { columnCount: 4, columnGap: 16 };

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
                        onPin={!showDelete ? pinNote : undefined}
                        onArchive={!showDelete && !showRestore ? archiveNote : (showRestore ? unarchiveNote : undefined)}
                        onTrash={!showDelete ? trashNote : undefined}
                        onDelete={showDelete ? deleteNote : undefined}
                        showRestore={showRestore}
                        showDelete={showDelete}
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

            <style>{`
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
