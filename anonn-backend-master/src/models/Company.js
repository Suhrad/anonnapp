import mongoose from 'mongoose';

/**
 * Company Model
 * Represents companies for tracking, tagging, and market predictions
 */

const companySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Company name is required'],
            unique: true,
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        ticker: {
            type: String,
            required: [true, 'Ticker symbol is required'],
            unique: true,
            uppercase: true,
            trim: true,
            maxlength: [10, 'Ticker cannot exceed 10 characters'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        logo: {
            type: String,
            default: '',
        },
        website: {
            type: String,
        },
        // Industry/Sector
        sector: {
            type: String,
            enum: ['technology', 'finance', 'healthcare', 'energy', 'consumer', 'industrial', 'crypto', 'other'],
            default: 'other',
        },
        // Insiders (verified users with inside knowledge)
        insiders: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            role: String,
            verifiedAt: Date,
        }],
        // Sentiment tracking
        bullishCount: {
            type: Number,
            default: 0,
        },
        bearishCount: {
            type: Number,
            default: 0,
        },
        bullishUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        bearishUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        // Market stats
        stats: {
            marketCap: Number,
            price: Number,
            volume24h: Number,
            change24h: Number,
            lastUpdated: Date,
        },
        // Blockchain-specific data (for crypto companies)
        blockchain: {
            chain: String,
            contractAddress: String,
            tokenSymbol: String,
        },
        // Associated markets
        markets: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Market',
        }],
        // Engagement
        followerCount: {
            type: Number,
            default: 0,
        },
        postCount: {
            type: Number,
            default: 0,
        },
        pollCount: {
            type: Number,
            default: 0,
        },
        // Status
        isActive: {
            type: Boolean,
            default: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes
// Note: ticker and name have unique:true which creates indexes automatically
companySchema.index({ sector: 1 });
companySchema.index({ followerCount: -1 });

// Virtual for sentiment score
companySchema.virtual('sentimentScore').get(function () {
    const total = this.bullishCount + this.bearishCount;
    if (total === 0) return 0;
    return ((this.bullishCount - this.bearishCount) / total) * 100;
});

const Company = mongoose.model('Company', companySchema);

export default Company;
