import { create } from 'zustand';

export const usePWAStore = create((set) => ({
    deferredPrompt: null,
    isInstalled: false,
    setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),
    setIsInstalled: (status) => set({ isInstalled: status }),
}));
