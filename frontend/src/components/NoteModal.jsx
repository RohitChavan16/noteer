import { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import './NoteModal.css';

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
        <div className="note-modal-overlay" onClick={handleOverlayClick}>
            <div
                ref={modalRef}
                className="note-modal"
                style={{ backgroundColor: COLOR_VALUES[color] || COLOR_VALUES.default }}
            >
                <input
                    type="text"
                    className="note-modal-title"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                    ref={contentRef}
                    className="note-modal-content"
                    placeholder="Take a note..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                <div className="note-modal-actions">
                    <div className="note-modal-left-actions">
                        <div className="note-modal-color-picker">
                            <button
                                className="note-modal-action-btn"
                                onClick={() => setShowColors(!showColors)}
                                title="Change color"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2a10 10 0 0 0 0 20" fill="currentColor" opacity="0.3" />
                                </svg>
                            </button>
                            {showColors && (
                                <div className="note-modal-colors">
                                    {NOTE_COLORS.map((c) => (
                                        <button
                                            key={c.id}
                                            className={`note-modal-color ${color === c.id ? 'active' : ''}`}
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
                        className="note-modal-close-btn"
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
