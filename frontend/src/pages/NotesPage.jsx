import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import NoteGrid from '../components/NoteGrid';
import NoteInput from '../components/NoteInput';

export default function NotesPage() {
    const { label } = useParams();
    const { notes, isLoading, searchQuery, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ label, search: searchQuery });
    }, [fetchNotes, label, searchQuery]);

    return (
        <div className="max-w-full">
            <NoteInput />

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-15 px-6 text-gray-400 dark:text-gray-600">
                    <div className="w-8 h-8 border-3 border-gray-200 dark:border-oled-border border-t-accent rounded-full animate-spin mb-3" />
                    <p>Loading notes...</p>
                </div>
            ) : (
                <NoteGrid notes={notes} />
            )}
        </div>
    );
}
