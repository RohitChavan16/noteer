import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
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
