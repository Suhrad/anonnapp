import mongoose from 'mongoose';

/**
 * Nonce Model
 * Temporary storage for wallet authentication nonces
 * Auto-expires after 5 minutes using MongoDB TTL index
 */

const nonceSchema = new mongoose.Schema({
    address: {
        type: String,
        sparse: true, // For EVM chains
    },
    publicKey: {
        type: String,
        sparse: true, // For Solana
    },
    chain: {
        type: String,
        required: true,
        enum: ['ethereum', 'polygon', 'binance', 'solana'],
    },
    nonce: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300, // TTL: 5 minutes (300 seconds)
    },
});

// Compound indexes for fast lookup (more efficient than individual indexes)
nonceSchema.index({ address: 1, chain: 1 });
nonceSchema.index({ publicKey: 1, chain: 1 });
// Note: createdAt TTL index is created automatically by expires option

const Nonce = mongoose.model('Nonce', nonceSchema);

export default Nonce;
