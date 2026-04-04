import mongoose from 'mongoose';

/**
 * IdentityMapping Model
 * Stores the encrypted link between anonymousId and real userId.
 *
 * Encryption scheme (client-side only):
 *   key = PBKDF2(walletSign("ANONN_IDENTITY_V1"), salt, 100_000, 32, SHA-256)
 *   encryptedData = AES-256-GCM(key, iv, userId)
 *
 * The server NEVER knows the key. Even with full DB + code access,
 * an admin cannot decrypt encryptedData without the user's wallet private key.
 */
const identityMappingSchema = new mongoose.Schema(
    {
        anonymousId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // AES-256-GCM ciphertext of userId, base64-encoded
        encryptedData: {
            type: String,
            required: true,
        },
        // base64-encoded 12-byte IV for AES-GCM
        iv: {
            type: String,
            required: true,
        },
        // base64-encoded 16-byte salt for PBKDF2
        salt: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const IdentityMapping = mongoose.model('IdentityMapping', identityMappingSchema);

export default IdentityMapping;
