import mongoose from 'mongoose';

const outcomeSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Outcome label cannot exceed 200 characters'],
        },
        probability: {
            type: Number,
            min: 0,
            max: 1,
        },
        price: {
            type: Number,
            min: 0,
            max: 1,
        },
    },
    { _id: false }
);

const externalMarketSchema = new mongoose.Schema(
    {
        source: {
            type: String,
            enum: ['polymarket', 'manifold', 'kalshi', 'manual'],
            required: true,
            index: true,
        },
        externalId: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: [500, 'Title cannot exceed 500 characters'],
        },
        description: {
            type: String,
            maxlength: [5000, 'Description cannot exceed 5000 characters'],
        },
        outcomes: {
            type: [outcomeSchema],
            default: [],
        },
        probabilityYes: {
            type: Number,
            min: 0,
            max: 1,
        },
        liquidity: {
            type: Number,
            default: 0,
            min: 0,
        },
        volume24h: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalVolume: {
            type: Number,
            default: 0,
            min: 0,
        },
        closeTime: Date,
        status: {
            type: String,
            enum: ['active', 'closed', 'resolved'],
            default: 'active',
            index: true,
        },
        lastSyncedAt: {
            type: Date,
            default: Date.now,
        },
        raw: {
            type: mongoose.Schema.Types.Mixed,
        },
        icon: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

externalMarketSchema.index({ source: 1, externalId: 1 }, { unique: true });
externalMarketSchema.index({ slug: 1 });
externalMarketSchema.index({ title: 'text', description: 'text' });
externalMarketSchema.index({ updatedAt: -1 });

const ExternalMarket = mongoose.model('ExternalMarket', externalMarketSchema);

export default ExternalMarket;

