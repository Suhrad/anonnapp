import mongoose from 'mongoose';

/**
 * Poll Model
 * Represents prediction polls with options and voting
 */

const pollOptionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        maxlength: [200, 'Option text cannot exceed 200 characters'],
    },
    votes: [{ type: String }], // anonymousIds
    voteCount: {
        type: Number,
        default: 0,
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

const pollSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: [true, 'Poll question is required'],
            trim: true,
            maxlength: [500, 'Question cannot exceed 500 characters'],
        },
        description: {
            type: String,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        // Anonymized author — references AnonymousProfile.anonymousId
        anonAuthorId: {
            type: String,
            required: [true, 'Author is required'],
            index: true,
        },
        // Poll options (max 4)
        options: {
            type: [pollOptionSchema],
            validate: {
                validator: function (v) {
                    return v.length >= 2 && v.length <= 4;
                },
                message: 'Poll must have between 2 and 4 options',
            },
        },
        // Bias indicator for sentiment
        bias: {
            type: String,
            enum: ['positive', 'negative', 'neutral'],
            default: 'neutral',
        },
        // Community and Bowl associations
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Community',
        },
        bowl: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bowl',
        },
        // Company tag (for market predictions)
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
        },
        attachedMarket: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExternalMarket',
        },
        // Voting — anonymousId strings, not User ObjectIds
        upvotes: [{ type: String }],
        downvotes: [{ type: String }],
        // Expiry
        expiresAt: {
            type: Date,
            required: [true, 'Expiry date is required'],
        },
        // Track who voted (anonymousIds) to prevent duplicates
        voters: [{ type: String }],
        // Engagement metrics
        viewCount: {
            type: Number,
            default: 0,
        },
        shareCount: {
            type: Number,
            default: 0,
        },
        bookmarkCount: {
            type: Number,
            default: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
        },
        // Poll status
        isActive: {
            type: Boolean,
            default: true,
        },
        isClosed: {
            type: Boolean,
            default: false,
        },
        // Market-related fields
        isMarket: {
            type: Boolean,
            default: false,
        },
        marketId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Market',
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual populate: load AnonymousProfile as author
pollSchema.virtual('author', {
    ref: 'AnonymousProfile',
    localField: 'anonAuthorId',
    foreignField: 'anonymousId',
    justOne: true,
});

// Indexes
pollSchema.index({ anonAuthorId: 1, createdAt: -1 });
pollSchema.index({ community: 1, createdAt: -1 });
pollSchema.index({ company: 1 });
pollSchema.index({ attachedMarket: 1, createdAt: -1 });
pollSchema.index({ expiresAt: 1 });
pollSchema.index({ question: 'text' });

// Virtual for total votes
pollSchema.virtual('totalVotes').get(function () {
    const options = this.options || [];
    return options.reduce((sum, option) => sum + (option.voteCount || 0), 0);
});

// Virtual for checking if expired
pollSchema.virtual('isExpired').get(function () {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
});

// Method to calculate results
pollSchema.methods.getResults = function () {
    const options = this.options || [];
    const total = this.totalVotes || 0;
    return options.map(option => ({
        text: option.text || '',
        votes: option.voteCount || 0,
        percentage: total > 0 ? ((option.voteCount || 0) / total * 100).toFixed(2) : 0,
    }));
};

// Virtual for comments
pollSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'poll',
});

const Poll = mongoose.model('Poll', pollSchema);

export default Poll;
