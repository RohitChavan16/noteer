import './NoteCard.css';

const NOTE_COLORS = {
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

export default function NoteCard({ note, onClick, onPin, onArchive, onTrash, onRestore, onDelete, showRestore, showDelete }) {
    const handleAction = (e, action) => {
        e.stopPropagation();
        action();
    };

    return (
        <article
            className={`note-card ${note.is_pinned ? 'pinned' : ''}`}
            style={{ backgroundColor: NOTE_COLORS[note.color] || NOTE_COLORS.default }}
            onClick={() => onClick?.(note)}
        >
            {note.is_pinned && (
                <div className="note-pin-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 3H8c-.55 0-1 .45-1 1v1h10V4c0-.55-.45-1-1-1zm2 3H6c-.55 0-1 .45-1 1v3c0 1.66 1.34 3 3 3h.1l-.6 6.4c-.05.53.36 1 .9 1h7.2c.54 0 .95-.47.9-1L16 13h.1c1.66 0 3-1.34 3-3V7c0-.55-.45-1-1-1z" />
                    </svg>
                </div>
            )}

            {note.title && <h3 className="note-title">{note.title}</h3>}

            {note.content && (
                <p className="note-content">{note.content}</p>
            )}

            {note.items && note.items.length > 0 && (
                <ul className="note-checklist">
                    {note.items.slice(0, 5).map((item, idx) => (
                        <li key={idx} className={item.is_checked ? 'checked' : ''}>
                            <span className="note-checkbox">
                                {item.is_checked && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </span>
                            <span>{item.content}</span>
                        </li>
                    ))}
                    {note.items.length > 5 && (
                        <li className="note-checklist-more">+{note.items.length - 5} more</li>
                    )}
                </ul>
            )}

            {note.labels && note.labels.length > 0 && (
                <div className="note-labels">
                    {note.labels.map((label, idx) => (
                        <span key={idx} className="note-label">{label}</span>
                    ))}
                </div>
            )}

            <div className="note-actions">
                {onPin && !showDelete && (
                    <button
                        className="note-action-btn"
                        onClick={(e) => handleAction(e, () => onPin(note.id, !note.is_pinned))}
                        title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                        <svg viewBox="0 0 24 24" fill={note.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M16 3H8c-.55 0-1 .45-1 1v1h10V4c0-.55-.45-1-1-1zm2 3H6c-.55 0-1 .45-1 1v3c0 1.66 1.34 3 3 3h.1l-.6 6.4c-.05.53.36 1 .9 1h7.2c.54 0 .95-.47.9-1L16 13h.1c1.66 0 3-1.34 3-3V7c0-.55-.45-1-1-1z" />
                        </svg>
                    </button>
                )}

                {onArchive && !showDelete && (
                    <button
                        className="note-action-btn"
                        onClick={(e) => handleAction(e, () => onArchive(note.id))}
                        title="Archive"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                    </button>
                )}

                {showRestore && onRestore && (
                    <button
                        className="note-action-btn"
                        onClick={(e) => handleAction(e, () => onRestore(note.id))}
                        title="Restore"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </button>
                )}

                {onTrash && !showDelete && (
                    <button
                        className="note-action-btn"
                        onClick={(e) => handleAction(e, () => onTrash(note.id))}
                        title="Move to trash"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                )}

                {showDelete && onDelete && (
                    <button
                        className="note-action-btn danger"
                        onClick={(e) => handleAction(e, () => onDelete(note.id))}
                        title="Delete permanently"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                    </button>
                )}
            </div>
        </article>
    );
}
