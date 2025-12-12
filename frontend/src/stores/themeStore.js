import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'dark', // 'dark' | 'light'

            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                set({ theme: newTheme });
            },

            setTheme: (theme) => {
                document.documentElement.setAttribute('data-theme', theme);
                set({ theme });
            },

            initTheme: () => {
                const { theme } = get();
                document.documentElement.setAttribute('data-theme', theme);
            },
        }),
        {
            name: 'noteer-theme',
            onRehydrateStorage: () => (state) => {
                // Apply theme on rehydration
                if (state) {
                    document.documentElement.setAttribute('data-theme', state.theme);
                }
            },
        }
    )
);
