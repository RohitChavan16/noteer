/**
 * Noteer End-to-End Encryption Module
 * 
 * Architecture:
 * - BIP39 24-word mnemonic → Master Seed
 * - PBKDF2 → Master Key (256-bit)
 * - RSA-OAEP keypair for sharing
 * - AES-256-GCM for note/image encryption
 * - Per-note Note Keys for granular sharing
 */

import * as bip39 from 'bip39';

// Local implementations of bytesToHex/hexToBytes (avoiding @noble/hashes/utils subpath import issues)
export function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// ============================================
// BIP39 Mnemonic Functions
// ============================================

/**
 * Generate a new 24-word BIP39 mnemonic
 * @returns {string} 24-word mnemonic phrase
 */
export function generateMnemonic() {
    return bip39.generateMnemonic(256); // 256 bits = 24 words
}

/**
 * Validate a BIP39 mnemonic (checksum verification)
 * @param {string} mnemonic - Space-separated words
 * @returns {boolean}
 */
export function validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
}

/**
 * Get BIP39 English wordlist for autocomplete
 * @returns {string[]} 2048 words
 */
export function getWordlist() {
    return bip39.wordlists.english;
}

// ============================================
// Key Derivation Functions
// ============================================

/**
 * Derive Master Key from mnemonic using BIP39 + PBKDF2
 * @param {string} mnemonic - 24-word mnemonic
 * @param {string} [passphrase=''] - Optional 25th word
 * @returns {Promise<Uint8Array>} 256-bit Master Key
 */
export async function deriveMasterKey(mnemonic, passphrase = '') {
    // BIP39: mnemonic → seed (512 bits)
    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);

    // Import seed as key material for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        seed.slice(0, 32), // Use first 32 bytes as input
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // PBKDF2: seed → Master Key (256 bits)
    // Using 600,000 iterations as per OWASP 2023 recommendations
    const masterKeyBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: seed.slice(32, 48), // Use bytes 32-48 as salt
            iterations: 600000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256 // 256-bit output
    );

    return new Uint8Array(masterKeyBits);
}

/**
 * Derive RSA keypair from Master Key for sharing
 * @param {Uint8Array} masterKey - 256-bit Master Key
 * @returns {Promise<{publicKey: JsonWebKey, privateKey: JsonWebKey}>}
 */
export async function deriveKeyPair(_masterKey) {
    // Use Web Crypto API to generate RSA-OAEP keypair
    // We use masterKey as seed for deterministic generation via HKDF
    // Note: HKDF derivation for RSA is complex in WebCrypto, using non-deterministic generation for now
    // and storing the keypair securely.

    // Generate RSA keypair (non-deterministic, but we'll store it)
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );

    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return { publicKey, privateKey };
}

// ============================================
// AES-256-GCM Encryption/Decryption
// ============================================

/**
 * Generate a random Note Key (for per-note encryption)
 * @returns {Uint8Array} 256-bit Note Key
 */
