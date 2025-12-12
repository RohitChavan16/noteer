import { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';

const NOTE_COLORS = [
    { id: 'default', name: 'Default' },
    { id: 'red', name: 'Red' },
    { id: 'orange', name: 'Orange' },
    { id: 'yellow', name: 'Yellow' },
    { id: 'green', name: 'Green' },
    { id: 'teal', name: 'Teal' },
    { id: 'blue', name: 'Blue' },
    { id: 'purple', name: 'Purple' },
    { id: 'pink', name: 'Pink' },
    { id: 'brown', name: 'Brown' },
    { id: 'gray', name: 'Gray' },
];

const COLOR_VALUES = {
    default: 'var(--note-default)',
    red: 'var(--note-red)',
    orange: 'var(--note-orange)',
    yellow: 'var(--note-yellow)',
    green: 'var(--note-green)',
    teal: 'var(--note-teal)',
    blue: 'var(--note-blue)',
    purple: 'var(--note-purple)',
    pink: 'var(--note-pink)',
    brown: 'var(--note-brown)',
    gray: 'var(--note-gray)',
};

export default function NoteModal({ note, onClose }) {
    const { updateNote } = useNotesStore();
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || 'default');
    const [showColors, setShowColors] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleSave();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [title, content, color]);

    useEffect(() => {
        // Focus content area on open
        contentRef.current?.focus();
    }, []);

    const handleSave = async () => {
        if (isSaving) return;

        const hasChanges = title !== (note?.title || '') ||
            content !== (note?.content || '') ||
            color !== (note?.color || 'default');

        if (hasChanges) {
            setIsSaving(true);
            await updateNote(note.id, { title, content, color });
            setIsSaving(false);
        }
        onClose();
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleSave();
        }
    };

    if (!note) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm"
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-[600px] max-h-[80vh] rounded-xl flex flex-col shadow-2xl animate-[modalSlideIn_0.2s_ease-out] border border-gray-200 dark:border-oled-border"
                style={{ backgroundColor: COLOR_VALUES[color] || COLOR_VALUES.default }}
            >
                <input
                    type="text"
                    className="w-full pt-4 px-4 pb-2 border-none bg-transparent text-xl font-semibold text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                    ref={contentRef}
                    className="flex-1 w-full py-2 px-4 border-none bg-transparent text-[0.95rem] text-gray-900 dark:text-gray-100 outline-none resize-none min-h-[200px] leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="Take a note..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                <div className="flex items-center justify-between py-3 px-4 border-t border-white/10">
                    <div className="flex gap-2">
                        <div className="relative">
                            <button
                                className="w-9 h-9 border-none bg-transparent rounded-full cursor-pointer flex items-center justify-center transition-colors duration-150 hover:bg-white/10 group"
                                onClick={() => setShowColors(!showColors)}
                                title="Change color"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2a10 10 0 0 0 0 20" fill="currentColor" opacity="0.3" />
                                </svg>
                            </button>
                            {showColors && (
                                <div className="absolute bottom-full left-0 bg-white dark:bg-oled-dark rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg border border-gray-200 dark:border-oled-border mb-2">
                                    {NOTE_COLORS.map((c) => (
                                        <button
                                            key={c.id}
                                            className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all duration-150 hover:scale-110 ${color === c.id ? 'border-accent' : 'border-transparent'}`}
                                            style={{ backgroundColor: COLOR_VALUES[c.id] }}
                                            onClick={() => { setColor(c.id); setShowColors(false); }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        className="py-2 px-5 border-none bg-transparent text-gray-700 dark:text-gray-200 text-[0.9rem] font-medium cursor-pointer rounded-md transition-colors duration-150 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
}
