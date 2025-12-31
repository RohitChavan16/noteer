import { useSync } from '../hooks/useSync';

/**
 * SyncProvider
 * 
 * Simple wrapper component that initializes the useSync hook.
 * This ensures synchronization only starts AFTER the user has unlocked their encryption key.
 * Used inside EncryptionGate.
 */
export function SyncProvider({ children }) {
    // Initialize sync engine
    useSync();

    return children;
}
