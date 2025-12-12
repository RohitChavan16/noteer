import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

export default function SettingsPage() {
    const { user, updateProfile, isLoading } = useAuthStore();
    const { theme, setTheme } = useThemeStore();

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });

    const isOidc = user?.isOidc || false;

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        const updates = {};
        if (name !== user?.name) updates.name = name;
        if (!isOidc && email !== user?.email) updates.email = email;
        if (!isOidc && newPassword) updates.password = newPassword;

        if (Object.keys(updates).length === 0) {
            setMessage({ type: 'info', text: 'No changes to save' });
            return;
        }

        const result = await updateProfile(updates);
        if (result.success) {
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
        }
    };

    const themeButtonClass = (isActive) => `flex items-center gap-2 py-2 px-4 border rounded-lg bg-transparent text-sm cursor-pointer transition-all duration-150 ${isActive ? 'border-accent bg-accent-light text-accent' : 'border-theme text-theme-secondary hover:border-theme-light hover:text-theme-primary'}`;

    const inputClass = "w-full h-10 px-3 border border-theme rounded-lg bg-theme-input text-theme-primary text-sm transition-all duration-150 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="max-w-[700px]">
            <h1 className="text-xl font-semibold text-theme-primary mb-6">Settings</h1>

            {/* Profile Section */}
            <section className="bg-theme-card border border-theme rounded-xl p-6 mb-6">
                <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-4">Profile</h2>

                {isOidc && (
                    <div className="mb-4 p-3 bg-blue-100 border border-blue-200 rounded-lg text-sm text-blue-700">
                        Your profile is managed by your identity provider (SSO). Email and password cannot be changed here.
                    </div>
                )}

                {message.text && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
                        message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
                            'bg-theme-card-hover text-theme-secondary border border-theme'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClass}
                            placeholder="Your name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={inputClass}
                            placeholder="your@email.com"
                            disabled={isOidc}
                        />
                    </div>

                    {!isOidc && (
                        <>
                            <div className="border-t border-theme pt-4 mt-4">
                                <p className="text-sm text-theme-muted mb-3">Change Password (leave empty to keep current)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={inputClass}
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={inputClass}
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </section>

            {/* Appearance Section */}
            <section className="bg-theme-card border border-theme rounded-xl p-6 mb-6">
                <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-4">Appearance</h2>

                <div className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-theme-primary">Theme</span>
                        <span className="text-sm text-theme-muted">Choose your preferred color scheme</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className={themeButtonClass(theme === 'dark')}
                            onClick={() => setTheme('dark')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                            Dark
                        </button>
                        <button
                            className={themeButtonClass(theme === 'light')}
                            onClick={() => setTheme('light')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                            </svg>
                            Light
                        </button>
                    </div>
                </div>
            </section>

            {/* Account Info Section */}
            <section className="bg-theme-card border border-theme rounded-xl p-6 mb-6">
                <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-4">Account</h2>

                <div className="flex items-center justify-between py-3 border-b border-theme">
                    <span className="font-medium text-theme-primary">Role</span>
                    <span className="capitalize py-1 px-2.5 bg-accent-light text-accent rounded text-sm font-medium">{user?.role}</span>
                </div>

                {isOidc && (
                    <div className="flex items-center justify-between py-3">
                        <span className="font-medium text-theme-primary">Authentication</span>
                        <span className="py-1 px-2.5 bg-blue-100 text-blue-700 rounded text-sm font-medium">SSO / OIDC</span>
                    </div>
                )}
            </section>

            {/* About Section */}
            <section className="bg-theme-card border border-theme rounded-xl p-6">
                <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-4">About</h2>

                <div className="flex gap-5 items-start">
                    <div className="w-16 h-16 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-accent">
                            <rect x="15" y="10" width="70" height="80" rx="8" fill="currentColor" />
                            <line x1="28" y1="30" x2="72" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                            <line x1="28" y1="45" x2="65" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
                            <line x1="28" y1="60" x2="58" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-accent mb-1">Noteer</h3>
                        <p className="text-sm text-theme-secondary">Version 0.1.0</p>
                        <p className="text-sm text-theme-muted mt-2">
                            A self-hosted notes application for organizing your thoughts, ideas, and tasks.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
