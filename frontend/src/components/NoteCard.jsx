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
            className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-150 break-inside-avoid mb-4 hover:shadow-lg hover:-translate-y-0.5 group ${note.is_pinned ? 'border-accent' : 'border-theme'}`}
            style={{ backgroundColor: NOTE_COLORS[note.color] || NOTE_COLORS.default }}
            onClick={() => onClick?.(note)}
        >
            {note.is_pinned && (
                <div className="absolute top-2 right-2 w-5 h-5 text-accent">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                        <path d="M16 3H8c-.55 0-1 .45-1 1v1h10V4c0-.55-.45-1-1-1zm2 3H6c-.55 0-1 .45-1 1v3c0 1.66 1.34 3 3 3h.1l-.6 6.4c-.05.53.36 1 .9 1h7.2c.54 0 .95-.47.9-1L16 13h.1c1.66 0 3-1.34 3-3V7c0-.55-.45-1-1-1z" />
                    </svg>
                </div>
            )}

            {note.title && (
                <h3 className="text-base font-semibold text-theme-primary mb-2 leading-snug">
                    {note.title}
                </h3>
            )}

            {note.content && (
                <p className="text-sm text-theme-secondary leading-relaxed line-clamp-6 whitespace-pre-wrap">
                    {note.content}
                </p>
            )}

            {note.items && note.items.length > 0 && (
                <ul className="list-none mt-2">
                    {note.items.slice(0, 5).map((item, idx) => (
                        <li
                            key={idx}
                            className={`flex items-start gap-2 py-1 text-sm ${item.is_checked ? 'text-theme-muted line-through' : 'text-theme-secondary'}`}
                        >
                            <span className={`w-4 h-4 border-2 rounded shrink-0 mt-0.5 flex items-center justify-center ${item.is_checked ? 'bg-accent border-accent' : 'border-theme-light'}`}>
                                {item.is_checked && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </span>
                            <span>{item.content}</span>
                        </li>
                    ))}
                    {note.items.length > 5 && (
                        <li className="text-theme-muted italic text-sm py-1">+{note.items.length - 5} more</li>
                    )}
                </ul>
            )}

            {note.labels && note.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {note.labels.map((label, idx) => (
                        <span key={idx} className="px-2 py-1 bg-theme-card-hover rounded text-xs text-theme-secondary">
                            {label}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {onPin && !showDelete && (
                    <button
                        className="w-8 h-8 border-none bg-theme-card-hover text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-theme-card hover:text-theme-primary"
                        onClick={(e) => handleAction(e, () => onPin(note.id, !note.is_pinned))}
                        title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                        <svg viewBox="0 0 24 24" fill={note.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M16 3H8c-.55 0-1 .45-1 1v1h10V4c0-.55-.45-1-1-1zm2 3H6c-.55 0-1 .45-1 1v3c0 1.66 1.34 3 3 3h.1l-.6 6.4c-.05.53.36 1 .9 1h7.2c.54 0 .95-.47.9-1L16 13h.1c1.66 0 3-1.34 3-3V7c0-.55-.45-1-1-1z" />
                        </svg>
                    </button>
                )}

                {onArchive && !showDelete && (
                    <button
                        className="w-8 h-8 border-none bg-theme-card-hover text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-theme-card hover:text-theme-primary"
                        onClick={(e) => handleAction(e, () => onArchive(note.id))}
                        title="Archive"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                    </button>
                )}

                {showRestore && onRestore && (
                    <button
                        className="w-8 h-8 border-none bg-theme-card-hover text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-theme-card hover:text-theme-primary"
                        onClick={(e) => handleAction(e, () => onRestore(note.id))}
                        title="Restore"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </button>
                )}

                {onTrash && !showDelete && (
                    <button
                        className="w-8 h-8 border-none bg-theme-card-hover text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-theme-card hover:text-theme-primary"
                        onClick={(e) => handleAction(e, () => onTrash(note.id))}
                        title="Move to trash"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                )}

                {showDelete && onDelete && (
                    <button
                        className="w-8 h-8 border-none bg-theme-card-hover text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-red-100 hover:text-red-500"
                        onClick={(e) => handleAction(e, () => onDelete(note.id))}
                        title="Delete permanently"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
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
