import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './Sidebar.css';

export default function Sidebar() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <svg viewBox="0 0 100 100" className="sidebar-logo-icon">
                        <defs>
                            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: 'var(--accent)' }} />
                                <stop offset="100%" style={{ stopColor: '#1E3A5F' }} />
                            </linearGradient>
                        </defs>
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="url(#logoGrad)" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span className="sidebar-logo-text">Noteer</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
                    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Notes</span>
                </NavLink>

                <NavLink to="/archive" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                    </svg>
                    <span>Archive</span>
                </NavLink>

                <NavLink to="/trash" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Trash</span>
                </NavLink>

                <div className="sidebar-divider" />

                <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {user?.name?.[0] || user?.email?.[0] || 'U'}
                    </div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name || user?.email}</div>
                        <div className="sidebar-user-role">{user?.role}</div>
                    </div>
                </div>
                <button className="sidebar-logout" onClick={handleLogout} title="Logout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>
        </aside>
    );
}
