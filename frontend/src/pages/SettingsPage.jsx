import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMantineColorScheme } from '@mantine/core';
import {
    Box, Title, Text, Paper, TextInput, PasswordInput, Button, Stack,
    Alert, Group, SegmentedControl, Badge, Divider
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconMoon, IconSun, IconInfoCircle } from '@tabler/icons-react';

export default function SettingsPage() {
    const { user, updateProfile, isLoading } = useAuthStore();
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });

    const isOidc = user?.isOidc || false;

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        const updates = {};
        if (name !== user?.name) updates.name = name;
        if (!isOidc && email !== user?.email) updates.email = email;
        if (!isOidc && newPassword) updates.password = newPassword;

        if (Object.keys(updates).length === 0) {
            setMessage({ type: 'info', text: 'No changes to save' });
            return;
        }

        const result = await updateProfile(updates);
        if (result.success) {
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
        }
    };

    const getAlertColor = (type) => {
        if (type === 'success') return 'green';
        if (type === 'error') return 'red';
        return 'blue';
    };

    const getAlertIcon = (type) => {
        if (type === 'success') return <IconCheck size={16} />;
        if (type === 'error') return <IconAlertCircle size={16} />;
        return <IconInfoCircle size={16} />;
    };

    return (
        <Box maw={700}>
            <Title order={3} mb="lg">Settings</Title>

            {/* Profile Section */}
            <Paper shadow="xs" radius="md" p="lg" withBorder mb="md">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">Profile</Text>

                {isOidc && (
                    <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
                        Your profile is managed by your identity provider (SSO). Email and password cannot be changed here.
                    </Alert>
                )}

                {message.text && (
                    <Alert
                        icon={getAlertIcon(message.type)}
                        color={getAlertColor(message.type)}
                        variant="light"
                        mb="md"
                    >
                        {message.text}
                    </Alert>
                )}

                <form onSubmit={handleSaveProfile}>
                    <Stack gap="sm">
                        <TextInput
                            label="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                        />

                        <TextInput
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            disabled={isOidc}
                        />

                        {!isOidc && (
                            <>
                                <Divider my="sm" label="Change Password" labelPosition="left" />
                                <Text size="sm" c="dimmed">Leave empty to keep current password</Text>

                                <PasswordInput
                                    label="New Password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                />

                                <PasswordInput
                                    label="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </>
                        )}

                        <Button type="submit" loading={isLoading} mt="sm">
                            Save Changes
                        </Button>
                    </Stack>
                </form>
            </Paper>

            {/* Appearance Section */}
            <Paper shadow="xs" radius="md" p="lg" withBorder mb="md">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">Appearance</Text>

                <Group justify="space-between" align="center">
                    <Box>
                        <Text fw={500}>Theme</Text>
                        <Text size="sm" c="dimmed">Choose your preferred color scheme</Text>
                    </Box>
                    <SegmentedControl
                        value={colorScheme}
                        onChange={setColorScheme}
                        data={[
                            { value: 'dark', label: 'Dark' },
                            { value: 'light', label: 'Light' },
                        ]}
                    />
                </Group>
            </Paper>

            {/* Account Info Section */}
            <Paper shadow="xs" radius="md" p="lg" withBorder mb="md">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">Account</Text>

                <Group justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    <Text fw={500}>Role</Text>
                    <Badge variant="light" tt="capitalize">{user?.role}</Badge>
                </Group>

                {isOidc && (
                    <Group justify="space-between" py="sm">
                        <Text fw={500}>Authentication</Text>
                        <Badge color="blue" variant="light">SSO / OIDC</Badge>
                    </Group>
                )}
            </Paper>

            {/* About Section */}
            <Paper shadow="xs" radius="md" p="lg" withBorder>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">About</Text>

                <Group gap="lg" align="flex-start">
                    <Box
                        component="svg"
                        viewBox="0 0 100 100"
                        w={56}
                        h={56}
                        c="blue"
                    >
                        <rect x="15" y="10" width="70" height="80" rx="8" fill="currentColor" />
                        <line x1="28" y1="30" x2="72" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="45" x2="65" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
                        <line x1="28" y1="60" x2="58" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    </Box>
                    <Box>
                        <Title order={2} c="blue" mb={4}>Noteer</Title>
                        <Text size="sm" c="dimmed">Version 0.1.0</Text>
                        <Text size="sm" c="dimmed" mt="xs">
                            A self-hosted notes application for organizing your thoughts, ideas, and tasks.
                        </Text>
                    </Box>
                </Group>
            </Paper>
        </Box>
    );
}
