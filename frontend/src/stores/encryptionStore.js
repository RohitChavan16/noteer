/**
 * Encryption Store - Manages encryption keys and state
 * 
 * Keys are stored in sessionStorage (cleared when browser closes) for convenience.
 * This means user only needs to enter mnemonic once per browser session.
 */

import { create } from 'zustand';
import {
    generateMnemonic,
    validateMnemonic,
    deriveMasterKey,
    deriveKeyPair,
    generateNoteKey,
    encryptContent,
    decryptContent,
    encryptNoteKeyWithMasterKey,
    decryptNoteKeyWithMasterKey,
    encryptNoteKeyForRecipient,
    decryptNoteKeyWithPrivateKey,
    encryptImage,
    decryptImage,
    encryptLabel,
    decryptLabel,
    bytesToHex,
    hexToBytes
} from '../utils/crypto';
import { logger } from '../utils/logger';

const API_URL = '/api';
// Keys are stored in localStorage for persistence across browser sessions until logout.

const STORAGE_KEY = 'noteer-encryption-keys';

/**
 * Save keys to localStorage
 */
function saveKeysToStorage(masterKey, privateKey, publicKey) {
    try {
        const data = {
            masterKey: bytesToHex(masterKey),
            privateKey: JSON.stringify(privateKey),
            publicKey
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        logger.warn('CRYPTO', 'Failed to save keys to storage', e);
    }
}

/**
 * Load keys from localStorage
 */
function loadKeysFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const data = JSON.parse(stored);
        return {
            masterKey: hexToBytes(data.masterKey),
            privateKey: JSON.parse(data.privateKey),
            publicKey: data.publicKey
        };
    } catch (e) {
        logger.warn('CRYPTO', 'Failed to load keys from storage', e);
        return null;
    }
}

/**
 * Clear keys from localStorage
 */
function clearKeysFromStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        logger.warn('CRYPTO', 'Failed to clear keys from storage', e);
    }
}

// Check for existing storage on load
const storedKeys = loadKeysFromStorage();

