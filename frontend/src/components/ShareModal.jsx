import { useState, useEffect } from 'react';
import { Modal, TextInput, Button, Group, Stack, Text, Avatar, ActionIcon, Loader, Box } from '@mantine/core';
import { IconSearch, IconX, IconUserPlus } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

const API_URL = '/api';

// Get initials from name parts
function getInitials(givenName, familyName) {
    const first = givenName?.charAt(0)?.toUpperCase() || '';
    const last = familyName?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
}

export default function ShareModal({ opened, onClose, note, onShareChange }) {
    const { authFetch } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load current collaborators when modal opens
    useEffect(() => {
        if (opened && note?.id) {
            loadCollaborators();
        }
    }, [opened, note?.id]);

    // Reset search when modal closes
    useEffect(() => {
        if (!opened) {
            setSearchQuery('');
            setSearchResults([]);
            setError(null);
        }
    }, [opened]);

    const loadCollaborators = async () => {
        if (!note?.id) return;
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_URL}/notes/${note.id}/shares`);
            if (res.ok) {
                const data = await res.json();
                setCollaborators(data);
            }
        } catch (err) {
            console.error('Failed to load collaborators:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Search users as user types
    useEffect(() => {
        const searchUsers = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const res = await authFetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`);
                if (res.ok) {
                    const data = await res.json();
                    // Filter out users already in collaborators
                    const filtered = data.filter(
                        user => !collaborators.some(c => c.id === user.id)
                    );
                    setSearchResults(filtered);
                }
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, collaborators]);

    const handleShare = async (userId) => {
        setError(null);
        try {
            const res = await authFetch(`${API_URL}/notes/${note.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });

            if (res.ok) {
                const data = await res.json();
                const newCollabs = [...collaborators, data.user];
                setCollaborators(newCollabs);
                setSearchResults(prev => prev.filter(u => u.id !== userId));
                setSearchQuery('');
                onShareChange?.(newCollabs.length);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to share');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUnshare = async (userId) => {
        setError(null);
        try {
            const res = await authFetch(`${API_URL}/notes/${note.id}/share/${userId}`, {
                method: 'DELETE',
            });

            if (res.ok || res.status === 204) {
                const newCollabs = collaborators.filter(c => c.id !== userId);
                setCollaborators(newCollabs);
                onShareChange?.(newCollabs.length);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to unshare');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Share Note"
            size="md"
            closeOnClickOutside={false}
            withinPortal={true}
            zIndex={1000}
        >
            <Stack gap="md">
                {/* Search Input */}
                <TextInput
                    placeholder="Search users by email or name..."
                    leftSection={<IconSearch size={16} />}
                    rightSection={isSearching ? <Loader size="xs" /> : null}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <Box style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <Stack gap="xs">
                            {searchResults.map(user => (
                                <Group
                                    key={user.id}
                                    justify="space-between"
                                    p="xs"
                                    style={{
                                        borderRadius: 8,
                                        background: 'var(--mantine-color-dark-6)',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                    onClick={() => handleShare(user.id)}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mantine-color-dark-5)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--mantine-color-dark-6)'}
                                >
                                    <Group gap="sm">
                                        <Avatar src={user.avatar_url} size="sm" radius="xl">
                                            {getInitials(user.given_name, user.family_name)}
                                        </Avatar>
                                        <div>
                                            <Text size="sm" fw={500}>{user.name}</Text>
                                            <Text size="xs" c="dimmed">{user.email}</Text>
                                        </div>
                                    </Group>
                                    <IconUserPlus size={16} style={{ opacity: 0.5 }} />
                                </Group>
                            ))}
                        </Stack>
                    </Box>
                )}

                {/* Error message */}
                {error && (
                    <Text c="red" size="sm">{error}</Text>
                )}

                {/* Current Collaborators */}
                <div>
                    <Text size="sm" fw={500} mb="xs">Shared with:</Text>
                    {isLoading ? (
                        <Loader size="sm" />
                    ) : collaborators.length === 0 ? (
                        <Text size="sm" c="dimmed">Not shared with anyone yet</Text>
                    ) : (
                        <Stack gap="xs">
                            {collaborators.map(user => (
                                <Group key={user.id} justify="space-between" p="xs" style={{ borderRadius: 8, background: 'var(--mantine-color-dark-6)' }}>
                                    <Group gap="sm">
                                        <Avatar src={user.avatar_url} size="sm" radius="xl">
                                            {getInitials(user.given_name, user.family_name)}
                                        </Avatar>
                                        <div>
                                            <Text size="sm" fw={500}>{user.name}</Text>
                                            <Text size="xs" c="dimmed">{user.email}</Text>
                                        </div>
                                    </Group>
                                    <ActionIcon
                                        variant="light"
                                        color="red"
                                        onClick={() => handleUnshare(user.id)}
                                        title="Remove access"
                                    >
                                        <IconX size={16} />
                                    </ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    )}
                </div>

                {/* Close Button */}
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onClose}>
                        Done
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
