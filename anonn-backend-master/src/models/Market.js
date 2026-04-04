import mongoose from 'mongoose';

/**
 * Market Model
 * Represents prediction markets for company events and outcomes
 */

const positionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    option: {
        type: String,
        enum: ['yes', 'no'],
        required: true,
    },
    shares: {
        type: Number,
        required: true,
        min: 0,
    },
    averagePrice: {
        type: Number,
        required: true,
    },
    investedAmount: {
        type: Number,
        required: true,
    },
});

const marketSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company is required'],
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator is required'],
        },
        question: {
            type: String,
            required: [true, 'Market question is required'],
            maxlength: [500, 'Question cannot exceed 500 characters'],
        },
        description: {
            type: String,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        // Market type
        type: {
            type: String,
            enum: ['binary', 'categorical'],
            default: 'binary',
        },
        // Options (for binary: yes/no, for categorical: custom)
        options: [{
            label: String,
            totalShares: {
                type: Number,
                default: 0,
            },
        }],
        // Pricing (simplified constant product market maker)
        yesPrice: {
            type: Number,
            default: 0.5,
            min: 0,
            max: 1,
        },
        noPrice: {
            type: Number,
            default: 0.5,
            min: 0,
            max: 1,
        },
        // Liquidity and volume
        totalLiquidity: {
            type: Number,
            default: 0,
        },
        totalVolume: {
            type: Number,
            default: 0,
        },
        // Trader positions
        positions: [positionSchema],
        // Expiry and resolution
        expiresAt: {
            type: Date,
            required: [true, 'Expiry date is required'],
        },
        resolvedAt: Date,
        resolvedOption: {
            type: String,
            enum: ['yes', 'no', 'invalid'],
        },
        resolver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        // Status
        isActive: {
            type: Boolean,
            default: true,
        },
        isResolved: {
            type: Boolean,
            default: false,
        },
        // Engagement
        viewCount: {
            type: Number,
            default: 0,
        },
        traderCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes
marketSchema.index({ company: 1, createdAt: -1 });
marketSchema.index({ expiresAt: 1 });
marketSchema.index({ isResolved: 1 });
marketSchema.index({ totalVolume: -1 });

// Virtual for checking if expired
marketSchema.virtual('isExpired').get(function () {
    return new Date() > this.expiresAt;
});

// Method to calculate probability
marketSchema.methods.getProbability = function () {
    return {
        yes: (this.yesPrice * 100).toFixed(2),
        no: (this.noPrice * 100).toFixed(2),
    };
};

// Method to update prices after trade (simplified)
marketSchema.methods.updatePrices = function () {
    const yesShares = this.positions
        .filter(p => p.option === 'yes')
        .reduce((sum, p) => sum + p.shares, 0);
    const noShares = this.positions
        .filter(p => p.option === 'no')
        .reduce((sum, p) => sum + p.shares, 0);

    const total = yesShares + noShares;
    if (total > 0) {
        this.yesPrice = yesShares / total;
        this.noPrice = noShares / total;
    }
};

const Market = mongoose.model('Market', marketSchema);

export default Market;