export const useEncryptionStore = create((set, get) => ({
    // State
    isUnlocked: !!storedKeys,
    isSetupComplete: false,
    isLoading: false,
    error: null,

    // Keys (loaded from session if available)
    masterKey: storedKeys?.masterKey || null,
    privateKey: storedKeys?.privateKey || null,
    publicKey: storedKeys?.publicKey || null,

    // Note keys cache (noteId -> decrypted Note Key)
    noteKeysCache: new Map(),

    /**
     * Check if user has encryption setup (has public key on server)
     */
    checkSetupStatus: async (authFetch) => {
        try {
            const response = await authFetch(`${API_URL}/encryption/status`);
            if (response.ok) {
                const data = await response.json();
                set({ isSetupComplete: data.hasPublicKey });
                return data.hasPublicKey;
            }
            return false;
        } catch (error) {
            logger.error('CRYPTO', 'Failed to check setup status', error);
            return false;
        }
    },

    /**
     * Generate a new mnemonic for setup (fast, just generates words)
     * @returns {string} Generated mnemonic for user to save
     */
    generateNewMnemonic: () => {
        const mnemonic = generateMnemonic();
        return mnemonic;
    },

    /**
     * Confirm encryption setup after user has saved mnemonic
     * Does the slow key derivation and stores public key
     * @param {string} mnemonic - The mnemonic user was shown
     * @param {string} passphrase - Optional passphrase
     * @param {Function} authFetch - Auth fetch function
     */
    confirmSetup: async (mnemonic, passphrase = '', authFetch) => {
        set({ isLoading: true, error: null });

        try {
            // 1. Derive Master Key (slow - PBKDF2 600k iterations)
            const masterKey = await deriveMasterKey(mnemonic, passphrase);

            // 2. Generate RSA keypair
            const { publicKey, privateKey } = await deriveKeyPair(masterKey);

            // 3. Encrypt Private Key with Master Key for storage
            const privateKeyJson = JSON.stringify(privateKey);
            const encryptedPrivateKey = await encryptContent(privateKeyJson, masterKey);

            // 4. Store keys on server
            const response = await authFetch(`${API_URL}/encryption/keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    publicKey,
                    encryptedPrivateKey
                })
            });

            if (!response.ok) {
                throw new Error('Failed to store encryption keys');
            }

            // 5. Store keys in memory and session
            set({
                isUnlocked: true,
                isSetupComplete: true,
                isLoading: false,
                masterKey,
                privateKey,
                publicKey
            });

            // Save to localStorage for persistence
            saveKeysToStorage(masterKey, privateKey, publicKey);

            return true;
        } catch (error) {
            set({ isLoading: false, error: error.message });
            throw error;
        }
    },

    /**
     * Unlock with existing mnemonic
     */
    unlockWithMnemonic: async (mnemonic, passphrase = '', authFetch) => {
        set({ isLoading: true, error: null });

        try {
            // Validate mnemonic
            if (!validateMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic - check the words and try again');
            }

            // Derive Master Key
            const masterKey = await deriveMasterKey(mnemonic, passphrase);

            // Fetch encrypted keys from server
            // Note: We need authFetch passed in, or we can use the one from authStore if available globally (it is not).
            // So caller must provide it.
            if (!authFetch) throw new Error('Auth fetch function required for unlocking');

            const response = await authFetch(`${API_URL}/encryption/keys`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Encryption keys not found on server. You may need to reset encryption.');
                }
                throw new Error('Failed to fetch encryption keys');
            }

            const { publicKey, encryptedPrivateKey } = await response.json();

            if (!encryptedPrivateKey) {
                throw new Error('Legacy encryption setup found (missing private key). Please reset encryption in settings.');
            }

            // Decrypt Private Key
            const privateKeyJson = await decryptContent(
                encryptedPrivateKey.ciphertext,
                encryptedPrivateKey.iv,
                masterKey
            );
            const privateKey = JSON.parse(privateKeyJson);

            set({
                isUnlocked: true,
                isLoading: false,
                masterKey,
                privateKey,
                publicKey
            });

            // Save to localStorage for persistence
            saveKeysToStorage(masterKey, privateKey, publicKey);

            return true;
        } catch (error) {
            logger.error('CRYPTO', 'Unlock failed', error);
            // Provide friendly error message for decryption failure
            if (error.name === 'OperationError' || error.message.includes('decrypt')) {
                set({ isLoading: false, error: 'Failed to decrypt private key. Wrong mnemonic or passphrase?' });
            } else {
                set({ isLoading: false, error: error.message });
            }
            throw error;
        }
    },

    /**
     * Lock encryption (clear keys from memory)
     */
    lock: () => {
        clearKeysFromStorage();
        set({
            isUnlocked: false,
            masterKey: null,
            privateKey: null,
            publicKey: null,
            noteKeysCache: new Map()
        });
    },

    /**
     * Encrypt a note before saving
     * @param {object} note - { title, content, ... }
     * @returns {object} Note with encrypted fields + encryption metadata
     */
    encryptNote: async (note) => {
        const { masterKey, noteKeysCache } = get();
        if (!masterKey) throw new Error('Encryption not unlocked');

        // Get Note Key: use cached, or decrypt existing, or generate new
        let noteKey;
        if (note.id && noteKeysCache.has(note.id)) {
            // Use cached key
            noteKey = noteKeysCache.get(note.id);
        } else if (note.id && note.encrypted_note_key) {
            // CRITICAL: For existing encrypted notes, decrypt the existing Note Key
            // instead of generating a new one (which would make old content unreadable)
            try {
                const keyData = typeof note.encrypted_note_key === 'string'
                    ? JSON.parse(note.encrypted_note_key)
                    : note.encrypted_note_key;
                noteKey = await decryptNoteKeyWithMasterKey(
                    keyData.ciphertext,
                    keyData.iv,
                    masterKey
                );
                // Cache it for future use
                noteKeysCache.set(note.id, noteKey);
            } catch (e) {
                logger.warn('CRYPTO', 'Failed to decrypt existing note key, generating new', e);
                noteKey = generateNoteKey();
            }
        } else {
            // New note - generate fresh key
            noteKey = generateNoteKey();
        }

        // Encrypt title and content
        const [encryptedTitle, encryptedContent] = await Promise.all([
            encryptContent(note.title || '', noteKey),
            encryptContent(note.content || '', noteKey)
        ]);

        // Encrypt Note Key with Master Key
        const encryptedNoteKey = await encryptNoteKeyWithMasterKey(noteKey, masterKey);

        return {
            ...note,
            title: JSON.stringify(encryptedTitle),
            content: JSON.stringify(encryptedContent),
            encrypted: true,
            encrypted_note_key: JSON.stringify(encryptedNoteKey)
        };
    },

    /**
     * Decrypt a note after fetching
     * @param {object} note - Note with encrypted fields
     * @returns {object} Decrypted note
     */
    decryptNote: async (note) => {
        // Check if note is actually encrypted - either by flag or by content pattern
        // This handles legacy data where encrypted flag might be incorrect
        const hasEncryptedContent = note.title &&
            typeof note.title === 'string' &&
            note.title.includes('"ciphertext"');

        if (!note.encrypted && !hasEncryptedContent) return note;

        const { masterKey, privateKey, noteKeysCache } = get();
        if (!masterKey || !privateKey) throw new Error('Encryption not unlocked');

        try {
            // Get Note Key
            let noteKey;

            if (noteKeysCache.has(note.id)) {
                noteKey = noteKeysCache.get(note.id);
            } else {
                // Try to decrypt with Master Key (owner) or Private Key (shared)
                // IMPORTANT: Check shared_note_key FIRST for non-owned notes!
                if (note.shared_note_key && note.is_owner === false) {
                    // Shared note - decrypt Note Key with our RSA private key
                    noteKey = await decryptNoteKeyWithPrivateKey(note.shared_note_key, privateKey);
                } else if (note.encrypted_note_key) {
                    // Our own note - decrypt Note Key with our Master Key
                    const keyData = JSON.parse(note.encrypted_note_key);
                    noteKey = await decryptNoteKeyWithMasterKey(
                        keyData.ciphertext,
                        keyData.iv,
                        masterKey
                    );
                } else {
                    throw new Error('No encryption key available for this note');
                }

                // Cache the Note Key
                noteKeysCache.set(note.id, noteKey);
                set({ noteKeysCache: new Map(noteKeysCache) });
            }

            // Decrypt title and content
            const titleData = JSON.parse(note.title);
            const contentData = JSON.parse(note.content);

            const [decryptedTitle, decryptedContent] = await Promise.all([
                decryptContent(titleData.ciphertext, titleData.iv, noteKey),
                decryptContent(contentData.ciphertext, contentData.iv, noteKey)
            ]);

            return {
                ...note,
                title: decryptedTitle,
                content: decryptedContent
            };
        } catch (error) {
            logger.error('CRYPTO', 'Note decryption failed', error);
            return {
                ...note,
                title: '[Decryption failed]',
                content: '[Unable to decrypt this note. Check your mnemonic.]',
                decryptionError: true
            };
        }
    },

    /**
     * Encrypt an image before upload
     * @param {File} file - Image file
     * @param {number} noteId - Note ID (to get Note Key)
     * @returns {Promise<{encryptedBlob: Blob, iv: string}>}
     */
    encryptImage: async (file, noteId) => {
        const { noteKeysCache } = get();
        const noteKey = noteKeysCache.get(noteId);
        if (!noteKey) throw new Error('Note key not found - save the note first');

        const buffer = await file.arrayBuffer();
        const { ciphertext, iv } = await encryptImage(buffer, noteKey);

        return {
            encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
            iv,
            originalType: file.type,
            originalName: file.name
        };
    },

    /**
     * Decrypt an image for display
     * @param {ArrayBuffer} encryptedData - Encrypted image data
     * @param {string} iv - IV from metadata
     * @param {number} noteId - Note ID (to get Note Key)
     * @returns {Promise<Blob>}
     */
    decryptImage: async (encryptedData, iv, noteId, mimeType = 'image/jpeg') => {
        const { noteKeysCache } = get();
        const noteKey = noteKeysCache.get(noteId);
        if (!noteKey) throw new Error('Note key not found');

        const decryptedBuffer = await decryptImage(encryptedData, iv, noteKey);
        return new Blob([decryptedBuffer], { type: mimeType });
    },

    /**
     * Get encrypted Note Key for sharing with another user
     * @param {number} noteId - Note ID
     * @param {JsonWebKey} recipientPublicKey - Recipient's public key
     * @returns {Promise<string>}
     */
    getEncryptedKeyForRecipient: async (noteId, recipientPublicKey) => {
        const { noteKeysCache } = get();
        const noteKey = noteKeysCache.get(noteId);
        if (!noteKey) throw new Error('Note key not found');

        return await encryptNoteKeyForRecipient(noteKey, recipientPublicKey);
    },

    /**
     * Clear error
     */
    clearError: () => set({ error: null }),

    /**
     * Encrypt label name using Master Key
     */
    encryptLabel: async (name) => {
        const { masterKey } = get();
        if (!masterKey) throw new Error('Encryption not unlocked');
        return await encryptLabel(name, masterKey);
    },

    /**
     * Decrypt label name using Master Key
     */
    decryptLabel: async (encryptedName) => {
        const { masterKey } = get();
        if (!masterKey) return encryptedName; // Fallback if locked
        return await decryptLabel(encryptedName, masterKey);
    }
}));
