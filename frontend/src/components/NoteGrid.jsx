import { useState } from 'react';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';
import { useNotesStore } from '../stores/notesStore';

export default function NoteGrid({ notes, showRestore, showDelete }) {
    const { viewMode, pinNote, archiveNote, unarchiveNote, trashNote, restoreNote, deleteNote } = useNotesStore();
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

    // Grid classes - responsive columns, list mode forces single column
    const gridClass = viewMode === 'list'
        ? 'max-w-[600px]'
        : 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4';

    const renderNotes = (noteList, title) => (
        <>
            {title && noteList.length > 0 && (
                <div className="text-xs font-semibold text-theme-muted uppercase tracking-wide mb-3 mt-6 first:mt-0">
                    {title}
                </div>
            )}
            <div className={gridClass}>
                {noteList.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        onClick={handleNoteClick}
                        onPin={!showDelete ? pinNote : undefined}
                        onArchive={!showDelete && !showRestore ? archiveNote : (showRestore ? unarchiveNote : undefined)}
                        onTrash={!showDelete ? trashNote : undefined}
                        onRestore={showRestore ? restoreNote : undefined}
                        onDelete={showDelete ? deleteNote : undefined}
                        showRestore={showRestore}
                        showDelete={showDelete}
                    />
                ))}
            </div>
        </>
    );

    if (notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-theme-muted">
                <svg viewBox="0 0 100 100" className="w-20 h-20 mb-4 opacity-50">
                    <rect x="20" y="15" width="60" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
                    <line x1="32" y1="35" x2="68" y2="35" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <line x1="32" y1="50" x2="60" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <line x1="32" y1="65" x2="52" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <p className="text-base">No notes here</p>
            </div>
        );
    }

    return (
        <>
            <div className="w-full">
                {pinnedNotes.length > 0 && !showDelete && renderNotes(pinnedNotes, 'Pinned')}
                {renderNotes(otherNotes, pinnedNotes.length > 0 && !showDelete ? 'Others' : null)}
            </div>

            {selectedNote && (
                <NoteModal note={selectedNote} onClose={handleModalClose} />
            )}
        </>
    );
}
