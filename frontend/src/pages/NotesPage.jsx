import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';
import './NotesPage.css';

export default function NotesPage() {
    const { label } = useParams();
    const { notes, isLoading, searchQuery, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ label, search: searchQuery });
    }, [fetchNotes, label, searchQuery]);

    return (
        <div className="notes-page">
            <NoteInput />

            {isLoading ? (
                <div className="notes-loading">
                    <div className="notes-spinner" />
                    <p>Loading notes...</p>
                </div>
            ) : (
                <NoteGrid notes={notes} />
            )}
        </div>
    );
}
