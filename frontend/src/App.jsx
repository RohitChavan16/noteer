import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { useNotesStore } from './stores/notesStore';
import { Loader, Center } from '@mantine/core';
import Layout from './components/Layout';
import { EncryptionGate } from './components/EncryptionGate';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotesPage from './pages/NotesPage';
import ArchivePage from './pages/ArchivePage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PWAStatus from './components/PWAStatus';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Wrap in EncryptionGate to ensure encryption is set up
    return <EncryptionGate>{children}</EncryptionGate>;
}

function PublicRoute({ children }) {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
    const { loginWithToken } = useAuthStore();
    const navigate = useNavigate();

    // Helper to parse hash fragment as URLSearchParams
    const getHashParams = () => {
        const hash = window.location.hash.slice(1); // Remove leading #
        return new URLSearchParams(hash);
    };

    // Check for token synchronously during initialization to prevent
    // ProtectedRoute from redirecting before we can verify
    // SECURITY: Token is passed via hash fragment (not logged by servers/proxies)
    const [isVerifying, setIsVerifying] = useState(() => {
        return !!getHashParams().get('token');
    });

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (useNotesStore.getState().pendingChanges) {
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    useEffect(() => {
        // SECURITY: Read token from hash fragment (not visible to server)
        const params = getHashParams();
        const token = params.get('token');

        if (token) {
            // Verification already active via initial state
            loginWithToken(token).then(success => {
                if (success) {
                    // Remove token from URL (clear hash) without refresh
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    // Token invalid/expired
                    navigate('/login');
                }
                setIsVerifying(false);
            });
        }
    }, [loginWithToken, navigate]);

    if (isVerifying) {
        return (
            <Center mih="100vh">
                <Loader size="xl" />
            </Center>
        );
    }

    return (
        <>
            <PWAStatus />
            <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<NotesPage />} />
                    <Route path="archive" element={<ArchivePage />} />
                    <Route path="trash" element={<TrashPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="label/:labelId" element={<NotesPage />} />
                </Route>
            </Routes>
        </>
    );
}
