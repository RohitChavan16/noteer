import { useState } from 'react';
import NoteCard from './NoteCard';
import NoteModal from './NoteModal';
import { useNotesStore } from '../stores/notesStore';
import './NoteGrid.css';

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

    const renderNotes = (noteList, title) => (
        <>
            {title && noteList.length > 0 && (
                <div className="note-section-title">{title}</div>
            )}
            <div className={`note-grid ${viewMode}`}>
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
            <div className="note-grid-empty">
                <svg viewBox="0 0 100 100" className="note-grid-empty-icon">
                    <rect x="20" y="15" width="60" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
                    <line x1="32" y1="35" x2="68" y2="35" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <line x1="32" y1="50" x2="60" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <line x1="32" y1="65" x2="52" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <p>No notes here</p>
            </div>
        );
    }

    return (
        <>
            <div className="note-grid-container">
                {pinnedNotes.length > 0 && !showDelete && renderNotes(pinnedNotes, 'Pinned')}
                {renderNotes(otherNotes, pinnedNotes.length > 0 && !showDelete ? 'Others' : null)}
            </div>

            {selectedNote && (
                <NoteModal note={selectedNote} onClose={handleModalClose} />
            )}
        </>
    );
}

