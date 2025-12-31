import { useState, useEffect } from 'react';
import { Notification, Group, Text, Button } from '@mantine/core';
import { IconWifiOff, IconRefresh, IconDownload } from '@tabler/icons-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA Status Component
 * Displays:
 * 1. Offline indicator banner when network is unavailable
 * 2. Update prompt when new version is available
 * 3. Install button for PWA installation
 */
export default function PWAStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    // PWA update handling
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        }
    });

    // Online/Offline detection
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // PWA Install prompt handling
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            // Check if app is already installed/standalone
            if (window.matchMedia('(display-mode: standalone)').matches) {
                return;
            }

            // Save the event for later
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleUpdate = () => {
        updateServiceWorker(true);
    };

    const dismissUpdate = () => {
        setNeedRefresh(false);
    };

    return (
        <>
            {/* Offline Banner */}
            {!isOnline && (
                <Notification
                    icon={<IconWifiOff size={18} />}
                    color="orange"
                    title="You are offline"
                    withCloseButton={false}
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        left: 20,
                        zIndex: 1000,
                        maxWidth: 350
                    }}
                >
                    <Text size="sm">
                        Changes will be saved locally and synced when you're back online.
                    </Text>
                </Notification>
            )}

            {/* Update Available Banner */}
            {needRefresh && (
                <Notification
                    icon={<IconRefresh size={18} />}
                    color="blue"
                    title="Update available"
                    onClose={dismissUpdate}
                    style={{
                        position: 'fixed',
                        bottom: !isOnline ? 120 : 20,
                        left: 20,
                        zIndex: 1000,
                        maxWidth: 350
                    }}
                >
                    <Text size="sm" mb="sm">
                        A new version of Noteer is available.
                    </Text>
                    <Group gap="xs">
                        <Button size="xs" onClick={handleUpdate} leftSection={<IconRefresh size={14} />}>
                            Update now
                        </Button>
                        <Button size="xs" variant="subtle" onClick={dismissUpdate}>
                            Later
                        </Button>
                    </Group>
                </Notification>
            )}

            {/* Install Prompt (only show if not installed and prompt is available) */}
            {showInstallPrompt && deferredPrompt && (
                <Notification
                    icon={<IconDownload size={18} />}
                    color="green"
                    title="Install Noteer"
                    onClose={() => setShowInstallPrompt(false)}
                    style={{
                        position: 'fixed',
                        bottom: (!isOnline ? 120 : 20) + (needRefresh ? 100 : 0),
                        left: 20,
                        zIndex: 1000,
                        maxWidth: 350
                    }}
                >
                    <Text size="sm" mb="sm">
                        Install Noteer for quick access and offline use.
                    </Text>
                    <Group gap="xs">
                        <Button size="xs" onClick={handleInstall} leftSection={<IconDownload size={14} />}>
                            Install
                        </Button>
                        <Button size="xs" variant="subtle" onClick={() => setShowInstallPrompt(false)}>
                            Not now
                        </Button>
                    </Group>
                </Notification>
            )}
        </>
    );
}
