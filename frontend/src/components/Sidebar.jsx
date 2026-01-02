import { useState } from 'react';
import { NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotesStore } from '../stores/notesStore';
import { useLabels } from '../hooks/useLabels';
import { Stack, NavLink, Avatar, Group, Text, ActionIcon, Divider, Box, Title, ScrollArea, Image } from '@mantine/core';
import { IconNote, IconArchive, IconTrash, IconSettings, IconLogout, IconShieldCog, IconTag, IconPencil } from '@tabler/icons-react';
import EditLabelsModal from './EditLabelsModal';

export default function Sidebar({ onClose }) {
    const { user, logout } = useAuthStore();
    const { pendingChanges } = useNotesStore();
    const labels = useLabels();
    const navigate = useNavigate();
    const [editLabelsOpen, setEditLabelsOpen] = useState(false);

    const handleLogout = () => {
        if (pendingChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to logout?');
            if (!confirmed) return;
        }
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
            <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Logo */}
                <Group p="md" pb="xs">
                    <Image src="/logo.png" w={36} h={36} fit="contain" alt="Noteer Logo" />
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

                    {user?.role === 'admin' && (
                        <NavLink
                            component={RouterNavLink}
                            to="/admin"
                            label="Admin Panel"
                            leftSection={<IconShieldCog size={20} stroke={1.5} />}
                            onClick={handleLinkClick}
                            variant="filled"
                        />
                    )}
                </Stack>

                {/* Labels Section */}
                {labels.length > 0 && (
                    <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <Divider my="sm" mx="xs" />
                        <Box px="xs" mb="xs">
                            <Group justify="space-between" mb={4}>
                                <Text size="xs" fw={600} c="dimmed" tt="uppercase">Labels</Text>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => setEditLabelsOpen(true)}
                                    title="Edit labels"
                                >
                                    <IconPencil size={16} />
                                </ActionIcon>
                            </Group>
                        </Box>
                        <ScrollArea style={{ flex: 1 }} px="xs" scrollbarSize={8}>
                            <Stack gap={4}>
                                {labels.map((label) => (
                                    <NavLink
                                        key={label.id}
                                        component={RouterNavLink}
                                        to={`/label/${label.id}`}
                                        label={label.name}
                                        leftSection={<IconTag size={16} stroke={1.5} />}
                                        onClick={handleLinkClick}
                                        variant="filled"
                                        py={6}
                                    />
                                ))}
                            </Stack>
                        </ScrollArea>
                    </Box>
                )}

                {/* Edit Labels Button - always visible if no labels */}
                {labels.length === 0 && (
                    <>
                        <Divider my="sm" mx="xs" />
                        <Stack gap={4} px="xs">
                            <NavLink
                                label="Create labels"
                                leftSection={<IconTag size={20} stroke={1.5} />}
                                onClick={() => setEditLabelsOpen(true)}
                                variant="filled"
                            />
                        </Stack>
                    </>
                )}
            </Box>

            {/* User section */}
            <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        <Avatar src={user?.avatar_url} color="blue" radius="xl" flex={0}>
                            {user?.name?.[0] || user?.email?.[0] || 'U'}
                        </Avatar>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate="end">
                                {user?.name || user?.email}
                            </Text>
                            <Text size="xs" c="dimmed" tt="capitalize" truncate="end">
                                {user?.role}
                            </Text>
                        </Box>
                    </Group>
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={handleLogout}
                        title="Logout"
                        flex={0}
                    >
                        <IconLogout size={18} />
                    </ActionIcon>
                </Group>
            </Box>

            {/* Edit Labels Modal */}
            <EditLabelsModal
                opened={editLabelsOpen}
                onClose={() => setEditLabelsOpen(false)}
            />
        </Stack>
    );
}
