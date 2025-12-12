import { useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import NoteGrid from '../components/NoteGrid';
import './ArchivePage.css';

export default function TrashPage() {
    const { notes, isLoading, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ trashed: true });
    }, [fetchNotes]);

    return (
        <div className="trash-page">
            <h1 className="page-title">Trash</h1>
            <p className="trash-info">Notes in trash are automatically deleted after 7 days</p>

            {isLoading ? (
                <div className="notes-loading">
                    <div className="notes-spinner" />
                    <p>Loading notes...</p>
                </div>
            ) : (
                <NoteGrid notes={notes} showRestore showDelete />
            )}
        </div>
    );
}
