import { useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import NoteGrid from '../components/NoteGrid';
import './ArchivePage.css';

export default function ArchivePage() {
    const { notes, isLoading, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ archived: true });
    }, [fetchNotes]);

    return (
        <div className="archive-page">
            <h1 className="page-title">Archive</h1>

            {isLoading ? (
                <div className="notes-loading">
                    <div className="notes-spinner" />
                    <p>Loading notes...</p>
                </div>
            ) : (
                <NoteGrid notes={notes} showRestore />
            )}
        </div>
    );
}
