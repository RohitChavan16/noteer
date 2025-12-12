import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import './NoteInput.css';

const NOTE_COLORS = [
    { id: 'default', label: 'Default' },
    { id: 'red', label: 'Red' },
    { id: 'orange', label: 'Orange' },
    { id: 'yellow', label: 'Yellow' },
    { id: 'green', label: 'Green' },
    { id: 'teal', label: 'Teal' },
    { id: 'blue', label: 'Blue' },
    { id: 'purple', label: 'Purple' },
    { id: 'pink', label: 'Pink' },
    { id: 'brown', label: 'Brown' },
    { id: 'gray', label: 'Gray' },
];

export default function NoteInput() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('default');
    const [showColors, setShowColors] = useState(false);
    const { createNote } = useNotesStore();

    const handleSubmit = async () => {
        if (!title.trim() && !content.trim()) {
            setIsExpanded(false);
            return;
        }

        await createNote({ title, content, color });
        setTitle('');
        setContent('');
        setColor('default');
        setIsExpanded(false);
        setShowColors(false);
    };

    const handleBlur = (e) => {
        // Don't collapse if clicking inside the input area
        if (e.currentTarget.contains(e.relatedTarget)) return;
        handleSubmit();
    };

    if (!isExpanded) {
        return (
            <div className="note-input collapsed" onClick={() => setIsExpanded(true)}>
                <span className="note-input-placeholder">Take a note...</span>
                <div className="note-input-icons">
                    <button className="note-input-icon" title="New list">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <rect x="3" y="4" width="4" height="4" rx="1" />
                            <rect x="3" y="10" width="4" height="4" rx="1" />
                            <rect x="3" y="16" width="4" height="4" rx="1" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="note-input expanded"
            style={{ backgroundColor: `var(--note-${color})` }}
            onBlur={handleBlur}
            tabIndex={-1}
        >
            <input
                type="text"
                className="note-input-title"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
            />
            <textarea
                className="note-input-content"
                placeholder="Take a note..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
            />

            <div className="note-input-toolbar">
                <div className="note-input-colors-wrapper">
                    <button
                        className="note-input-color-btn"
                        onClick={() => setShowColors(!showColors)}
                        title="Background color"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" fill="currentColor" />
                        </svg>
                    </button>
                    {showColors && (
                        <div className="note-input-colors">
                            {NOTE_COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    className={`note-color-option ${color === c.id ? 'active' : ''}`}
                                    style={{ backgroundColor: `var(--note-${c.id})` }}
                                    onClick={() => { setColor(c.id); setShowColors(false); }}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <button className="note-input-close" onClick={handleSubmit}>
                    Close
                </button>
            </div>
        </div>
    );
}
