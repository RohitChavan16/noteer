import { useEffect } from 'react';
import { useNotesStore } from '../stores/notesStore';
import NoteGrid from '../components/NoteGrid';

export default function TrashPage() {
    const { notes, isLoading, fetchNotes } = useNotesStore();

    useEffect(() => {
        fetchNotes({ trashed: true });
    }, [fetchNotes]);

    return (
        <div className="max-w-full">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Trash</h1>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">Notes in trash are automatically deleted after 7 days</p>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-15 px-6 text-gray-400 dark:text-gray-600">
                    <div className="w-8 h-8 border-3 border-gray-200 dark:border-oled-border border-t-accent rounded-full animate-spin mb-3" />
                    <p>Loading notes...</p>
                </div>
            ) : (
                <NoteGrid notes={notes} showRestore showDelete />
            )}
        </div>
    );
}
