import mongoose from 'mongoose';

/**
 * Wallet Model
 * Represents Web3 wallets linked to user accounts
 */

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
        },
        address: {
            type: String,
            required: [true, 'Wallet address is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        chain: {
            type: String,
            enum: ['ethereum', 'polygon', 'binance', 'solana', 'arbitrum', 'optimism'],
            required: [true, 'Chain is required'],
        },
        // Verification
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationSignature: {
            type: String,
        },
        verifiedAt: Date,
        // Balance tracking (optional, can be fetched on-demand)
        nativeBalance: {
            amount: {
                type: String,
                default: '0',
            },
            lastUpdated: Date,
        },
        // Transaction history (limited, can be paginated)
        recentTransactions: [{
            hash: String,
            type: {
                type: String,
                enum: ['send', 'receive', 'contract'],
            },
            amount: String,
            timestamp: Date,
        }],
        // Market positions (for tracking prediction market positions)
        marketPositions: [{
            market: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Market',
            },
            position: String,
            shares: Number,
            value: Number,
        }],
        // Status
        isActive: {
            type: Boolean,
            default: true,
        },
        isPrimary: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
// Note: address has unique:true which creates index automatically
walletSchema.index({ user: 1 });
walletSchema.index({ chain: 1 });

// Ensure only one primary wallet per user
walletSchema.pre('save', async function (next) {
    if (this.isPrimary && this.isModified('isPrimary')) {
        await Wallet.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { isPrimary: false }
        );
    }
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
