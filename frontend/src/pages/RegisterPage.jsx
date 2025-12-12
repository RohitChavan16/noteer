import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { register, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();

        if (password !== confirmPassword) {
            return;
        }

        const success = await register(email, password, name);
        if (success) {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-primary p-6">
            <div className="w-full max-w-[400px]">
                <div className="flex flex-col items-center mb-8">
                    <svg viewBox="0 0 100 100" className="w-16 h-16 mb-3 text-accent">
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="currentColor" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <h1 className="text-3xl font-bold text-accent">Noteer</h1>
                </div>

                <form className="bg-theme-card border border-theme rounded-2xl p-8 shadow-lg" onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-semibold text-theme-primary mb-1 text-center">Create account</h2>
                    <p className="text-sm text-theme-muted text-center mb-6">Start organizing your notes</p>

                    {error && <div className="bg-red-100 text-red-600 py-3 px-4 rounded-lg text-sm mb-4">{error}</div>}

                    <div className="mb-4">
                        <label htmlFor="name" className="block text-sm font-medium text-theme-secondary mb-1.5">Name (optional)</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            autoFocus
                            className="w-full h-11 px-3.5 border border-theme rounded-lg bg-theme-input text-theme-primary text-[0.95rem] transition-all duration-150 placeholder:text-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-theme-secondary mb-1.5">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full h-11 px-3.5 border border-theme rounded-lg bg-theme-input text-theme-primary text-[0.95rem] transition-all duration-150 placeholder:text-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-theme-secondary mb-1.5">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            className="w-full h-11 px-3.5 border border-theme rounded-lg bg-theme-input text-theme-primary text-[0.95rem] transition-all duration-150 placeholder:text-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-secondary mb-1.5">Confirm password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            className={`w-full h-11 px-3.5 border rounded-lg bg-theme-input text-theme-primary text-[0.95rem] transition-all duration-150 placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20 ${password !== confirmPassword && confirmPassword ? 'border-red-400 focus:border-red-400' : 'border-theme focus:border-accent'}`}
                        />
                        {password !== confirmPassword && confirmPassword && (
                            <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full h-12 mt-2 border-none rounded-lg bg-accent text-white font-semibold cursor-pointer transition-all duration-150 hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isLoading || (password !== confirmPassword && confirmPassword)}
                    >
                        {isLoading ? 'Creating account...' : 'Create account'}
                    </button>

                    <p className="text-center text-sm text-theme-muted mt-5">
                        Already have an account? <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
