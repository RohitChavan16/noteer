import { useState, useEffect } from 'react';
import { Modal, TextInput, Button, Group, Stack, Text, Avatar, ActionIcon, Loader, Box, Tooltip } from '@mantine/core';
import { useNetwork } from '@mantine/hooks';
import { IconSearch, IconX, IconUserPlus, IconWifiOff } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useEncryptionStore } from '../stores/encryptionStore';
import { db } from '../db/db';
import { logger } from '../utils/logger';

const API_URL = '/api';

// Get initials from name parts
function getInitials(givenName, familyName) {
    const first = givenName?.charAt(0)?.toUpperCase() || '';
    const last = familyName?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
}

export default function ShareModal({ opened, onClose, note, onShareChange }) {
    const { authFetch } = useAuthStore();
    const network = useNetwork();
    const isOffline = !network.online;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);

    // Initialize collaborators from note prop (sync data)
    useEffect(() => {
        if (note?.collaborators) {
            setCollaborators(note.collaborators);
        } else {
            setCollaborators([]);
        }
    }, [note, opened]);

    // Search users as user types (Only when online)
    useEffect(() => {
        if (isOffline) return;

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
                logger.error('UI', 'User search failed', err);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, collaborators, authFetch, isOffline]);

    const handleShare = async (userId) => {
        if (isOffline) return;

        setError(null);
        try {
            let encryptedKey = null;

            // 1. Prepare encryption key if note is encrypted
            const { isUnlocked, getEncryptedKeyForRecipient, noteKeysCache, decryptNote } = useEncryptionStore.getState();

            // If we have the note key cached, the note is encrypted and we should share the key
            // If not cached but note.encrypted is true, try to decrypt to get the key
            if (isUnlocked && (noteKeysCache.has(note.id) || note.encrypted)) {
                try {
                    // Try to cache the note key if not already cached
                    if (!noteKeysCache.has(note.id) && note.encrypted) {
                        // We need to fetch fresh note data from local DB to ensure we have encrypted content
                        try {
                            const freshNote = await db.notes.get(note.id);
                            if (freshNote) {
                                await decryptNote(freshNote);
                            }
                        } catch (dbError) {
                            logger.warn('UI', 'Failed to fetch fresh note from DB', dbError);
                        }
                    }

                    // If we have the key cached, prepare encrypted_key for recipient
                    if (noteKeysCache.has(note.id)) {
                        const pubKeyRes = await authFetch(`${API_URL}/encryption/public-key/${userId}`);
                        if (pubKeyRes.ok) {
                            const { publicKey } = await pubKeyRes.json();
                            encryptedKey = await getEncryptedKeyForRecipient(note.id, publicKey);
                        } else {
                            // Recipient doesn't have encryption set up - cannot share encrypted note
                            setError('Cannot share encrypted note: recipient has not set up encryption');
                            return;
                        }
                    } else {
                        logger.warn('UI', 'Note marked encrypted but key not available, sharing without encrypted_key');
                    }
                } catch (encError) {
                    logger.warn('UI', 'Failed to prepare share key', encError);
                    // Share anyway, recipient might not be able to decrypt corrupted notes
                }
            }

            // 2. Share note (and key) in one atomic request
            const res = await authFetch(`${API_URL}/notes/${note.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    encrypted_key: encryptedKey
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const newCollab = { ...data.user, is_owner: false }; // Assuming response structure
                const newCollabs = [...collaborators, newCollab];

                setCollaborators(newCollabs);
                setSearchResults(prev => prev.filter(u => u.id !== userId));
                setSearchQuery('');

                // Update local note
                await db.notes.update(note.id, { collaborators: newCollabs });

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

        const newCollabs = collaborators.filter(c => c.id !== userId);

        try {
            if (isOffline) {
                // Offline: Queue the action and update optimized UI
                await db.offline_queue.add({
                    type: 'UNSHARE_NOTE',
                    payload: { noteId: note.id, userId },
                    created_at: new Date().toISOString()
                });

                // Update local note immediately so UI is consistent if closed/reopened
                await db.notes.update(note.id, { collaborators: newCollabs });

                setCollaborators(newCollabs);
                onShareChange?.(newCollabs.length);
            } else {
                // Online: Direct API call
                const res = await authFetch(`${API_URL}/notes/${note.id}/share/${userId}`, {
                    method: 'DELETE',
                });

                if (res.ok || res.status === 204) {
                    setCollaborators(newCollabs);
                    // Update local note
                    await db.notes.update(note.id, { collaborators: newCollabs });
                    onShareChange?.(newCollabs.length);
                } else {
                    const errData = await res.json();
                    setError(errData.error || 'Failed to unshare');
                }
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
                {/* Offline Warning */}
                {isOffline && (
                    <Group gap="xs" c="dimmed" bg="var(--mantine-color-dark-6)" p="xs" style={{ borderRadius: 8 }}>
                        <IconWifiOff size={16} />
                        <Text size="xs">You depend on local data. Adding collaborators is disabled while offline.</Text>
                    </Group>
                )}

                {/* Search Input */}
                <Tooltip label="Go online to add collaborators" disabled={!isOffline}>
                    <Box>
                        <TextInput
                            placeholder={isOffline ? "Offline - Adding disabled" : "Search users by email or name..."}
                            leftSection={<IconSearch size={16} />}
                            rightSection={isSearching ? <Loader size="xs" /> : null}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            disabled={isOffline}
                        />
                    </Box>
                </Tooltip>

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
                    {collaborators.length === 0 ? (
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
                                            <Text size="sm" fw={500}>{user.name} {user.is_owner && '(Owner)'}</Text>
                                            <Text size="xs" c="dimmed">{user.email}</Text>
                                        </div>
                                    </Group>
                                    {!user.is_owner && (
                                        <ActionIcon
                                            variant="light"
                                            color="red"
                                            onClick={() => handleUnshare(user.id)}
                                            title="Remove access"
                                        >
                                            <IconX size={16} />
                                        </ActionIcon>
                                    )}
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
