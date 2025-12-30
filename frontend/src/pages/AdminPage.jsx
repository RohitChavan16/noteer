import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import {
    Box, Title, Text, Paper, Table, Badge, ActionIcon, Group, Menu,
    Modal, PasswordInput, Button, Stack, Alert, Loader, Center, TextInput, Collapse, UnstyledButton
} from '@mantine/core';
import {
    IconDotsVertical, IconShieldCheck, IconUser, IconKey, IconTrash,
    IconAlertCircle, IconCheck, IconPlugConnected, IconSettings, IconChevronDown, IconChevronRight
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function AdminPage() {
    const { user, authFetch } = useAuthStore();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Password reset modal state
    const [passwordModal, setPasswordModal] = useState({ open: false, user: null });
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Delete confirmation modal state
    const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
    const [deleteLoading, setDeleteLoading] = useState(false);

    // OIDC Settings state
    const [oidcSettings, setOidcSettings] = useState({
        issuerUrl: '',
        clientId: '',
        clientSecret: '',
        hasSecret: false,
        appUrl: '',
        appUrlFromEnv: false
    });
    const [oidcLoading, setOidcLoading] = useState(true);
    const [oidcSaving, setOidcSaving] = useState(false);
    const [oidcTesting, setOidcTesting] = useState(false);
    const [oidcExpanded, setOidcExpanded] = useState(false);
    const [oidcConfigured, setOidcConfigured] = useState(false); // Tracks if OIDC is saved on server

    // Redirect non-admins
    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/');
        }
    }, [user, navigate]);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await authFetch('/api/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    // Fetch OIDC settings
    const fetchOidcSettings = useCallback(async () => {
        try {
            setOidcLoading(true);
            const res = await authFetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setOidcSettings({
                    issuerUrl: data.oidc?.issuerUrl || '',
                    clientId: data.oidc?.clientId || '',
                    clientSecret: '',
                    hasSecret: data.oidc?.hasSecret || false,
                    appUrl: data.oidc?.appUrl || '',
                    appUrlFromEnv: data.oidc?.appUrlFromEnv || false
                });
                setOidcConfigured(!!data.oidc?.issuerUrl);
            }
        } catch (err) {
            console.error('Failed to fetch OIDC settings:', err);
        } finally {
            setOidcLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchUsers();
            fetchOidcSettings();
        }
    }, [user, fetchUsers, fetchOidcSettings]);

    // Save OIDC settings
    const saveOidcSettings = async () => {
        try {
            setOidcSaving(true);
            const res = await authFetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oidc: {
                        issuerUrl: oidcSettings.issuerUrl,
                        clientId: oidcSettings.clientId,
                        clientSecret: oidcSettings.clientSecret,
                        appUrl: oidcSettings.appUrl
                    }
                })
            });
            if (!res.ok) throw new Error('Failed to save settings');
            notifications.show({ title: 'Settings saved', message: 'OIDC configuration updated successfully', color: 'green' });
            // Update oidcConfigured based on saved issuerUrl
            setOidcConfigured(!!oidcSettings.issuerUrl);
            // Update hasSecret if we just set one
            if (oidcSettings.clientSecret) {
                setOidcSettings(prev => ({ ...prev, hasSecret: true, clientSecret: '' }));
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.message, color: 'red' });
        } finally {
            setOidcSaving(false);
        }
    };

    // Test OIDC connection
    const testOidcConnection = async () => {
        try {
            setOidcTesting(true);
            const res = await authFetch('/api/admin/settings/test-oidc', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                notifications.show({
                    title: 'Connection successful',
                    message: `Connected to ${data.issuer}`,
                    color: 'green'
                });
            } else {
                notifications.show({
                    title: 'Connection failed',
                    message: data.error || 'Failed to connect',
                    color: 'red'
                });
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.message, color: 'red' });
        } finally {
            setOidcTesting(false);
        }
    };

    const handleRoleChange = async (targetUser, newRole) => {
        try {
            const res = await authFetch(`/api/users/${targetUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to change role');
            }
            // Refresh user list
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const openPasswordModal = (targetUser) => {
        setPasswordModal({ open: true, user: targetUser });
        setNewPassword('');
        setPasswordError('');
        setPasswordSuccess(false);
    };

    const handlePasswordReset = async () => {
        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        setPasswordLoading(true);
        setPasswordError('');
        try {
            const res = await authFetch(`/api/users/${passwordModal.user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to reset password');
            }
            setPasswordSuccess(true);
            setTimeout(() => {
                setPasswordModal({ open: false, user: null });
            }, 1500);
        } catch (err) {
            setPasswordError(err.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    const openDeleteModal = (targetUser) => {
        setDeleteModal({ open: true, user: targetUser });
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            const res = await authFetch(`/api/users/${deleteModal.user.id}`, {
                method: 'DELETE',
            });
            if (!res.ok && res.status !== 204) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete user');
            }
            setDeleteModal({ open: false, user: null });
            fetchUsers();
        } catch (err) {
            setError(err.message);
            setDeleteModal({ open: false, user: null });
        } finally {
            setDeleteLoading(false);
        }
    };

    if (!user || user.role !== 'admin') {
        return null;
    }

    if (loading) {
        return (
            <Center p="xl">
                <Loader size="lg" />
            </Center>
        );
    }

    return (
        <Box maw={1000}>
            <Title order={3} mb="lg">Admin Panel</Title>

            {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" withCloseButton onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* OIDC Settings Section */}
            <Paper shadow="xs" radius="md" p="lg" withBorder mb="xl">
                <UnstyledButton
                    onClick={() => oidcConfigured && setOidcExpanded(!oidcExpanded)}
                    style={{ width: '100%', cursor: oidcConfigured ? 'pointer' : 'default' }}
                >
                    <Group justify="space-between">
                        <Group>
                            {oidcConfigured ? (
                                oidcExpanded ? <IconChevronDown size={20} /> : <IconChevronRight size={20} />
                            ) : (
                                <IconSettings size={20} />
                            )}
                            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                                SSO / OIDC Settings
                            </Text>
                        </Group>
                        {oidcConfigured && (
                            <Badge color="green" variant="light">Enabled</Badge>
                        )}
                    </Group>
                </UnstyledButton>

                {oidcLoading ? (
                    <Center p="md"><Loader size="sm" /></Center>
                ) : (
                    <Collapse in={oidcExpanded || !oidcConfigured}>
                        <Stack gap="md" mt="md">
                            <TextInput
                                label="Issuer URL"
                                placeholder="https://auth.example.com"
                                value={oidcSettings.issuerUrl}
                                onChange={(e) => setOidcSettings(prev => ({ ...prev, issuerUrl: e.target.value }))}
                                description="The OpenID Connect provider URL (e.g., Authentik, Authelia)"
                            />
                            <TextInput
                                label="Client ID"
                                placeholder="abc-123-def-456"
                                value={oidcSettings.clientId}
                                onChange={(e) => setOidcSettings(prev => ({ ...prev, clientId: e.target.value }))}
                            />
                            <PasswordInput
                                label="Client Secret"
                                placeholder={oidcSettings.hasSecret ? '••••••••••••••••' : 'Enter secret'}
                                value={oidcSettings.clientSecret}
                                onChange={(e) => setOidcSettings(prev => ({ ...prev, clientSecret: e.target.value }))}
                                description={oidcSettings.hasSecret ? 'Leave empty to keep current secret' : ''}
                            />
                            <TextInput
                                label="App URL"
                                placeholder="https://notes.example.com"
                                value={oidcSettings.appUrl}
                                onChange={(e) => setOidcSettings(prev => ({ ...prev, appUrl: e.target.value }))}
                                disabled={oidcSettings.appUrlFromEnv}
                                description={oidcSettings.appUrlFromEnv
                                    ? 'Set via environment variable (APP_URL)'
                                    : 'Public URL for OIDC callback (e.g., https://notes.example.com)'}
                            />
                            <Group justify="flex-end">
                                <Button
                                    variant="light"
                                    leftSection={<IconPlugConnected size={16} />}
                                    onClick={testOidcConnection}
                                    loading={oidcTesting}
                                    disabled={!oidcSettings.issuerUrl || !oidcSettings.clientId}
                                >
                                    Test Connection
                                </Button>
                                <Button
                                    onClick={saveOidcSettings}
                                    loading={oidcSaving}
                                >
                                    Save Settings
                                </Button>
                            </Group>
                        </Stack>
                    </Collapse>
                )}
            </Paper>

            <Paper shadow="xs" radius="md" p="lg" withBorder>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">
                    User Management ({users.length} users)
                </Text>

                <Table.ScrollContainer minWidth={600}>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>ID</Table.Th>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Email</Table.Th>
                                <Table.Th>Role</Table.Th>
                                <Table.Th>Auth</Table.Th>
                                <Table.Th>Created</Table.Th>
                                <Table.Th style={{ width: 60 }}>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {users.map((u) => (
                                <Table.Tr key={u.id}>
                                    <Table.Td>{u.id}</Table.Td>
                                    <Table.Td>{u.name || '-'}</Table.Td>
                                    <Table.Td>{u.email}</Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={u.role === 'admin' ? 'blue' : 'gray'}
                                            variant="light"
                                            tt="capitalize"
                                        >
                                            {u.role}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={u.oidc_subject ? 'teal' : 'orange'}
                                            variant="light"
                                            size="sm"
                                        >
                                            {u.oidc_subject ? 'SSO' : 'Local'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </Table.Td>
                                    <Table.Td>
                                        <Menu shadow="md" width={200} position="bottom-end">
                                            <Menu.Target>
                                                <ActionIcon variant="subtle" color="gray">
                                                    <IconDotsVertical size={16} />
                                                </ActionIcon>
                                            </Menu.Target>

                                            <Menu.Dropdown>
                                                {u.role === 'user' ? (
                                                    <Menu.Item
                                                        leftSection={<IconShieldCheck size={14} />}
                                                        onClick={() => handleRoleChange(u, 'admin')}
                                                        disabled={u.id === user.id}
                                                    >
                                                        Promote to Admin
                                                    </Menu.Item>
                                                ) : (
                                                    <Menu.Item
                                                        leftSection={<IconUser size={14} />}
                                                        onClick={() => handleRoleChange(u, 'user')}
                                                        disabled={u.id === user.id}
                                                    >
                                                        Demote to User
                                                    </Menu.Item>
                                                )}

                                                {!u.oidc_subject && (
                                                    <Menu.Item
                                                        leftSection={<IconKey size={14} />}
                                                        onClick={() => openPasswordModal(u)}
                                                    >
                                                        Reset Password
                                                    </Menu.Item>
                                                )}

                                                <Menu.Divider />

                                                <Menu.Item
                                                    color="red"
                                                    leftSection={<IconTrash size={14} />}
                                                    onClick={() => openDeleteModal(u)}
                                                    disabled={u.id === user.id}
                                                >
                                                    Delete User
                                                </Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            </Paper>

            {/* Password Reset Modal */}
            <Modal
                opened={passwordModal.open}
                onClose={() => setPasswordModal({ open: false, user: null })}
                title={`Reset Password: ${passwordModal.user?.email}`}
            >
                <Stack>
                    {passwordSuccess ? (
                        <Alert icon={<IconCheck size={16} />} color="green">
                            Password reset successfully!
                        </Alert>
                    ) : (
                        <>
                            {passwordError && (
                                <Alert icon={<IconAlertCircle size={16} />} color="red">
                                    {passwordError}
                                </Alert>
                            )}
                            <PasswordInput
                                label="New Password"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                            />
                            <Group justify="flex-end">
                                <Button variant="subtle" onClick={() => setPasswordModal({ open: false, user: null })}>
                                    Cancel
                                </Button>
                                <Button onClick={handlePasswordReset} loading={passwordLoading}>
                                    Reset Password
                                </Button>
                            </Group>
                        </>
                    )}
                </Stack>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                opened={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, user: null })}
                title="Confirm Delete"
            >
                <Stack>
                    <Text>
                        Are you sure you want to delete user <strong>{deleteModal.user?.email}</strong>?
                    </Text>
                    <Text size="sm" c="dimmed">
                        This will permanently delete the user and all their notes. This action cannot be undone.
                    </Text>
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={() => setDeleteModal({ open: false, user: null })}>
                            Cancel
                        </Button>
                        <Button color="red" onClick={handleDelete} loading={deleteLoading}>
                            Delete User
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
