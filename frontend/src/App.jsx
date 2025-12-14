import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { Loader, Center } from '@mantine/core';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotesPage from './pages/NotesPage';
import ArchivePage from './pages/ArchivePage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
    const { loginWithToken } = useAuthStore();
    const navigate = useNavigate();

    // Check for token synchronously during initialization to prevent
    // ProtectedRoute from redirecting before we can verify
    const [isVerifying, setIsVerifying] = useState(() => {
        return !!new URLSearchParams(window.location.search).get('token');
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        fetch('/api/auth/debug?msg=' + encodeURIComponent('App mounted. Token found: ' + (token ? 'YES' : 'NO')));

        if (token) {
            // Verification already active via initial state
            loginWithToken(token).then(success => {
                fetch('/api/auth/debug?msg=' + encodeURIComponent('Login result: ' + success));
                if (success) {
                    // Remove token from URL without refresh
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
        <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<NotesPage />} />
                <Route path="archive" element={<ArchivePage />} />
                <Route path="trash" element={<TrashPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="label/:label" element={<NotesPage />} />
            </Route>
        </Routes>
    );
}
