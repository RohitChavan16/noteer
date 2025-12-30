import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Center, Paper, TextInput, PasswordInput, Button, Title, Text, Anchor, Stack, Box, Alert, Group, Image } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function RegisterPage() {
    const [givenName, setGivenName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { register, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();

        if (password !== confirmPassword) {
            return;
        }

        const success = await register(email, password, givenName, familyName);
        if (success) {
            navigate('/');
        }
    };

    const passwordMismatch = password !== confirmPassword && confirmPassword;

    return (
        <Center mih="100vh" p="md">
            <Box w="100%" maw={400}>
                <Stack align="center" mb="xl">
                    <Image src="/logo.png" w={64} h={64} fit="contain" alt="Noteer Logo" />
                    <Title order={1} c="blue">Noteer</Title>
                </Stack>

                <Paper shadow="md" radius="md" p="xl" withBorder>
                    <form onSubmit={handleSubmit}>
                        <Stack>
                            <Title order={2} ta="center">Create account</Title>
                            <Text c="dimmed" size="sm" ta="center">Start organizing your notes</Text>

                            {error && (
                                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                                    {error}
                                </Alert>
                            )}

                            <Group grow>
                                <TextInput
                                    label="First Name"
                                    placeholder="John"
                                    value={givenName}
                                    onChange={(e) => setGivenName(e.target.value)}
                                    autoFocus
                                    maxLength={255}
                                />
                                <TextInput
                                    label="Last Name"
                                    placeholder="Doe"
                                    value={familyName}
                                    onChange={(e) => setFamilyName(e.target.value)}
                                    maxLength={255}
                                />
                            </Group>

                            <TextInput
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                required
                                maxLength={255}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            <PasswordInput
                                label="Password"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                maxLength={128}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <PasswordInput
                                label="Confirm password"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                maxLength={128}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                error={passwordMismatch ? 'Passwords do not match' : null}
                            />

                            <Button type="submit" loading={isLoading} disabled={passwordMismatch} fullWidth mt="sm">
                                Create account
                            </Button>

                            <Text c="dimmed" size="sm" ta="center">
                                Already have an account?{' '}
                                <Anchor component={Link} to="/login">Sign in</Anchor>
                            </Text>
                        </Stack>
                    </form>
                </Paper>
            </Box>
        </Center>
    );
}
