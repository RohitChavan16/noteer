import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppShell, Box } from '@mantine/core';
import Header from './Header';
import Sidebar from './Sidebar';
import { useNotesStore } from '../stores/notesStore';

export default function Layout() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { startPolling, stopPolling } = useNotesStore();

    useEffect(() => {
        startPolling();
        return () => stopPolling();
    }, [startPolling, stopPolling]);

    const handleMenuToggle = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleMenuClose = () => {
        setIsMenuOpen(false);
    };

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 280,
                breakpoint: 'sm',
                collapsed: { mobile: !isMenuOpen },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Header onMenuToggle={handleMenuToggle} isMenuOpen={isMenuOpen} />
            </AppShell.Header>

            <AppShell.Navbar>
                <Sidebar onClose={handleMenuClose} />
            </AppShell.Navbar>

            <AppShell.Main>
                <Box maw={1800} mx="auto" px="md">
                    <Outlet />
                </Box>
            </AppShell.Main>
        </AppShell>
    );
}
