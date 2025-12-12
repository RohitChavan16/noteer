import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './AuthPages.css';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const { register, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();
        setLocalError('');

        if (password !== confirmPassword) {
            setLocalError('Passwords do not match');
            return;
        }

        const success = await register(email, password, name);
        if (success) {
            navigate('/');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-logo">
                    <svg viewBox="0 0 100 100" className="auth-logo-icon">
                        <defs>
                            <linearGradient id="authLogoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#38BDF8' }} />
                                <stop offset="100%" style={{ stopColor: '#1E3A5F' }} />
                            </linearGradient>
                        </defs>
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="url(#authLogoGrad2)" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="#F8FAFC" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="#F8FAFC" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="#F8FAFC" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <h1 className="auth-logo-text">Noteer</h1>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <h2 className="auth-title">Create account</h2>
                    <p className="auth-subtitle">Start organizing your thoughts</p>

                    {(error || localError) && <div className="auth-error">{error || localError}</div>}

                    <div className="auth-field">
                        <label htmlFor="name">Name (optional)</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            autoFocus
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="auth-submit" disabled={isLoading}>
                        {isLoading ? 'Creating account...' : 'Create account'}
                    </button>

                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
