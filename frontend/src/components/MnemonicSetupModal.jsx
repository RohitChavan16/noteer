/**
 * Mnemonic Setup Modal
 * 
 * Shown when user first creates their encryption keys.
 * Displays 24-word mnemonic that user must save securely.
 */

import { useState, useEffect } from 'react';
import {
    Modal,
    Stack,
    Title,
    Text,
    SimpleGrid,
    Paper,
    Checkbox,
    Button,
    Group,
    Alert,
    TextInput,
    CopyButton,
    ActionIcon,
    Tooltip
} from '@mantine/core';
import {
    IconKey,
    IconAlertTriangle,
    IconCopy,
    IconCheck,
    IconLock
} from '@tabler/icons-react';
import { useEncryptionStore } from '../stores/encryptionStore';
import { useAuthStore } from '../stores/authStore';

export function MnemonicSetupModal({ opened, onComplete }) {
    const [mnemonic, setMnemonic] = useState('');
    const [hasWrittenDown, setHasWrittenDown] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [step, setStep] = useState(1); // 1: Show mnemonic, 2: Confirm

    const { generateNewMnemonic, confirmSetup, isLoading, error, clearError } = useEncryptionStore();
    const { authFetch } = useAuthStore();

    useEffect(() => {
        if (opened && !mnemonic) {
            // Generate mnemonic immediately (fast operation)
            const newMnemonic = generateNewMnemonic();
            setMnemonic(newMnemonic);
        }
        if (!opened) {
            // Reset state when modal closes
            setMnemonic('');
            setHasWrittenDown(false);
            setPassphrase('');
            setStep(1);
            clearError();
        }
    }, [opened]);

    const handleContinue = async () => {
        if (step === 1 && hasWrittenDown) {
            // Step 1 -> 2: Do the slow key derivation and save to server
            try {
                await confirmSetup(mnemonic, passphrase, authFetch);
                setStep(2);
            } catch (err) {
                console.error('Failed to setup encryption:', err);
            }
        } else if (step === 2) {
            onComplete?.();
        }
    };

    const words = mnemonic.split(' ');

    return (
        <Modal
            opened={opened}
            onClose={() => { }} // Prevent closing without completing
            title={
                <Group gap="xs">
                    <IconKey size={24} />
                    <Title order={3}>Encryption Setup</Title>
                </Group>
            }
            size="lg"
            closeOnClickOutside={false}
            closeOnEscape={false}
            withCloseButton={false}
        >
            <Stack gap="md">
                {step === 1 && (
                    <>
                        <Alert
                            icon={<IconAlertTriangle size={20} />}
                            title="Important - read carefully!"
                            color="orange"
                        >
                            These 24 words are the <strong>only way</strong> to access your encrypted notes.
                            If you lose them, <strong>no one can help you</strong> - not even the server administrator.
                            <br /><br />
                            <strong>Write them down on paper and store in a safe place!</strong>
                        </Alert>

                        <Text size="sm" c="dimmed">
                            Your 24-word recovery phrase:
                        </Text>

                        <Paper withBorder p="md">
                            <SimpleGrid cols={4} spacing="xs">
                                {words.map((word, index) => (
                                    <Group key={index} gap={4} wrap="nowrap">
                                        <Text size="xs" c="dimmed" w={20} ta="right">
                                            {index + 1}.
                                        </Text>
                                        <Text size="sm" fw={500}>
                                            {word}
                                        </Text>
                                    </Group>
                                ))}
                            </SimpleGrid>

                            <Group justify="flex-end" mt="sm">
                                <CopyButton value={mnemonic}>
                                    {({ copied, copy }) => (
                                        <Tooltip label={copied ? 'Copied!' : 'Copy all'}>
                                            <ActionIcon
                                                variant="light"
                                                onClick={copy}
                                                color={copied ? 'teal' : 'gray'}
                                            >
                                                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                            </ActionIcon>
                                        </Tooltip>
                                    )}
                                </CopyButton>
                            </Group>
                        </Paper>

                        <Checkbox
                            label="I have written down all 24 words in a safe place"
                            checked={hasWrittenDown}
                            onChange={(e) => setHasWrittenDown(e.target.checked)}
                        />

                        {showPassphrase && (
                            <TextInput
                                label="Optional passphrase (25th word)"
                                description="Adds an extra layer of security. You must remember it!"
                                placeholder="Optional passphrase..."
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                            />
                        )}

                        <Group justify="space-between">
                            <Button
                                variant="subtle"
                                size="xs"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                            >
                                {showPassphrase ? 'Hide passphrase' : 'Add passphrase (advanced)'}
                            </Button>

                            <Button
                                onClick={handleContinue}
                                disabled={!hasWrittenDown || isLoading}
                                loading={isLoading}
                                rightSection={!isLoading && <IconLock size={16} />}
                            >
                                {isLoading ? 'Setting up encryption...' : 'Continue'}
                            </Button>
                        </Group>
                    </>
                )}

                {step === 2 && (
                    <>
                        <Alert
                            icon={<IconCheck size={20} />}
                            title="Encryption is active"
                            color="green"
                        >
                            Your notes are now encrypted. No one except you can read their content.
                        </Alert>

                        <Text size="sm">
                            On your next login, you will need to enter your 24-word phrase to unlock your notes.
                        </Text>

                        <Button onClick={handleContinue} fullWidth>
                            Start using Noteer
                        </Button>
                    </>
                )}

                {error && (
                    <Alert color="red" title="Error">
                        {error}
                    </Alert>
                )}
            </Stack>
        </Modal>
    );
}
