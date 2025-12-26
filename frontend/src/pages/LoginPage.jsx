import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Center, Paper, TextInput, PasswordInput, Button, Title, Text, Anchor, Stack, Box, Alert, Image } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading, error, clearError } = useAuthStore();
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check public config
        fetch('/api/auth/config')
            .then(res => res.json())
            .then(data => setOidcEnabled(data.oidcEnabled))
            .catch(() => { });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();
        const success = await login(email, password);
        if (success) {
            navigate('/');
        }
    };

    return (
        <Center mih="100vh" p="md">
            <Box w="100%" maw={400}>
                <Stack align="center" mb="xl">
                    <Image src="/logo.svg" w={64} h={64} fit="contain" alt="Noteer Logo" />
                    <Title order={1} c="blue">Noteer</Title>
                </Stack>

                <Paper shadow="md" radius="md" p="xl" withBorder>
                    <form onSubmit={handleSubmit}>
                        <Stack>
                            <Title order={2} ta="center">Welcome back</Title>
                            <Text c="dimmed" size="sm" ta="center">Sign in to your account</Text>

                            {error && (
                                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                                    {error}
                                </Alert>
                            )}

                            <TextInput
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                required
                                autoFocus
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

                            {oidcEnabled && (
                                <Button
                                    component="a"
                                    href="/api/auth/oidc/login"
                                    variant="outline"
                                    fullWidth
                                    mt="md"
                                >
                                    Login with SSO (OIDC)
                                </Button>
                            )}

                            <Button type="submit" loading={isLoading} fullWidth mt="sm">
                                Sign in
                            </Button>

                            <Text c="dimmed" size="sm" ta="center">
                                Don't have an account?{' '}
                                <Anchor component={Link} to="/register">Sign up</Anchor>
                            </Text>
                        </Stack>
                    </form>
                </Paper>
            </Box>
        </Center>
    );
}
