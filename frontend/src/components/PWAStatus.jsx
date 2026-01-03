import { useState, useEffect } from 'react';
import { Notification, Group, Text, Button } from '@mantine/core';
import { IconWifiOff, IconRefresh, IconDownload, IconSettings } from '@tabler/icons-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { notifications } from '@mantine/notifications';
import { usePWAStore } from '../stores/pwaStore';
import { logger } from '../utils/logger';

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

    // Use global store for PWA state
    const { deferredPrompt, setDeferredPrompt, isInstalled, setIsInstalled } = usePWAStore();

    // PWA update handling
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegistered(r) {
            logger.info('PWA', 'SW Registered', r);
        },
        onRegisterError(error) {
            logger.error('PWA', 'SW registration error', error);
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

    // Check for standalone mode (isInstalled)
    useEffect(() => {
        const mq = window.matchMedia('(display-mode: standalone)');
        setIsInstalled(mq.matches);

        const handler = (e) => setIsInstalled(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [setIsInstalled]);

    // PWA Install prompt handling
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            // Check if app is already installed/standalone
            if (window.matchMedia('(display-mode: standalone)').matches) {
                return;
            }

            // Check if user previously dismissed the prompt
            if (localStorage.getItem('pwa-install-dismissed') === 'true') {
                // Still save the event so it can be triggered from Settings
                setDeferredPrompt(e);
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
    }, [setDeferredPrompt]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowInstallPrompt(false);
        localStorage.setItem('pwa-install-dismissed', 'true');

        notifications.show({
            title: 'Installation available',
            message: 'You can install Noteer anytime from Settings',
            icon: <IconSettings size={18} />,
            color: 'blue',
            autoClose: 4000
        });
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

            {/* Update Available Banner (only in standalone mode) */}
            {needRefresh && isInstalled && (
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
                    onClose={handleDismiss}
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
                        <Button size="xs" variant="subtle" onClick={handleDismiss}>
                            Not now
                        </Button>
                    </Group>
                </Notification>
            )}
        </>
    );
}
