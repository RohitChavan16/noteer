/**
 * EncryptionGate Component
 * 
 * Wrapper that ensures user has set up encryption before accessing the app.
 * Shows MnemonicSetupModal for new users, MnemonicUnlockModal for returning users.
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useEncryptionStore } from '../stores/encryptionStore';
import { MnemonicSetupModal } from './MnemonicSetupModal';
import { MnemonicUnlockModal } from './MnemonicUnlockModal';
import { SyncProvider } from './SyncProvider';

export function EncryptionGate({ children }) {
    const { user, setUser } = useAuthStore();
    const { isUnlocked, isSetupComplete } = useEncryptionStore();
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkEncryption = async () => {
            if (!user) {
                setIsChecking(false);
                return;
            }

            // Check if user already has encryption set up
            const hasKey = user.hasEncryptionKey;

            if (!hasKey && !isSetupComplete) {
                // New user - needs to set up encryption
                setShowSetupModal(true);
            } else if (hasKey && !isUnlocked) {
                // Returning user - needs to unlock with mnemonic
                setShowUnlockModal(true);
            }

            setIsChecking(false);
        };

        checkEncryption();
    }, [user, isUnlocked, isSetupComplete]);

    // Callback when setup is complete
    const handleSetupComplete = () => {
        setShowSetupModal(false);
        // Update user state to reflect that encryption is now set up
        if (user) {
            setUser({ ...user, hasEncryptionKey: true });
        }
    };

    // Callback when unlock is complete
    const handleUnlockComplete = () => {
        setShowUnlockModal(false);
    };

    // While checking, don't render anything (prevents flash)
    if (isChecking) {
        return null;
    }

    return (
        <>
            {/* Setup modal for new users */}
            <MnemonicSetupModal
                opened={showSetupModal}
                onComplete={handleSetupComplete}
            />

            {/* Unlock modal for returning users */}
            <MnemonicUnlockModal
                opened={showUnlockModal}
                onUnlock={handleUnlockComplete}
            />

            {/* Only render children if encryption is unlocked, wrapped in SyncProvider */}
            {isUnlocked && (
                <SyncProvider>
                    {children}
                </SyncProvider>
            )}
        </>
    );
}

