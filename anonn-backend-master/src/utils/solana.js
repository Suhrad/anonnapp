import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import Nonce from '../models/Nonce.js';

/**
 * Solana Wallet Authentication Utilities
 * Handles signature verification and nonce generation
 * Uses MongoDB for nonce storage with TTL
 */

/**
 * Generate a unique nonce for wallet authentication
 * @returns {string} Random nonce string (64-character hex)
 */
export const generateNonce = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Store nonce in database with expiration
 * @param {string} publicKey - Solana public key
 * @param {string} nonce - Generated nonce
 * @param {string} message - Formatted message to sign
 */
export const storeNonce = async (publicKey, nonce, message) => {
    try {
        // Delete any existing nonce for this publicKey
        await Nonce.deleteMany({ publicKey, chain: 'solana' });
        
        // Create new nonce
        await Nonce.create({
            publicKey,
            chain: 'solana',
            nonce,
            message,
        });
    } catch (error) {
        console.error('Error storing nonce:', error);
        throw error;
    }
};

/**
 * Retrieve and validate nonce from database
 * @param {string} publicKey - Solana public key
 * @returns {object|null} Object with nonce and message if valid, null if expired or not found
 */
export const getNonce = async (publicKey) => {
    try {
        const stored = await Nonce.findOne({ 
            publicKey, 
            chain: 'solana' 
        });

        if (!stored) {
            return null;
        }

        return { 
            nonce: stored.nonce, 
            message: stored.message 
        };
    } catch (error) {
        console.error('Error retrieving nonce:', error);
        return null;
    }
};

/**
 * Remove used nonce from database (one-time use)
 * @param {string} publicKey - Solana public key
 */
export const removeNonce = async (publicKey) => {
    try {
        await Nonce.deleteMany({ publicKey, chain: 'solana' });
    } catch (error) {
        console.error('Error removing nonce:', error);
    }
};

/**
 * Format message for wallet signing
 * @param {string} nonce - Unique nonce
 * @param {string} action - Action being performed (default: 'authentication')
 * @returns {string} Formatted message
 */
export const formatWalletMessage = (nonce, action = 'authentication') => {
    const timestamp = new Date().toISOString();
    return `Sign this message to authenticate with Anonn:\n\nAction: ${action}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
};

/**
 * Verify Solana wallet signature
 * @param {string} message - Original message that was signed
 * @param {string} signature - Base58 encoded signature
 * @param {string} publicKey - Base58 encoded public key
 * @returns {boolean} True if signature is valid
 */
export const verifySignature = (message, signature, publicKey) => {
    try {
        // Decode the signature and public key from base58
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = bs58.decode(publicKey);

        // Convert message to Uint8Array
        const messageBytes = new TextEncoder().encode(message);

        // Verify the signature
        const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );

        return isValid;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

/**
 * Validate Solana public key format
 * @param {string} publicKey - Public key to validate
 * @returns {boolean} True if valid Solana public key
 */
export const isValidSolanaAddress = (publicKey) => {
    try {
        new PublicKey(publicKey);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Generate username from wallet address
 * @param {string} publicKey - Solana public key
 * @returns {string} Generated username
 */
export const generateUsernameFromWallet = (publicKey) => {
    // Take first 8 characters of the public key
    const prefix = publicKey.substring(0, 8);
    return `wallet_${prefix}`;
};

export default {
    generateNonce,
    storeNonce,
    getNonce,
    removeNonce,
    formatWalletMessage,
    verifySignature,
    isValidSolanaAddress,
    generateUsernameFromWallet,
};
