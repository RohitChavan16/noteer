import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = '/api';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                    });

                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error || 'Login failed');
                    }

                    const { token, user } = await res.json();
                    set({ token, user, isAuthenticated: true, isLoading: false });
                    return true;
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                    return false;
                }
            },

            register: async (email, password, name) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch(`${API_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, name }),
                    });

                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error || 'Registration failed');
                    }

                    const { token, user } = await res.json();
                    set({ token, user, isAuthenticated: true, isLoading: false });
                    return true;
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                    return false;
                }
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
            },

            clearError: () => set({ error: null }),

            getAuthHeader: () => {
                const { token } = get();
                return token ? { Authorization: `Bearer ${token}` } : {};
            },
        }),
        {
            name: 'noteer-auth',
            partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
