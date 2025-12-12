import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useThemeStore } from '../stores/themeStore';

export default function Layout() {
    const initTheme = useThemeStore((s) => s.initTheme);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        initTheme();
    }, [initTheme]);

    const handleMenuToggle = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleMenuClose = () => {
        setIsMenuOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-theme-primary">
            <Sidebar isOpen={isMenuOpen} onClose={handleMenuClose} />
            {/* Sidebar is 280px fixed, so main content needs left margin on desktop (lg+) */}
            <div className="flex-1 flex flex-col lg:ml-[280px] transition-[margin-left] duration-300">
                <Header onMenuToggle={handleMenuToggle} isMenuOpen={isMenuOpen} />
                <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
