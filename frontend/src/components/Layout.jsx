import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useThemeStore } from '../stores/themeStore';
import './Layout.css';

export default function Layout() {
    const initTheme = useThemeStore((s) => s.initTheme);

    useEffect(() => {
        initTheme();
    }, [initTheme]);

    return (
        <div className="layout">
            <Sidebar />
            <div className="layout-main">
                <Header />
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
