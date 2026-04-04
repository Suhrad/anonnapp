import mongoose from 'mongoose';

/**
 * Post Model
 * Represents posts with votes, comments, and company tags
 */

const postSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Post title is required'],
            trim: true,
            maxlength: [300, 'Title cannot exceed 300 characters'],
        },
        content: {
            type: String,
            required: [true, 'Post content is required'],
            maxlength: [10000, 'Content cannot exceed 10000 characters'],
        },
        // Anonymized author — references AnonymousProfile.anonymousId, NOT User._id
        anonAuthorId: {
            type: String,
            required: [true, 'Author is required'],
            index: true,
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
        // Company tags
        companyTags: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
        }],
        // Optional attached external prediction market
        attachedMarket: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExternalMarket',
        },
        // Bias indicator for sentiment
        bias: {
            type: String,
            enum: ['positive', 'negative', 'neutral'],
            default: 'neutral',
        },
        // Voting — store anonymousId strings, not User ObjectIds
        upvotes: [{ type: String }],
        downvotes: [{ type: String }],
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
        // Post type and status
        type: {
            type: String,
            enum: ['text', 'link', 'image', 'video'],
            default: 'text',
        },
        mediaUrl: {
            type: String,
        },
        linkUrl: {
            type: String,
        },
        // Post status
        isActive: {
            type: Boolean,
            default: true,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        isLocked: {
            type: Boolean,
            default: false,
        },
        // Moderation
        removedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        removalReason: String,
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes for performance
postSchema.index({ anonAuthorId: 1, createdAt: -1 });
postSchema.index({ community: 1, createdAt: -1 });
postSchema.index({ bowl: 1, createdAt: -1 });
postSchema.index({ companyTags: 1 });
postSchema.index({ attachedMarket: 1, createdAt: -1 });
postSchema.index({ bias: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ title: 'text', content: 'text' }); // Text search

// Virtual populate: load AnonymousProfile as author (no User ObjectId exposed)
postSchema.virtual('author', {
    ref: 'AnonymousProfile',
    localField: 'anonAuthorId',
    foreignField: 'anonymousId',
    justOne: true,
});

// Virtual for vote score
postSchema.virtual('voteScore').get(function () {
    const upvotes = this.upvotes || [];
    const downvotes = this.downvotes || [];
    return upvotes.length - downvotes.length;
});

// Virtual for hot score (simplified algorithm)
postSchema.virtual('hotScore').get(function () {
    const hoursSincePost = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    const upvotes = this.upvotes || [];
    const downvotes = this.downvotes || [];
    const score = upvotes.length - downvotes.length;
    return score / Math.pow(hoursSincePost + 2, 1.5);
});

// Virtual for comments
postSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'post',
});

const Post = mongoose.model('Post', postSchema);

export default Post;
