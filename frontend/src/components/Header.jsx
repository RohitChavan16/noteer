import { useState } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { useNotesStore } from '../stores/notesStore';

export default function Header({ onMenuToggle, isMenuOpen }) {
    const { theme, toggleTheme } = useThemeStore();
    const { searchQuery, setSearchQuery, viewMode, setViewMode } = useNotesStore();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    const handleSearch = (e) => {
        const value = e.target.value;
        setLocalSearch(value);
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            setSearchQuery(value);
        }, 300);
    };

    const viewBtnBase = "w-10 h-10 border-none bg-transparent text-theme-secondary rounded-lg cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]";
    const viewBtnActive = "!bg-accent-light !text-accent";

    return (
        <header className="sticky top-0 h-16 bg-theme-primary border-b border-theme flex items-center justify-between px-4 lg:px-6 z-50 gap-3">
            {/* Search bar with integrated hamburger on mobile */}
            <div className="relative flex-1 max-w-[500px]">
                <div className="flex items-center bg-theme-card border border-theme rounded-full h-12 px-1 shadow-sm">
                    {/* Hamburger inside search bar - mobile only */}
                    <button
                        className="w-10 h-10 border-none bg-transparent text-theme-secondary rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[var(--bg-card-hover)] lg:hidden"
                        onClick={onMenuToggle}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {isMenuOpen ? (
                                <path d="M18 6 6 18M6 6l12 12" />
                            ) : (
                                <>
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </>
                            )}
                        </svg>
                    </button>

                    {/* Search icon - desktop only */}
                    <div className="hidden lg:flex w-10 h-10 items-center justify-center text-theme-muted">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>

                    <input
                        type="text"
                        className="flex-1 h-10 bg-transparent text-theme-primary text-[0.95rem] border-none focus:outline-none placeholder:text-theme-muted"
                        placeholder="Search notes..."
                        value={localSearch}
                        onChange={handleSearch}
                    />

                    {localSearch && (
                        <button
                            className="w-8 h-8 mr-1 border-none bg-transparent text-theme-muted rounded-full cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                            onClick={() => { setLocalSearch(''); setSearchQuery(''); }}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* View mode and theme toggles */}
            <div className="flex items-center gap-1">
                <button
                    className={`${viewBtnBase} ${viewMode === 'grid' ? viewBtnActive : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                    </svg>
                </button>
                <button
                    className={`${viewBtnBase} ${viewMode === 'list' ? viewBtnActive : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List view"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                </button>

                <button
                    className={viewBtnBase}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
}
