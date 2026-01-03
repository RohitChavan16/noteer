/**
 * Mnemonic Unlock Modal
 * 
 * Shown when user needs to unlock their encrypted notes.
 * Requires entering their 24-word mnemonic.
 */

import { useState, useRef, useEffect } from 'react';
import {
    Modal,
    Stack,
    Title,
    Text,
    SimpleGrid,
    TextInput,
    Button,
    Group,
    Alert,
    Checkbox,
    Autocomplete
} from '@mantine/core';
import {
    IconLock,
    IconLockOpen,
    IconAlertCircle,
    IconLogout
} from '@tabler/icons-react';
import { useEncryptionStore } from '../stores/encryptionStore';
import { getWordlist } from '../utils/crypto';
import { useAuthStore } from '../stores/authStore';
import { logger } from '../utils/logger';

export function MnemonicUnlockModal({ opened, onUnlock }) {
    const [words, setWords] = useState(Array(24).fill(''));
    const [passphrase, setPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRefs = useRef([]);

    const { unlockWithMnemonic, error, clearError } = useEncryptionStore();
    const { authFetch, logout } = useAuthStore();
    const wordlist = getWordlist();

    useEffect(() => {
        if (!opened) {
            setWords(Array(24).fill(''));
            setPassphrase('');
            setShowPassphrase(false);
            clearError();
        }
    }, [opened, clearError]);

    const handleWordChange = (index, value) => {
        const newWords = [...words];

        // Handle paste of full mnemonic
        if (value.includes(' ')) {
            const pastedWords = value.trim().toLowerCase().split(/\s+/);
            if (pastedWords.length === 24) {
                setWords(pastedWords);
                inputRefs.current[23]?.focus();
                return;
            }
        }

        newWords[index] = value.toLowerCase().trim();
        setWords(newWords);

        // Auto-focus next input if word is complete and valid
        if (wordlist.includes(value.toLowerCase().trim()) && index < 23) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && words[index] === '' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (index < 23) {
                e.preventDefault();
                inputRefs.current[index + 1]?.focus();
            }
        }
    };

    const getAutocompleteOptions = (value) => {
        if (!value || value.length < 2) return [];
        const lowerValue = value.toLowerCase();
        return wordlist
            .filter(word => word.startsWith(lowerValue))
            .slice(0, 5);
    };

    const handleUnlock = async () => {
        const mnemonic = words.join(' ').trim();

        if (words.some(w => !w)) {
            return; // Not all words filled
        }

        setIsSubmitting(true);
        try {
            await unlockWithMnemonic(mnemonic, passphrase, authFetch);
            onUnlock?.();
        } catch (err) {
            logger.error('UI', 'Unlock failed', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isComplete = words.every(w => w.length > 0);

    return (
        <Modal
            opened={opened}
            onClose={() => { }} // Prevent closing without unlocking
            title={
                <Group gap="xs">
                    <IconLock size={24} />
                    <Title order={3}>Unlock Notes</Title>
                </Group>
            }
            size="lg"
            closeOnClickOutside={false}
            closeOnEscape={false}
            withCloseButton={false}
        >
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    Enter your 24-word recovery phrase to unlock your encrypted notes.
                    You can also paste the entire phrase into the first field.
                </Text>

                <SimpleGrid cols={4} spacing="xs">
                    {words.map((word, index) => (
                        <Autocomplete
                            key={index}
                            ref={el => inputRefs.current[index] = el}
                            size="xs"
                            placeholder={`${index + 1}.`}
                            value={word}
                            onChange={(value) => handleWordChange(index, value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            data={getAutocompleteOptions(word)}
                            styles={{
                                input: {
                                    fontFamily: 'monospace'
                                }
                            }}
                        />
                    ))}
                </SimpleGrid>

                {showPassphrase && (
                    <TextInput
                        label="Passphrase (25th word)"
                        placeholder="If you used a passphrase..."
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        type="password"
                    />
                )}

                <Group justify="space-between">
                    <Button
                        variant="subtle"
                        color="gray"
                        onClick={logout}
                        leftSection={<IconLogout size={16} />}
                        size="xs"
                    >
                        Logout
                    </Button>

                    <Checkbox
                        label="I have a passphrase"
                        checked={showPassphrase}
                        onChange={(e) => setShowPassphrase(e.target.checked)}
                        size="xs"
                    />

                    <Button
                        onClick={handleUnlock}
                        disabled={!isComplete}
                        loading={isSubmitting}
                        rightSection={<IconLockOpen size={16} />}
                    >
                        Unlock
                    </Button>
                </Group>

                {error && (
                    <Alert
                        icon={<IconAlertCircle size={20} />}
                        title="Unlock failed"
                        color="red"
                    >
                        {error}
                    </Alert>
                )}
            </Stack>
        </Modal>
    );
}
