import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import './SettingsPage.css';

export default function SettingsPage() {
    const { user } = useAuthStore();
    const { theme, setTheme } = useThemeStore();

    return (
        <div className="settings-page">
            <h1 className="page-title">Settings</h1>

            <section className="settings-section">
                <h2 className="settings-section-title">Appearance</h2>

                <div className="settings-option">
                    <div className="settings-option-info">
                        <span className="settings-option-label">Theme</span>
                        <span className="settings-option-description">Choose your preferred color scheme</span>
                    </div>
                    <div className="settings-theme-toggle">
                        <button
                            className={`settings-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                            onClick={() => setTheme('dark')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                            Dark
                        </button>
                        <button
                            className={`settings-theme-btn ${theme === 'light' ? 'active' : ''}`}
                            onClick={() => setTheme('light')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                            </svg>
                            Light
                        </button>
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <h2 className="settings-section-title">Account</h2>

                <div className="settings-option">
                    <div className="settings-option-info">
                        <span className="settings-option-label">Email</span>
                    </div>
                    <span className="settings-option-value">{user?.email}</span>
                </div>

                <div className="settings-option">
                    <div className="settings-option-info">
                        <span className="settings-option-label">Role</span>
                    </div>
                    <span className="settings-option-value settings-role">{user?.role}</span>
                </div>
            </section>

            <section className="settings-section">
                <h2 className="settings-section-title">About</h2>

                <div className="settings-about">
                    <div className="settings-about-logo">
                        <svg viewBox="0 0 100 100">
                            <defs>
                                <linearGradient id="settingsLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style={{ stopColor: 'var(--accent)' }} />
                                    <stop offset="100%" style={{ stopColor: '#1E3A5F' }} />
                                </linearGradient>
                            </defs>
                            <rect x="15" y="10" width="70" height="80" rx="8" fill="url(#settingsLogoGrad)" />
                            <line x1="28" y1="30" x2="72" y2="30" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                            <line x1="28" y1="45" x2="65" y2="45" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                            <line x1="28" y1="60" x2="58" y2="60" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="settings-about-info">
                        <h3>Noteer</h3>
                        <p>Version 0.1.0</p>
                        <p className="settings-about-description">
                            A self-hosted notes application for organizing your thoughts, ideas, and tasks.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
