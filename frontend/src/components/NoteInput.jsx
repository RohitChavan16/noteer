import { useState } from 'react';
import { useNotesStore } from '../stores/notesStore';

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
        if (e.currentTarget.contains(e.relatedTarget)) return;
        handleSubmit();
    };

    if (!isExpanded) {
        return (
            <div className="flex justify-center mb-8">
                <div
                    className="w-full max-w-[550px] border border-theme rounded-full shadow-lg transition-all duration-150 flex items-center h-12 px-5 cursor-text bg-theme-card hover:shadow-xl"
                    onClick={() => setIsExpanded(true)}
                >
                    <span className="flex-1 text-theme-muted text-[0.95rem]">Vytvořit poznámku...</span>
                    {/* Single decorative icon */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-theme-muted">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center mb-8">
            <div
                className="w-full max-w-[550px] border border-theme rounded-2xl shadow-lg transition-all duration-150 p-4"
                style={{ backgroundColor: `var(--note-${color})` }}
                onBlur={handleBlur}
                tabIndex={-1}
            >
                <input
                    type="text"
                    className="w-full border-none bg-transparent text-theme-primary text-base font-medium py-1 mb-1 focus:outline-none placeholder:text-theme-muted"
                    placeholder="Název"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                />
                <textarea
                    className="w-full border-none bg-transparent text-theme-primary text-sm leading-relaxed resize-none py-1 min-h-[80px] focus:outline-none placeholder:text-theme-muted"
                    placeholder="Vytvořit poznámku..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                />

                <div className="flex justify-between items-center mt-2 pt-2">
                    <div className="relative">
                        <button
                            className="w-8 h-8 border-none bg-transparent text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-white/10 hover:text-theme-primary"
                            onClick={() => setShowColors(!showColors)}
                            title="Barva pozadí"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="4" fill="currentColor" />
                            </svg>
                        </button>
                        {showColors && (
                            <div className="absolute bottom-full left-0 bg-theme-card border border-theme rounded-lg p-2 flex gap-1.5 flex-wrap w-[200px] shadow-lg mb-2 z-10">
                                {NOTE_COLORS.map((c) => (
                                    <button
                                        key={c.id}
                                        className={`w-7 h-7 border-2 rounded-full cursor-pointer transition-all duration-150 hover:scale-110 ${color === c.id ? 'border-accent' : 'border-transparent'}`}
                                        style={{ backgroundColor: `var(--note-${c.id})` }}
                                        onClick={() => { setColor(c.id); setShowColors(false); }}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        className="py-2 px-4 border-none bg-transparent text-theme-secondary text-sm font-medium rounded-lg cursor-pointer transition-all duration-150 hover:bg-white/10 hover:text-theme-primary"
                        onClick={handleSubmit}
                    >
                        Zavřít
                    </button>
                </div>
            </div>
        </div>
    );
}
