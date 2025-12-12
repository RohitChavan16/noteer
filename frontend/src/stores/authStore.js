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

            updateProfile: async (updates) => {
                const { user, token } = get();
                if (!user || !token) return { success: false, error: 'Not authenticated' };

                set({ isLoading: true, error: null });
                try {
                    const res = await fetch(`${API_URL}/users/${user.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(updates),
                    });

                    // Handle 401 - auto logout
                    if (res.status === 401) {
                        get().logout();
                        return { success: false, error: 'Session expired' };
                    }

                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.error || 'Update failed');
                    }

                    set({
                        user: { ...user, name: data.name, email: data.email },
                        isLoading: false
                    });
                    return { success: true };
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                    return { success: false, error: error.message };
                }
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
                // Force redirect to login
                window.location.href = '/login';
            },

            clearError: () => set({ error: null }),

            getAuthHeader: () => {
                const { token } = get();
                return token ? { Authorization: `Bearer ${token}` } : {};
            },

            // Authenticated fetch wrapper - automatically handles 401
            authFetch: async (url, options = {}) => {
                const { token, logout } = get();

                const res = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });

                // Auto logout on 401 Unauthorized or 403 Forbidden
                if (res.status === 401 || res.status === 403) {
                    logout();
                    throw new Error('Session expired');
                }

                return res;
            },
        }),
        {
            name: 'noteer-auth',
            partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