export function generateNoteKey() {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Encrypt content with AES-256-GCM
 * @param {string} plaintext - Content to encrypt
 * @param {Uint8Array} key - 256-bit encryption key
 * @returns {Promise<{ciphertext: string, iv: string}>} Base64 encoded
 */
export async function encryptContent(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
    );

    return {
        ciphertext: bufferToBase64(encryptedBuffer),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypt content with AES-256-GCM
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {string} iv - Base64 encoded IV
 * @param {Uint8Array} key - 256-bit decryption key
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptContent(ciphertext, iv, key) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBuffer(iv) },
        cryptoKey,
        base64ToBuffer(ciphertext)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

// ============================================
// Note Key Encryption (for sharing)
// ============================================

/**
 * Encrypt Note Key with Master Key (for owner)
 * @param {Uint8Array} noteKey - Note Key to encrypt
 * @param {Uint8Array} masterKey - Owner's Master Key
 * @returns {Promise<{encryptedKey: string, iv: string}>}
 */
export async function encryptNoteKeyWithMasterKey(noteKey, masterKey) {
    return await encryptContent(bytesToHex(noteKey), masterKey);
}

/**
 * Decrypt Note Key with Master Key (for owner)
 * @param {string} encryptedKey - Encrypted Note Key
 * @param {string} iv - IV used for encryption
 * @param {Uint8Array} masterKey - Owner's Master Key
 * @returns {Promise<Uint8Array>}
 */
export async function decryptNoteKeyWithMasterKey(encryptedKey, iv, masterKey) {
    const hex = await decryptContent(encryptedKey, iv, masterKey);
    return hexToBytes(hex);
}

/**
 * Encrypt Note Key with recipient's Public Key (for sharing)
 * @param {Uint8Array} noteKey - Note Key to encrypt
 * @param {JsonWebKey} recipientPublicKey - Recipient's RSA public key (JWK)
 * @returns {Promise<string>} Base64 encoded encrypted key
 */
export async function encryptNoteKeyForRecipient(noteKey, recipientPublicKey) {
    const publicKey = await crypto.subtle.importKey(
        'jwk',
        recipientPublicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        noteKey
    );

    return bufferToBase64(encryptedBuffer);
}

/**
 * Decrypt Note Key with Private Key (for recipient)
 * @param {string} encryptedKey - Base64 encoded encrypted key
 * @param {JsonWebKey} privateKey - Recipient's RSA private key (JWK)
 * @returns {Promise<Uint8Array>}
 */
export async function decryptNoteKeyWithPrivateKey(encryptedKey, privateKey) {
    // 1. Validate Inputs
    if (!encryptedKey) throw new Error("Missing encryptedKey");
    if (!privateKey) throw new Error("Missing privateKey");

    // 2. Prepare Data
    let cleanPrivateKey;
    let cleanEncryptedKey;
    try {
        cleanPrivateKey = JSON.parse(JSON.stringify(privateKey));
        cleanEncryptedKey = encryptedKey.trim();
    } catch (e) {
        throw new Error("Input sanitization failed: " + e.message);
    }

    // 3. Import Key
    let privKey;
    try {
        // Ensure algorithm is set correctly for WebCrypto if missing
        if (!cleanPrivateKey.alg) cleanPrivateKey.alg = 'RSA-OAEP-256';

        privKey = await crypto.subtle.importKey(
            'jwk',
            cleanPrivateKey,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['decrypt']
        );
    } catch (e) {
        throw new Error("ImportKey Failed: " + e.message);
    }

    // 4. Decode Ciphertext
    let buffer;
    try {
        buffer = base64ToBuffer(cleanEncryptedKey);
    } catch (e) {
        throw new Error("Base64 Decode Failed: " + e.message);
    }

    // 5. Decrypt
    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privKey,
            buffer
        );
        return new Uint8Array(decryptedBuffer);
    } catch (e) {
        throw new Error("Crypto Decrypt Failed: " + e.message);
    }
}

// ============================================
// Image Encryption
// ============================================

/**
 * Encrypt image file with AES-256-GCM
 * @param {ArrayBuffer} imageBuffer - Raw image data
 * @param {Uint8Array} key - Note Key
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: string}>}
 */
export async function encryptImage(imageBuffer, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        imageBuffer
    );

    return {
        ciphertext: encryptedBuffer,
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypt image file with AES-256-GCM
 * @param {ArrayBuffer} ciphertext - Encrypted image data
 * @param {string} iv - Base64 encoded IV
 * @param {Uint8Array} key - Note Key
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptImage(ciphertext, iv, key) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['decrypt']
    );

    return await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBuffer(iv) },
        cryptoKey,
        ciphertext
    );
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function bufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Serialize encryption data for storage
 * @param {object} encryptedData - { ciphertext, iv, ... }
 * @returns {string} JSON string
 */
export function serializeEncryptedData(encryptedData) {
    return JSON.stringify(encryptedData);
}

/**
 * Deserialize encryption data from storage
 * @param {string} serialized - JSON string
 * @returns {object}
 */
export function deserializeEncryptedData(serialized) {
    return JSON.parse(serialized);
}
