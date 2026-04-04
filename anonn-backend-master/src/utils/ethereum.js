import { ethers } from 'ethers';
import crypto from 'crypto';
import Nonce from '../models/Nonce.js';

/**
 * Ethereum Wallet Authentication Utilities
 * Handles MetaMask and other Ethereum wallet signature verification
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
 * @param {string} address - Ethereum address (0x...)
 * @param {string} nonce - Generated nonce
 * @param {string} message - Formatted message to sign
 * @param {string} chain - Blockchain chain (ethereum, polygon, binance)
 */
export const storeNonce = async (address, nonce, message, chain = 'ethereum') => {
    try {
        const normalizedAddress = address.toLowerCase();
        
        // Delete any existing nonce for this address
        await Nonce.deleteMany({ address: normalizedAddress, chain });
        
        // Create new nonce
        await Nonce.create({
            address: normalizedAddress,
            chain,
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
 * @param {string} address - Ethereum address (0x...)
 * @param {string} chain - Blockchain chain
 * @returns {object|null} Object with nonce and message if valid, null if expired or not found
 */
export const getNonce = async (address, chain = 'ethereum') => {
    try {
        const normalizedAddress = address.toLowerCase();
        const stored = await Nonce.findOne({ 
            address: normalizedAddress, 
            chain 
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
 * @param {string} address - Ethereum address (0x...)
 * @param {string} chain - Blockchain chain
 */
export const removeNonce = async (address, chain = 'ethereum') => {
    try {
        const normalizedAddress = address.toLowerCase();
        await Nonce.deleteMany({ address: normalizedAddress, chain });
    } catch (error) {
        console.error('Error removing nonce:', error);
    }
};

/**
 * Format message for wallet signing (EIP-191 personal sign)
 * @param {string} nonce - Unique nonce
 * @param {string} action - Action being performed (default: 'authentication')
 * @returns {string} Formatted message
 */
export const formatWalletMessage = (nonce, action = 'authentication') => {
    const timestamp = new Date().toISOString();
    return `Sign this message to authenticate with Anonn:\n\nAction: ${action}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
};

/**
 * Verify Ethereum wallet signature (EIP-191 personal_sign)
 * @param {string} message - Original message that was signed
 * @param {string} signature - Hex signature (0x...)
 * @param {string} address - Ethereum address (0x...)
 * @returns {boolean} True if signature is valid
 */
export const verifySignature = (message, signature, address) => {
    try {
        // Recover the address from the signature
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        // Compare addresses (case-insensitive)
        const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
        
        return isValid;
    } catch (error) {
        console.error('Ethereum signature verification error:', error);
        return false;
    }
};

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid Ethereum address
 */
export const isValidEthereumAddress = (address) => {
    try {
        return ethers.isAddress(address);
    } catch (error) {
        return false;
    }
};

/**
 * Generate username from wallet address
 * @param {string} address - Ethereum address
 * @returns {string} Generated username
 */
export const generateUsernameFromWallet = (address) => {
    // Take first 8 characters after 0x
    const prefix = address.substring(2, 10);
    return `wallet_${prefix}`;
};

/**
 * Normalize Ethereum address to checksum format
 * @param {string} address - Ethereum address
 * @returns {string} Checksummed address
 */
export const normalizeAddress = (address) => {
    try {
        return ethers.getAddress(address); // Returns checksummed address
    } catch (error) {
        return address.toLowerCase();
    }
};

export default {
    generateNonce,
    storeNonce,
    getNonce,
    removeNonce,
    formatWalletMessage,
    verifySignature,
    isValidEthereumAddress,
    generateUsernameFromWallet,
    normalizeAddress,
};
