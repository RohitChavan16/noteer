import { useState } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { useNotesStore } from '../stores/notesStore';
import './Header.css';

export default function Header() {
    const { theme, toggleTheme } = useThemeStore();
    const { searchQuery, setSearchQuery, viewMode, setViewMode } = useNotesStore();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    const handleSearch = (e) => {
        const value = e.target.value;
        setLocalSearch(value);
        // Debounce search
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            setSearchQuery(value);
        }, 300);
    };

    return (
        <header className="header">
            <div className="header-search">
                <svg className="header-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                    type="text"
                    className="header-search-input"
                    placeholder="Search notes..."
                    value={localSearch}
                    onChange={handleSearch}
                />
                {localSearch && (
                    <button className="header-search-clear" onClick={() => { setLocalSearch(''); setSearchQuery(''); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="header-actions">
                <button
                    className={`header-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                    </svg>
                </button>
                <button
                    className={`header-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List view"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                </button>

                <button className="header-theme-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    {theme === 'dark' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
}
