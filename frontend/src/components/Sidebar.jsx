import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const linkBaseClass = "flex items-center gap-3 px-4 py-3 rounded-xl text-theme-secondary font-medium transition-all duration-150 mb-1";
    const linkHoverClass = "hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]";
    const linkActiveClass = "!bg-accent-light !text-accent";

    const handleLinkClick = () => {
        onClose?.();
    };

    const NavContent = () => (
        <>
            <div className="p-5 border-b border-theme">
                <div className="flex items-center gap-3">
                    <svg viewBox="0 0 100 100" className="w-10 h-10 text-accent">
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="currentColor" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span className="text-2xl font-bold text-accent">Noteer</span>
                </div>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto">
                <NavLink
                    to="/"
                    className={({ isActive }) => `${linkBaseClass} ${linkHoverClass} ${isActive ? linkActiveClass : ''}`}
                    end
                    onClick={handleLinkClick}
                >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Notes</span>
                </NavLink>

                <NavLink
                    to="/archive"
                    className={({ isActive }) => `${linkBaseClass} ${linkHoverClass} ${isActive ? linkActiveClass : ''}`}
                    onClick={handleLinkClick}
                >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                    <span>Archive</span>
                </NavLink>

                <NavLink
                    to="/trash"
                    className={({ isActive }) => `${linkBaseClass} ${linkHoverClass} ${isActive ? linkActiveClass : ''}`}
                    onClick={handleLinkClick}
                >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Trash</span>
                </NavLink>

                <div className="h-px bg-theme-card-hover my-3" />

                <NavLink
                    to="/settings"
                    className={({ isActive }) => `${linkBaseClass} ${linkHoverClass} ${isActive ? linkActiveClass : ''}`}
                    onClick={handleLinkClick}
                >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                </NavLink>
            </nav>

            <div className="p-4 border-t border-theme flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent-light text-accent flex items-center justify-center font-semibold text-lg shrink-0">
                        {user?.name?.[0] || user?.email?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-theme-primary whitespace-nowrap overflow-hidden text-ellipsis">
                            {user?.name || user?.email}
                        </div>
                        <div className="text-xs text-theme-muted capitalize">
                            {user?.role}
                        </div>
                    </div>
                </div>
                <button
                    className="w-9 h-9 border-none bg-transparent text-theme-muted rounded-lg cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-red-100 hover:text-red-500"
                    onClick={handleLogout}
                    title="Logout"
                >
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[99] lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Mobile sidebar */}
            <aside
                className={`fixed left-0 top-0 bottom-0 w-[280px] bg-theme-secondary border-r border-theme flex flex-col z-[150] transform transition-transform duration-300 lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <NavContent />
            </aside>

            {/* Desktop sidebar - always visible */}
            <aside className="fixed left-0 top-0 bottom-0 w-[280px] bg-theme-secondary border-r border-theme flex-col z-[100] hidden lg:flex">
                <NavContent />
            </aside>
        </>
    );
}
