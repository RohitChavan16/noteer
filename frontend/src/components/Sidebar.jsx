import { NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Stack, NavLink, Avatar, Group, Text, ActionIcon, Divider, Box, Title } from '@mantine/core';
import { IconNote, IconArchive, IconTrash, IconSettings, IconLogout } from '@tabler/icons-react';

export default function Sidebar({ onClose }) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleLinkClick = () => {
        onClose?.();
    };

    const navItems = [
        { to: '/', label: 'Notes', icon: IconNote, end: true },
        { to: '/archive', label: 'Archive', icon: IconArchive },
        { to: '/trash', label: 'Trash', icon: IconTrash },
    ];

    return (
        <Stack h="100%" justify="space-between" p={0}>
            <Box>
                {/* Logo */}
                <Group p="md" pb="xs">
                    <Box
                        component="svg"
                        viewBox="0 0 100 100"
                        w={36}
                        h={36}
                        c="blue"
                    >
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="currentColor" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    </Box>
                    <Title order={3} c="blue">Noteer</Title>
                </Group>

                <Divider mb="sm" />

                {/* Navigation */}
                <Stack gap={4} px="xs">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            component={RouterNavLink}
                            to={item.to}
                            end={item.end}
                            label={item.label}
                            leftSection={<item.icon size={20} stroke={1.5} />}
                            onClick={handleLinkClick}
                            variant="filled"
                        />
                    ))}

                    <Divider my="sm" />

                    <NavLink
                        component={RouterNavLink}
                        to="/settings"
                        label="Settings"
                        leftSection={<IconSettings size={20} stroke={1.5} />}
                        onClick={handleLinkClick}
                        variant="filled"
                    />
                </Stack>
            </Box>

            {/* User section */}
            <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between">
                    <Group gap="sm">
                        <Avatar color="blue" radius="xl">
                            {user?.name?.[0] || user?.email?.[0] || 'U'}
                        </Avatar>
                        <Box>
                            <Text size="sm" fw={500} lineClamp={1}>
                                {user?.name || user?.email}
                            </Text>
                            <Text size="xs" c="dimmed" tt="capitalize">
                                {user?.role}
                            </Text>
                        </Box>
                    </Group>
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <IconLogout size={18} />
                    </ActionIcon>
                </Group>
            </Box>
        </Stack>
    );
}
