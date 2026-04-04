import IdentityMapping from '../models/IdentityMapping.js';
import AnonymousProfile from '../models/AnonymousProfile.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * @route   POST /api/anon/identity-mapping
 * @desc    Store client-side encrypted identity mapping.
 *          The server stores only the ciphertext — it cannot decrypt it.
 *          Encryption key = PBKDF2(walletSign("ANONN_IDENTITY_V1"), salt, 100_000)
 *          which only the user's wallet private key can produce.
 * @access  Private
 */
export const storeIdentityMapping = async (req, res, next) => {
    try {
        const { encryptedData, iv, salt } = req.body;
        const { anonymousId } = req;

        if (!encryptedData || !iv || !salt) {
            return errorResponse(res, 400, 'encryptedData, iv, and salt are required');
        }

        // Upsert — one mapping per anonymousId
        await IdentityMapping.findOneAndUpdate(
            { anonymousId },
            { anonymousId, encryptedData, iv, salt },
            { upsert: true, new: true }
        );

        return successResponse(res, 200, {}, 'Identity mapping stored');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/anon/identity-mapping
 * @desc    Retrieve your own encrypted identity blob (for key recovery).
 *          Only the owner (matched by JWT anonymousId) can retrieve it.
 * @access  Private
 */
export const getIdentityMapping = async (req, res, next) => {
    try {
        const { anonymousId } = req;

        const mapping = await IdentityMapping.findOne({ anonymousId }).select('-_id encryptedData iv salt');
        if (!mapping) {
            return errorResponse(res, 404, 'No identity mapping found');
        }

        return successResponse(res, 200, { mapping }, 'Identity mapping retrieved');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/anon/encryption-key
 * @desc    Store the user's X25519 public key for E2EE chat.
 *          Private key never leaves the client.
 * @access  Private
 */
export const storeEncryptionKey = async (req, res, next) => {
    try {
        const { publicKey } = req.body;
        const { anonymousId } = req;

        if (!publicKey || typeof publicKey !== 'string') {
            return errorResponse(res, 400, 'publicKey (base64 string) is required');
        }

        await AnonymousProfile.findOneAndUpdate(
            { anonymousId },
            { encryptionPublicKey: publicKey },
            { new: true }
        );

        return successResponse(res, 200, {}, 'Encryption public key stored');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/anon/encryption-key/:anonymousId
 * @desc    Get another user's X25519 public key (needed to encrypt a group key for them).
 * @access  Private
 */
export const getEncryptionKey = async (req, res, next) => {
    try {
        const { targetAnonymousId } = req.params;

        const profile = await AnonymousProfile.findOne({ anonymousId: targetAnonymousId })
            .select('anonymousId encryptionPublicKey username');

        if (!profile) {
            return errorResponse(res, 404, 'Profile not found');
        }

        return successResponse(res, 200, {
            anonymousId: profile.anonymousId,
            username: profile.username,
            publicKey: profile.encryptionPublicKey,
        }, 'Public key retrieved');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/anon/profile
 * @desc    Update anonymous profile (username, avatar, bio).
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
    try {
        const { username, avatar, bio } = req.body;
        const { anonymousId } = req;

        const updates = {};
        if (username !== undefined) updates.username = username;
        if (avatar !== undefined) updates.avatar = avatar;
        if (bio !== undefined) updates.bio = bio;

        // If changing username, check uniqueness
        if (username) {
            const existing = await AnonymousProfile.findOne({ username, anonymousId: { $ne: anonymousId } });
            if (existing) {
                return errorResponse(res, 400, 'Username already taken');
            }
        }

        const profile = await AnonymousProfile.findOneAndUpdate(
            { anonymousId },
            updates,
            { new: true, runValidators: true }
        );

        if (!profile) {
            return errorResponse(res, 404, 'Profile not found');
        }

        return successResponse(res, 200, { user: profile }, 'Profile updated');
    } catch (error) {
        next(error);
    }
};
